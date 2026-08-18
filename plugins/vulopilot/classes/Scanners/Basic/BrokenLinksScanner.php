<?php
/**
 * BrokenLinksScanner class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;


use VuloPilot\Contracts\Scanner\TracksScannedObjectsInterface;
use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * Extracts links from the most recently published posts/pages and checks
 * each one for a non-2xx/3xx HTTP response, flagging ones that appear
 * broken.
 *
 * Bounded on two axes deliberately (posts scanned, and total links
 * checked) — an unbounded crawl of the entire site's content on every
 * scan run is exactly the kind of unbounded operation performance.md
 * warns against, and would make a single scan run take arbitrarily long
 * on a large site. A HEAD request that returns a non-2xx/3xx status is
 * treated as broken; a small number of servers reject HEAD requests
 * outright (405) even though the URL is fine — that's a known,
 * accepted false-positive source for this first-pass check, not
 * something this pass tries to fully eliminate.
 *
 * Every Finding carries a real `meta.reason` ('broken' vs 'unverified' —
 * see check_link()'s own docblock) and every genuine run persists real
 * per-run coverage stats to STATS_OPTION — both added so
 * BrokenLinksTab.tsx's own "Broken links"/"Couldn't verify"/"Coverage"/
 * "Link health" tiles could be built from real numbers instead of either
 * fabricating them or leaving them out, per direct instruction.
 *
 * @class       BrokenLinksScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class BrokenLinksScanner extends AbstractBasicScanner implements TracksScannedObjectsInterface {

    use ScannedPostsTrait;

    private const POSTS_BATCH_SIZE        = 20;
    private const MAX_LINKS_PER_RUN       = 40;
    private const REQUEST_TIMEOUT_SECONDS = 5;

    /**
     * Stores when this scanner last genuinely ran — see due_to_run()'s
     * own docblock for why this scanner self-rate-limits instead of the
     * cadence being scheduled externally.
     */
    private const LAST_RUN_OPTION = 'vulopilot_broken_links_last_checked';

    /**
     * Real per-run coverage stats (pages scanned/links checked/healthy
     * count this run) — Controllers\BrokenLinksStats reads this directly
     * for BrokenLinksTab.tsx's own real "Coverage"/"Link health" tiles.
     * Nothing here is derived/estimated: every field is a plain count of
     * what this exact run actually did, overwritten (not accumulated)
     * each time `scan()` genuinely executes a check.
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
    public function scan(): array {
        $settings = wp_parse_args( get_option( \VuloPilot\Utill::VULOPILOT_SETTINGS_KEY, array() ), \VuloPilot\Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['flag_broken_links'] ) ) {
            return array();
        }

        if ( ! $this->due_to_run( (string) ( $settings['broken_link_check_frequency'] ?? 'daily' ) ) ) {
            return array();
        }

        $findings      = array();
        $links         = $this->extract_links_from_recent_content();
        $healthy_count = 0;

        foreach ( $links as $url => $post_id ) {
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
                (string) $post_id,
                array(
                    'url'    => $url,
                    // 'unverified' — a network/timeout/DNS failure
                    // (is_wp_error()); could genuinely be a fine link on a
                    // slow/unreachable-from-this-server host, not
                    // necessarily broken. 'broken' — a real HTTP response
                    // that just wasn't 2xx/3xx. BrokenLinksTab.tsx's own
                    // "Broken links" vs "Couldn't verify" tiles are this
                    // field, not a guess.
                    'reason' => $result['reason'],
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
     * Pulls every http(s) link out of the most recently published
     * content, deduped, capped at MAX_LINKS_PER_RUN.
     *
     * @return array<string, int> URL => the post ID it was found in.
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

            if ( ! preg_match_all( '/<a\s[^>]*href=["\']([^"\']+)["\']/i', $post->post_content, $matches ) ) {
                continue;
            }

            foreach ( $matches[1] as $url ) {
                if ( count( $links ) >= self::MAX_LINKS_PER_RUN ) {
                    break;
                }

                if ( 0 !== strpos( $url, 'http://' ) && 0 !== strpos( $url, 'https://' ) ) {
                    continue;
                }

                if ( ! isset( $links[ $url ] ) ) {
                    $links[ $url ] = $post->ID;
                }
            }
        }

        return $links;
    }

    /**
     * Self-rate-limits against Scanning → SEO's own "Broken link check
     * frequency" setting — this codebase's scan scheduling is one shared
     * cadence (`scan_frequency`, Utill.php), not a per-scanner cron, so a
     * scanner that wants a slower cadence than the shared one has to skip
     * its own check on the runs it isn't due, rather than the scan
     * runner scheduling it separately. A WP option (not a transient,
     * which can be evicted early under object-cache pressure on some
     * hosts) records the last time this scanner genuinely ran.
     *
     * @param string $frequency 'daily' or 'weekly'.
     * @return bool True if this run should actually check links.
     */
    private function due_to_run( string $frequency ): bool {
        $interval_seconds = 'weekly' === $frequency ? WEEK_IN_SECONDS : DAY_IN_SECONDS;
        $last_ran         = (int) get_option( self::LAST_RUN_OPTION, 0 );

        if ( ( time() - $last_ran ) < $interval_seconds ) {
            return false;
        }

        update_option( self::LAST_RUN_OPTION, time(), false );

        return true;
    }

    /**
     * @param string $url URL to check.
     * @return array{reason: string, detail: string}|null 'reason' is 'unverified' (network/timeout/DNS failure — is_wp_error()) or 'broken' (a real non-2xx/3xx HTTP response); null if the link looks fine.
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
