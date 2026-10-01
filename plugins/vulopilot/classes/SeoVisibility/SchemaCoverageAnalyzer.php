<?php
namespace VuloPilot\SeoVisibility;

use VuloPilot\Utill\FindingRepository;
use VuloPilot\TechnicalSeo\Scanners\StructuredDataValidationScanner;
use VuloPilot\Utill\ScanResult;

defined( 'ABSPATH' ) || exit;

/**
 * @class       SchemaCoverageAnalyzer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SchemaCoverageAnalyzer {

	private const CACHE_KEY               = 'vulopilot_schema_coverage_snapshot';
	private const CACHE_TTL               = 6 * HOUR_IN_SECONDS;
	private const SAMPLE_SIZE             = 15;
	private const REQUEST_TIMEOUT_SECONDS = 8;

	/**
	 * Plain-English meaning shown per real schema.org @type found.
	 *
	 * @var array<string, string>
	 */
	private const TYPE_MEANINGS = array(
		'Organization'    => 'Your business identity',
		'WebSite'         => 'Your website identity',
		'WebPage'         => 'A regular page',
		'BreadcrumbList'  => 'Page navigation',
		'Article'         => 'Blog/article content',
		'BlogPosting'     => 'Blog/article content',
		'Product'         => 'A product you sell',
		'Person'          => 'A content author',
		'FAQPage'         => 'Frequently-asked-questions content',
		'HowTo'           => 'Step-by-step instructions',
		'LocalBusiness'   => 'Physical business details',
		'Review'          => 'A customer review',
		'AggregateRating' => 'A rolled-up rating',
	);

	/**
	 * Regenerates the coverage snapshot whenever the schema scanner finishes - i.e. as
	 * part of any "Run scan" that includes schema.
	 *
	 * @param ScanResult $result The completed scanner result.
	 * @return void
	 */
	public function refresh_after_scan( ScanResult $result ): void {
		if ( 'schema' !== $result->get_scanner_id() ) {
			return;
		}

		$this->analyze();
	}

	/**
	 * Clears the cached coverage snapshot.
	 *
	 * @return void
	 */
	public function clear_cache(): void {
		delete_transient( self::CACHE_KEY );
	}

	/**
	 * Runs a fresh sample and stores it. The only path that performs outbound HTTP requests.
	 *
	 * @return array{generated_at: string, sample_size: int, coverage: array<int, array{type: string, meaning: string, found_on: int, problems: int, pages: array<int, array{id: int, title: string, url: string, edit_url: string|null}>}>, pages_checked: int, pages_with_valid_schema: int, pages_needing_attention: int}
	 */
	public function analyze(): array {
		$post_ids = get_posts(
			array(
				'post_type'      => array( 'post', 'page', 'product' ),
				'post_status'    => 'publish',
				// One extra, because the static front page may be dropped below.
				'posts_per_page' => self::SAMPLE_SIZE + 1,
				'orderby'        => 'modified',
				'order'          => 'DESC',
				'fields'         => 'ids',
			)
		);

		// Exclude the static front page; the homepage is added separately below.
		$post_ids = array_slice( array_values( array_diff( $post_ids, array( (int) get_option( 'page_on_front' ) ) ) ), 0, self::SAMPLE_SIZE );

		$type_counts = array();
		// Pages behind each type's `found_on` count.
		$type_pages    = array();
		$pages_checked = 0;
		// A page "has valid schema" when at least one `application/ld+json` block with an `@type` was found.
		$pages_with_schema = 0;
		// Every checked page, with or without schema.
		$checked_pages = array();

		foreach ( $post_ids as $post_id ) {
			$permalink = get_permalink( $post_id );
			if ( ! $permalink ) {
				continue;
			}

			$types = $this->extract_types_from_url( $permalink );
			if ( null === $types ) {
				continue;
			}

			++$pages_checked;

			if ( ! empty( $types ) ) {
				++$pages_with_schema;
			}

			$page_entry = array(
				'id'       => $post_id,
				'title'    => get_the_title( $post_id ) ? get_the_title( $post_id ) : $permalink,
				'url'      => $permalink,
				'edit_url' => current_user_can( 'edit_post', $post_id ) ? get_edit_post_link( $post_id, 'raw' ) : null,
			);

			$checked_pages[] = $page_entry + array( 'types' => array_values( array_unique( $types ) ) );

			foreach ( array_unique( $types ) as $type ) {
				$type_counts[ $type ]  = ( $type_counts[ $type ] ?? 0 ) + 1;
				$type_pages[ $type ][] = $page_entry;
			}
		}

		// The homepage's own sitewide Organization/WebSite schema (site identity, not per-post
		// content).
		$homepage_types = $this->extract_types_from_url( home_url( '/' ) );
		if ( null !== $homepage_types ) {
			++$pages_checked;

			if ( ! empty( $homepage_types ) ) {
				++$pages_with_schema;
			}

			$homepage_entry = array(
				'id'       => 0,
				'title'    => __( 'Homepage', 'vulopilot' ),
				'url'      => home_url( '/' ),
				'edit_url' => null,
			);

			$checked_pages[] = $homepage_entry + array( 'types' => array_values( array_unique( $homepage_types ) ) );

			foreach ( array_unique( $homepage_types ) as $type ) {
				$type_counts[ $type ]  = ( $type_counts[ $type ] ?? 0 ) + 1;
				$type_pages[ $type ][] = $homepage_entry;
			}
		}

		$findings            = new FindingRepository();
		$problem_scanner_ids = array( 'schema', 'structured-data', 'sitewide-structured-data', 'organization-schema', 'author-schema' );
		$open_problems_total = array_sum( $findings->get_severity_breakdown_for_scanner_ids( $problem_scanner_ids ) );

		arsort( $type_counts );

		$coverage = array();
		foreach ( $type_counts as $type => $found_on ) {
			$coverage[] = array(
				'type'     => $type,
				'meaning'  => self::TYPE_MEANINGS[ $type ] ?? __( 'Structured data', 'vulopilot' ),
				'found_on' => $found_on,
				// Coarse split of open schema-adjacent findings, proportional to how often the type appears.
				'problems' => $found_on > 0 && $open_problems_total > 0
					? (int) round( ( $found_on / array_sum( $type_counts ) ) * $open_problems_total )
					: 0,
				'pages'    => $type_pages[ $type ] ?? array(),
			);
		}

		$snapshot = array(
			'generated_at'            => current_time( 'mysql', true ),
			'sample_size'             => self::SAMPLE_SIZE,
			'pages_checked'           => $pages_checked,
			'pages_with_valid_schema' => $pages_with_schema,
			'pages_needing_attention' => $pages_checked - $pages_with_schema,
			'coverage'                => $coverage,
			'pages'                   => $checked_pages,
		);

		set_transient( self::CACHE_KEY, $snapshot, self::CACHE_TTL );

		return $snapshot;
	}

	/**
	 * @return array|null Cached snapshot, or null if none has been generated yet.
	 */
	public function get_stored_snapshot(): ?array {
		$snapshot = get_transient( self::CACHE_KEY );
		return $snapshot ? $snapshot : null;
	}

	/**
	 * @param string $url URL to fetch.
	 * @return string[]|null Every `@type` value found in the page's JSON-LD, or null on fetch failure.
	 */
	private function extract_types_from_url( string $url ): ?array {
		$response = wp_remote_get(
			$url,
			array(
				'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
				'sslverify' => false,
			)
		);

		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			return null;
		}

		$body   = wp_remote_retrieve_body( $response );
		$blocks = StructuredDataValidationScanner::extract_json_ld_blocks( $body );

		$types = array();
		foreach ( $blocks as $block ) {
			$decoded = json_decode( $block, true );
			if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $decoded ) ) {
				continue;
			}

			// A single JSON-LD block can be one object, a @graph of several, or a JSON array of
			// several top-level objects.
			$is_list    = array_keys( $decoded ) === range( 0, count( $decoded ) - 1 );
			$candidates = isset( $decoded['@graph'] ) && is_array( $decoded['@graph'] )
				? $decoded['@graph']
				: ( $is_list ? $decoded : array( $decoded ) );

			foreach ( $candidates as $candidate ) {
				if ( ! is_array( $candidate ) || empty( $candidate['@type'] ) ) {
					continue;
				}
				foreach ( (array) $candidate['@type'] as $type ) {
					if ( is_string( $type ) && '' !== $type ) {
						$types[] = $type;
					}
				}
			}
		}

		return $types;
	}
}
