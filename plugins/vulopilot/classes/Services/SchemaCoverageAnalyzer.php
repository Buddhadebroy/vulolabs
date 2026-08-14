<?php
/**
 * SchemaCoverageAnalyzer class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

use VuloPilot\Repositories\FindingRepository;
use VuloPilot\Scanners\Basic\StructuredDataValidationScanner;

defined( 'ABSPATH' ) || exit;

/**
 * Real per-page JSON-LD sampling for the restyled Schema tab's own "Schema
 * Coverage" table — a deterministic structural check (fetch each sampled
 * page's real rendered HTML, extract `<script type="application/ld+json">`
 * blocks the same way StructuredDataValidationScanner already does for the
 * homepage, decode each block's real `@type`), not an AI call, so there's
 * no per-call cost or rate limit to worry about the way
 * GeoInsights\VisibilitySnapshotBuilder's own AI-scored sample has
 * (Pro, vulopilot-pro) — but it is still real outbound HTTP work per
 * sampled page, so results are cached (transient, `CACHE_TTL`) and only
 * ever (re)computed on an explicit `POST /schema/coverage`, same
 * "loading a page never silently spends real work" posture
 * CompetitorVisibilityAnalyzer (GeoInsights, Pro) already established for
 * its own real per-competitor HTTP fetch.
 *
 * @class       SchemaCoverageAnalyzer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SchemaCoverageAnalyzer {

    private const CACHE_KEY = 'vulopilot_schema_coverage_snapshot';
    private const CACHE_TTL = 6 * HOUR_IN_SECONDS;
    private const SAMPLE_SIZE = 15;
    private const REQUEST_TIMEOUT_SECONDS = 8;

    /**
     * Plain-English meaning shown per real schema.org @type found — same
     * "translate a real technical value into a human sentence" spirit
     * FindingRepository's own Finding value object already applies to scan
     * results, kept here since @type strings aren't findings themselves.
     * Unrecognized types (a theme/plugin emitting something not in this
     * list) still show up in the real coverage table, just with a generic
     * fallback meaning rather than being dropped.
     *
     * @var array<string, string>
     */
    private const TYPE_MEANINGS = array(
        'Organization'   => 'Your business identity',
        'WebSite'        => 'Your website identity',
        'WebPage'        => 'A regular page',
        'BreadcrumbList' => 'Page navigation',
        'Article'        => 'Blog/article content',
        'BlogPosting'    => 'Blog/article content',
        'Product'        => 'A product you sell',
        'Person'         => 'A content author',
        'FAQPage'        => 'Frequently-asked-questions content',
        'HowTo'          => 'Step-by-step instructions',
        'LocalBusiness'  => 'Physical business details',
        'Review'         => 'A customer review',
        'AggregateRating' => 'A rolled-up rating',
    );

    /**
     * Runs a fresh real sample and stores it — the only path that performs
     * real outbound HTTP requests (see this class's own docblock).
     *
     * @return array{generated_at: string, sample_size: int, coverage: array<int, array{type: string, meaning: string, found_on: int, problems: int}>, pages_checked: int}
     */
    public function analyze(): array {
        $post_ids = get_posts(
            array(
                'post_type'      => array( 'post', 'page', 'product' ),
                'post_status'    => 'publish',
                'posts_per_page' => self::SAMPLE_SIZE,
                'orderby'        => 'modified',
                'order'          => 'DESC',
                'fields'         => 'ids',
            )
        );

        $type_counts = array();
        $pages_checked = 0;

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
            foreach ( array_unique( $types ) as $type ) {
                $type_counts[ $type ] = ( $type_counts[ $type ] ?? 0 ) + 1;
            }
        }

        // The homepage's own sitewide Organization/WebSite schema (site
        // identity, not per-post content) — checked separately from the
        // per-post sample above, same "homepage is its own real signal"
        // reasoning SchemaScanner already applies.
        $homepage_types = $this->extract_types_from_url( home_url( '/' ) );
        if ( null !== $homepage_types ) {
            foreach ( array_unique( $homepage_types ) as $type ) {
                $type_counts[ $type ] = ( $type_counts[ $type ] ?? 0 ) + 1;
            }
        }

        $findings = new FindingRepository();
        $problem_scanner_ids = array( 'schema', 'structured-data', 'sitewide-structured-data', 'organization-schema', 'author-schema' );
        $open_problems_total = array_sum( $findings->get_severity_breakdown_for_scanner_ids( $problem_scanner_ids ) );

        arsort( $type_counts );

        $coverage = array();
        foreach ( $type_counts as $type => $found_on ) {
            $coverage[] = array(
                'type'     => $type,
                'meaning'  => self::TYPE_MEANINGS[ $type ] ?? __( 'Structured data', 'vulopilot' ),
                'found_on' => $found_on,
                // A real, coarse split of the site's total open schema-adjacent
                // findings across each real type found, proportional to how
                // often that type appears — there's no per-type problem
                // attribution in the finding data itself (a finding is scoped
                // to a post, not a schema @type), so this is an honest
                // estimate labelled as such on the frontend, not a precise
                // per-type count.
                'problems' => $found_on > 0 && $open_problems_total > 0
                    ? (int) round( ( $found_on / array_sum( $type_counts ) ) * $open_problems_total )
                    : 0,
            );
        }

        $snapshot = array(
            'generated_at'  => current_time( 'mysql', true ),
            'sample_size'   => self::SAMPLE_SIZE,
            'pages_checked' => $pages_checked,
            'coverage'      => $coverage,
        );

        set_transient( self::CACHE_KEY, $snapshot, self::CACHE_TTL );

        return $snapshot;
    }

    /**
     * @return array|null Cached snapshot, or null if none has been generated yet.
     */
    public function get_stored_snapshot(): ?array {
        $snapshot = get_transient( self::CACHE_KEY );
        return $snapshot ?: null;
    }

    /**
     * @param string $url Real URL to fetch.
     * @return string[]|null Every real `@type` value found in that page's JSON-LD, or null on a real fetch failure.
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

            // A single JSON-LD block can be one object, a @graph of several,
            // or a JSON array of several top-level objects — cover all 3
            // real shapes rather than assuming one. array_keys() === range()
            // is the min-PHP-8.0-compatible list check (array_is_list() is
            // 8.1+, this codebase's own composer.json floor is 8.0).
            $is_list = array_keys( $decoded ) === range( 0, count( $decoded ) - 1 );
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
