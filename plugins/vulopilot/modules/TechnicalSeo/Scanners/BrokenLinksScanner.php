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
 * Extracts links from the most recently published posts/pages and checks each one for a non-2xx/3xx HTTP response, flagging ones that appear broken.
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

	/** Stores when this scanner last genuinely ran. */
	private const LAST_RUN_OPTION = 'vulopilot_broken_links_last_checked';

	/** Set via set_force_run() - true for the scan() call this triggers, bypassing due_to_run()'s own cadence check. */
	private bool $force_run = false;

	/** Real per-run coverage stats (pages scanned/links checked/healthy count this run). */
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

		// Flat, standalone key - Settings → Scanning → SEO & Content → "Links & schema".
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
					'url'            => $url,
					// 'unverified' = network/timeout/DNS failure.
					'reason'         => $result['reason'],
					'text'           => $link['text'],
					'context_before' => $link['context_before'],
					'context_after'  => $link['context_after'],
				),
				md5( $link['post_id'] . '|' . $url )
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
	private function extract_link_context( string $content, int $offset, int $length ): array {
		$context_chars = 60;

		$before = wp_strip_all_tags( substr( $content, 0, $offset ) );
		$after  = wp_strip_all_tags( substr( $content, $offset + $length ) );

		return array(
			'before' => trim( mb_substr( $before, -$context_chars ) ),
			'after'  => trim( mb_substr( $after, 0, $context_chars ) ),
		);
	}

	/**
	 * Pulls every http(s) link out of the most recently published content, deduped, capped at MAX_LINKS_PER_RUN.
	 *
	 * @return array URL => post ID, anchor text, surrounding context.
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

			if ( ! preg_match_all( '/<a\s[^>]*href=["\']([^"\']+)["\'][^>]*>(.*?)<\/a>/is', $post->post_content, $matches, PREG_SET_ORDER | PREG_OFFSET_CAPTURE ) ) {
				continue;
			}

			foreach ( $matches as $match ) {
				if ( count( $links ) >= self::MAX_LINKS_PER_RUN ) {
					break;
				}

				// post_content encodes "&" as an entity.
				$url = html_entity_decode( $match[1][0], ENT_QUOTES );

				if ( 0 !== strpos( $url, 'http://' ) && 0 !== strpos( $url, 'https://' ) ) {
					continue;
				}

				if ( ! isset( $links[ $url ] ) ) {
					$context = $this->extract_link_context( $post->post_content, $match[0][1], strlen( $match[0][0] ) );

					$links[ $url ] = array(
						'post_id'        => $post->ID,
						'text'           => trim( wp_strip_all_tags( $match[2][0] ) ),
						'context_before' => $context['before'],
						'context_after'  => $context['after'],
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
	 * @return array|null 'reason' is 'unverified'.
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
