<?php
/**
 * BrokenLinksScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\TechnicalSeo\Scanners;

use VuloPilot\Utill\SupportsForceRunInterface;
use VuloPilot\Utill\TracksScannedObjectsInterface;
use VuloPilot\Utill\Finding;
use VuloPilot\Utill\Severity;
use VuloPilot\Utill\ScannerUtil;
use VuloPilot\Utill\ScannedPostsTrait;

defined( 'ABSPATH' ) || exit;

/**
 * Extracts links from the most recently published posts/pages and checks each one for a
 * non-2xx/3xx HTTP response, flagging ones that appear broken.
 *
 * @class       BrokenLinksScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class BrokenLinksScanner extends ScannerUtil implements TracksScannedObjectsInterface, SupportsForceRunInterface {

	use ScannedPostsTrait;

	private const POSTS_BATCH_SIZE        = 20;
	private const MAX_LINKS_PER_RUN       = 40;
	private const REQUEST_TIMEOUT_SECONDS = 5;

	/**
	 * Stores when this scanner last genuinely ran - see due_to_run()'s own docblock for
	 * why this scanner self-rate-limits instead of the cadence being scheduled externally.
	 */
	private const LAST_RUN_OPTION = 'vulopilot_broken_links_last_checked';

	/**
	 * Set via set_force_run() (SupportsForceRunInterface) - true for the scan() call this
	 * triggers, bypassing due_to_run()'s own cadence check.
	 */
	private bool $force_run = false;

	/**
	 * Real per-run coverage stats (pages scanned/links checked/healthy count this run).
	 */
	public const STATS_OPTION = 'vulopilot_broken_links_last_run_stats';

	/**
	 * @inheritDoc
	 */
	public function get_id(): string {
		return 'broken-links';
	}

	/**
	 * @inheritDoc
	 */
	public function get_label(): string {
		return __( 'Broken Links', 'vulopilot' );
	}

	/**
	 * @inheritDoc
	 */
	public function get_category(): string {
		return 'links';
	}

	/**
	 * @inheritDoc
	 */
	public function set_force_run( bool $force ): void {
		$this->force_run = $force;
	}

	/**
	 * @inheritDoc
	 */
	public function scan(): array {
		$settings = wp_parse_args( get_option( \VuloPilot\Utill::VULOPILOT_SETTINGS_KEY, array() ), \VuloPilot\Utill::VULOPILOT_SETTINGS_DEFAULTS );

		// Flat, standalone key - Settings → Scanning → SEO & Content → "Links & schema"
		// (SeoContent.ts).
		if ( empty( $settings['flag_broken_links'] ) ) {
			return array();
		}

		if ( ! $this->due_to_run( (string) ( $settings['broken_link_check_frequency'] ?? 'daily' ), $this->force_run ) ) {
			return array();
		}

		$findings      = array();
		$links         = $this->extract_links_from_recent_content();
		$healthy_count = 0;

		foreach ( $links as $url => $link ) {
			$result = $this->check_link( $url );

			if ( null === $result ) {
				++$healthy_count;
				continue;
			}

			$findings[] = new Finding(
				sprintf(
					/* translators: %s is the broken URL. */
					__( 'Broken link: %s', 'vulopilot' ),
					$url
				),
				Severity::MEDIUM,
				$this->get_category(),
				sprintf(
					/* translators: %s is an HTTP status or error description. */
					__( 'Request failed with: %s', 'vulopilot' ),
					$result['detail']
				),
				'post',
				(string) $link['post_id'],
				array(
					'url'    => $url,
					// 'unverified' - a network/timeout/DNS failure (is_wp_error()).
					'reason' => $result['reason'],
					// Real visible anchor text for this real `a` tag (stripped of any nested
					// markup, e.g. a wrapped `strong`/`span`).
					'text'   => $link['text'],
				)
			);
		}

		update_option(
			self::STATS_OPTION,
			array(
				'pages_scanned' => count( $this->scanned_post_ids ),
				'links_checked' => count( $links ),
				'healthy_count' => $healthy_count,
				'checked_at'    => time(),
			),
			false
		);

		return $findings;
	}

	/**
	 * Pulls every http(s) link out of the most recently published content, deduped, capped
	 * at MAX_LINKS_PER_RUN.
	 *
	 * @return array<string, array{post_id: int, text: string}> URL => the real post ID it was found in + its real anchor text.
	 */
	private function extract_links_from_recent_content(): array {
		$posts = get_posts(
			array(
				'post_type'      => array( 'post', 'page' ),
				'post_status'    => 'publish',
				'posts_per_page' => self::POSTS_BATCH_SIZE,
				'orderby'        => 'modified',
				'order'          => 'DESC',
			)
		);

		$links = array();

		foreach ( $posts as $post ) {
			$this->mark_post_scanned( $post->ID );

			if ( count( $links ) >= self::MAX_LINKS_PER_RUN ) {
				break;
			}

			if ( ! preg_match_all( '/<a\s[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)<\/a>/is', $post->post_content, $matches, PREG_SET_ORDER ) ) {
				continue;
			}

			foreach ( $matches as $match ) {
				if ( count( $links ) >= self::MAX_LINKS_PER_RUN ) {
					break;
				}

				// Stored post_content encodes "&" as an entity (e.g. "&#038;"/"&amp;") - decode
				// before using this as a real URL, or the query string (and the live HTTP
				// check, and "Open URL") breaks on every link with more than one param.
				$url = html_entity_decode( $match[1], ENT_QUOTES );

				if ( 0 !== strpos( $url, 'http://' ) && 0 !== strpos( $url, 'https://' ) ) {
					continue;
				}

				if ( ! isset( $links[ $url ] ) ) {
					$links[ $url ] = array(
						'post_id' => $post->ID,
						'text'    => trim( wp_strip_all_tags( $match[2] ) ),
					);
				}
			}
		}

		return $links;
	}

	/**
	 * Self-rate-limits against Scanning → SEO's own "Broken link check frequency" setting.
	 *
	 * @param string $frequency 'daily' or 'weekly'.
	 * @param bool   $force     True to bypass the interval check (a manual "Run scan").
	 * @return bool True if this run should actually check links.
	 */
	private function due_to_run( string $frequency, bool $force = false ): bool {
		$interval_seconds = 'weekly' === $frequency ? WEEK_IN_SECONDS : DAY_IN_SECONDS;
		$last_ran         = (int) get_option( self::LAST_RUN_OPTION, 0 );

		if ( ! $force && ( time() - $last_ran ) < $interval_seconds ) {
			return false;
		}

		update_option( self::LAST_RUN_OPTION, time(), false );

		return true;
	}

	/**
	 * @param string $url URL to check.
	 * @return array{reason: string, detail: string}|null 'reason' is 'unverified' (network/timeout/DNS failure - is_wp_error()) or 'broken' (a real non-2xx/3xx HTTP response); null if the link looks fine.
	 */
	private function check_link( string $url ): ?array {
		$response = wp_remote_head(
			$url,
			array(
				'timeout'     => self::REQUEST_TIMEOUT_SECONDS,
				'redirection' => 5,
				'sslverify'   => false,
			)
		);

		if ( is_wp_error( $response ) ) {
			return array(
				'reason' => 'unverified',
				'detail' => $response->get_error_message(),
			);
		}

		$status_code = wp_remote_retrieve_response_code( $response );

		if ( $status_code >= 200 && $status_code < 400 ) {
			return null;
		}

		return array(
			'reason' => 'broken',
			'detail' => sprintf( 'HTTP %d', $status_code ),
		);
	}
}
