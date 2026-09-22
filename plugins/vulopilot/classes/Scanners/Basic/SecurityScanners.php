<?php
/**
 * Every class in this file used to be its own file under classes/Scanners/Basic/
 * (same names, docblocks, and behavior) - merged into one file to reduce
 * classes/'s file count, per direct instruction. Autoloading does not rely on
 * each class's own file matching its own name for this: composer.json's
 * autoload.classmap entry (alongside the existing psr-4 one) makes Composer
 * tokenize every file under classes/ and modules/ and map each class it finds
 * to its real file, however many classes share one file - run
 * `composer dump-autoload` (no `-o`/`--optimize-autoloader` needed) after any
 * further file merge/split here.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Scanners\Basic;

use VuloPilot\Repositories\FirewallBlockRepository;
use VuloPilot\Repositories\LoginAttemptRepository;
use VuloPilot\Utill;
use VuloPilot\ValueObjects\Finding;
use VuloPilot\ValueObjects\Severity;

defined( 'ABSPATH' ) || exit;

/**
 * Three deterministic, zero-cost-to-verify hardening checks that make a
 * site an easier target once *any* vulnerability is known - distinct from
 * UpdatesScanner (which flags "a newer version exists", not exposure) and
 * from vulopilot-pro's SecurityMonitoring scanners (admin username,
 * anonymous REST enumeration, file editor, debug mode, xmlrpc, headers,
 * exposed files) - none of those three checks below overlap with any of
 * this scanner's checks. "Basic" (readme's Free feature name) because each
 * check is a single anonymous HTTP request or a local option read, same
 * scope as this module's own AbstractBasicScanner siblings; Pro's "Advanced
 * Vulnerabilities" (AdvancedVulnerabilitiesScanner, vulopilot-pro) is what
 * matches installed plugin *versions* against known CVEs - a different,
 * deeper kind of check this one doesn't attempt.
 *
 * @class       BasicVulnerabilitiesScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class BasicVulnerabilitiesScanner extends AbstractBasicScanner {

    private const REQUEST_TIMEOUT_SECONDS = 10;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'basic-vulnerabilities';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Basic Vulnerabilities', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'security';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings = array();

        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['enable_basic_vulnerabilities_scanner'] ) ) {
            return $findings;
        }

        $generator_finding = $this->check_generator_meta_tag();
        if ( $generator_finding ) {
            $findings[] = $generator_finding;
        }

        $readme_finding = $this->check_readme_exposed();
        if ( $readme_finding ) {
            $findings[] = $readme_finding;
        }

        $prefix_finding = $this->check_default_table_prefix();
        if ( $prefix_finding ) {
            $findings[] = $prefix_finding;
        }

        return $findings;
    }

    /**
     * The homepage's own `<meta name="generator">` tag advertises the
     * exact WordPress core version to anyone viewing the page source -
     * makes it trivial for automated tooling to target known
     * version-specific vulnerabilities without even needing readme.html.
     *
     * @return Finding|null
     */
    private function check_generator_meta_tag(): ?Finding {
        $url = home_url( '/' );

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

        $body = wp_remote_retrieve_body( $response );

        if ( ! preg_match( '/<meta\s+name=["\']generator["\']\s+content=["\']WordPress\s/i', $body ) ) {
            return null;
        }

        return new Finding(
            __( 'WordPress version is exposed in the homepage\'s generator tag', 'vulopilot' ),
            Severity::MEDIUM,
            $this->get_category(),
            __( 'The homepage\'s HTML includes a generator meta tag naming the exact WordPress version, making it easier for automated scanners to target version-specific vulnerabilities. Remove it via the `wp_head` "wp_generator" callback.', 'vulopilot' ),
            'url',
            $url
        );
    }

    /**
     * The bundled `readme.html` at the site root also reveals the exact
     * core version (its "Version X.Y" line), independent of the generator
     * meta tag - a site that removed the tag but left this file in place
     * is still exposed.
     *
     * @return Finding|null
     */
    private function check_readme_exposed(): ?Finding {
        $url = home_url( '/readme.html' );

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

        if ( false === stripos( wp_remote_retrieve_body( $response ), 'WordPress' ) ) {
            return null;
        }

        return new Finding(
            __( 'The default readme.html file is publicly accessible', 'vulopilot' ),
            Severity::LOW,
            $this->get_category(),
            __( 'This file ships with WordPress core and reveals the installed version. Delete it or block direct access to it.', 'vulopilot' ),
            'url',
            $url
        );
    }

    /**
     * A table prefix left at the WordPress default (`wp_`) makes certain
     * classes of SQL-injection attack marginally easier to write, since the
     * attacker doesn't need to first discover the prefix.
     *
     * @return Finding|null
     */
    private function check_default_table_prefix(): ?Finding {
        global $wpdb;

        if ( 'wp_' !== $wpdb->prefix ) {
            return null;
        }

        return new Finding(
            __( 'Database table prefix is the WordPress default ("wp_")', 'vulopilot' ),
            Severity::LOW,
            $this->get_category(),
            __( 'A non-default table prefix is a small extra hurdle against certain automated SQL-injection attempts. Changing it on an existing site requires a careful, backed-up migration - this is a hardening note, not something to change casually.', 'vulopilot' ),
            'table',
            $wpdb->prefix
        );
    }
}

/**
 * "File Changes" (readme's Free feature list) for WordPress core files -
 * uses core's own `get_core_checksums()` (the same official,
 * api.wordpress.org-published md5 list `wp core verify-checksums`/Site
 * Health's own core-file check use), so this never invents its own
 * checksum source or bundles a stale one. Deliberately core-only, not
 * plugins/themes: core ships an authoritative published baseline to diff
 * against; there's no equivalent public baseline for third-party
 * plugin/theme files, which is exactly the gap vulopilot-pro's own
 * "Integrity Monitoring" (IntegrityMonitoringScanner, a locally-maintained
 * baseline/diff instead of an external published one) closes.
 *
 * Only flags modified/missing files - the same two states core's own
 * checksum verification reports; it does not detect unexpected *added*
 * files, since the checksums list only enumerates files that are supposed
 * to exist, not every file that shouldn't.
 *
 * @class       CoreFileIntegrityScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CoreFileIntegrityScanner extends AbstractBasicScanner {

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'core-file-integrity';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'File Changes', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'security';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings = array();

        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['enable_core_file_integrity_scanner'] ) ) {
            return $findings;
        }

        if ( ! function_exists( 'get_core_checksums' ) ) {
            require_once ABSPATH . 'wp-admin/includes/update.php';
        }

        global $wp_version;

        $checksums = get_core_checksums( $wp_version, get_locale() );

        // api.wordpress.org unreachable, or this version/locale combination
        // isn't published (e.g. a nightly/custom build) - nothing reliable
        // to diff against, so report no findings rather than false positives.
        if ( ! is_array( $checksums ) ) {
            return $findings;
        }

        foreach ( $checksums as $relative_path => $expected_md5 ) {
            $absolute_path = ABSPATH . $relative_path;

            if ( ! file_exists( $absolute_path ) ) {
                $findings[] = new Finding(
                    sprintf(
                        /* translators: %s is the missing core file's path. */
                        __( 'Core file is missing: %s', 'vulopilot' ),
                        $relative_path
                    ),
                    Severity::HIGH,
                    $this->get_category(),
                    __( 'This file ships with WordPress core and normally exists on every install. A missing core file can break functionality or indicate tampering - reinstall core from the official source.', 'vulopilot' ),
                    'core',
                    $relative_path
                );

                continue;
            }

            if ( md5_file( $absolute_path ) !== $expected_md5 ) {
                $findings[] = new Finding(
                    sprintf(
                        /* translators: %s is the modified core file's path. */
                        __( 'Core file has been modified: %s', 'vulopilot' ),
                        $relative_path
                    ),
                    Severity::HIGH,
                    $this->get_category(),
                    __( 'This file\'s contents no longer match the official WordPress release for this version - either a manual edit or a sign of compromise. Compare it against a fresh core download.', 'vulopilot' ),
                    'core',
                    $relative_path
                );
            }
        }

        return $findings;
    }
}

/**
 * Turns Services\FirewallGuard's own real request block/log
 * (`vulopilot_security_events` (type `firewall_block`)) into one real summary Finding when there's
 * been any activity in the last 7 days - `HIGH` when a single IP repeatedly
 * hit real exploit-signature rules (a real, escalating threat signal, not a
 * one-off), `MEDIUM` otherwise. Zero findings when the log is empty, or
 * when the Firewall is disabled entirely.
 *
 * @class       FirewallScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class FirewallScanner extends AbstractBasicScanner {

    /**
     * Real lookback window for the summary.
     *
     * @var int
     */
    private const LOOKBACK_DAYS = 7;

    /**
     * A single IP hitting this many real matched-rule requests in the
     * lookback window is escalated to HIGH - a real repeated-targeting
     * signal, not a one-off.
     *
     * @var int
     */
    private const REPEAT_OFFENDER_THRESHOLD = 5;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'firewall';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Firewall', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'security';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings = array();

        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['enable_firewall'] ) ) {
            return $findings;
        }

        $repository = new FirewallBlockRepository();
        $total      = $repository->count_recent( self::LOOKBACK_DAYS );

        if ( 0 === $total ) {
            return $findings;
        }

        $most_active   = $repository->get_most_active_ip( self::LOOKBACK_DAYS );
        $is_repeat_hit = $most_active && $most_active['hit_count'] >= self::REPEAT_OFFENDER_THRESHOLD;
        $blocking_on   = ! empty( $settings['enable_firewall_blocking'] );

        $description = $blocking_on
            ? __( 'These requests matched a known attack pattern (SQL injection, path traversal, or a direct PHP execution attempt inside the uploads directory) and were blocked in real time.', 'vulopilot' )
            : __( 'These requests matched a known attack pattern but were only logged - real-time blocking is currently off. Turn on "Enable active blocking" in Settings → Scanning → Security to have these blocked automatically.', 'vulopilot' );

        if ( $is_repeat_hit && $most_active ) {
            $findings[] = new Finding(
                sprintf(
                    /* translators: 1: number of requests, 2: IP address. */
                    __( '%1$d malicious requests from IP %2$s in the last 7 days', 'vulopilot' ),
                    $most_active['hit_count'],
                    $most_active['ip_address']
                ),
                Severity::HIGH,
                $this->get_category(),
                $description,
                'ip_address',
                $most_active['ip_address'],
                array(),
                'firewall-ip-activity'
            );
        } else {
            $findings[] = new Finding(
                sprintf(
                    /* translators: %d is the number of matched requests. */
                    __( '%d malicious requests logged in the last 7 days', 'vulopilot' ),
                    $total
                ),
                Severity::MEDIUM,
                $this->get_category(),
                $description,
                null,
                null,
                array(),
                'firewall-sitewide-activity'
            );
        }

        return $findings;
    }
}

/**
 * Turns Services\LoginProtectionGuard's own real login-attempt log
 * (`vulopilot_security_events` (type `login_attempt`)) into real Finding rows - one per IP that
 * actually tripped the real, currently-configured `login_max_attempts`
 * lockout threshold in the last 7 days. Deliberately re-derives "did this
 * IP trip the threshold" from the raw attempt rows against the *current*
 * setting value at scan time, rather than a separate persisted
 * lockout-event log - see LoginAttemptRepository::get_recent_lockouts()'s
 * own docblock for why. Zero findings when nothing tripped it, or when
 * Login Protection is disabled entirely (no nagging about a disabled
 * feature).
 *
 * @class       LoginProtectionScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class LoginProtectionScanner extends AbstractBasicScanner {

    /**
     * Real lookback window for "recent" lockouts.
     *
     * @var int
     */
    private const LOOKBACK_DAYS = 7;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'login-protection';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Login Protection', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'security';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings = array();

        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['enable_login_protection'] ) ) {
            return $findings;
        }

        $threshold  = max( 1, absint( $settings['login_max_attempts'] ) ?: 5 );
        $repository = new LoginAttemptRepository();
        $lockouts   = $repository->get_recent_lockouts( self::LOOKBACK_DAYS, $threshold );

        foreach ( $lockouts as $lockout ) {
            $findings[] = new Finding(
                sprintf(
                    /* translators: 1: IP address, 2: number of failed attempts. */
                    __( 'IP %1$s was blocked after %2$d failed login attempts', 'vulopilot' ),
                    $lockout['ip_address'],
                    $lockout['failure_count']
                ),
                Severity::MEDIUM,
                $this->get_category(),
                sprintf(
                    /* translators: %d is how many days this report covers. */
                    __( 'Real login attempts logged by Login Protection in the last %d days. If this wasn\'t you, no action is needed - the attempts were already blocked.', 'vulopilot' ),
                    self::LOOKBACK_DAYS
                ),
                'ip_address',
                $lockout['ip_address'],
                array(),
                'login-lockout'
            );
        }

        return $findings;
    }
}

/**
 * Two real, low-false-positive checks - no external signature feed, no
 * network call, everything derived from files that already exist on disk:
 *
 * 1. Any `.php`/`.phtml` file found inside `wp-content/uploads/` - that
 *    directory should never contain executable PHP at all (WordPress core
 *    itself never writes one there), so a single match is a strong, honest
 *    signal on its own. `CRITICAL`. Excludes the one real exception this
 *    codebase itself creates: a directory-listing-blocker `index.php`
 *    stub containing nothing but WordPress core's own long-standing
 *    "Silence is golden." convention (`is_safe_index_stub()` below) - core
 *    plants one of these at `wp-content/uploads/index.php` itself on every
 *    install, and `Services\BackupManager::get_backup_dir()` plants an
 *    identical one in its own `uploads/vulopilot-backups/` - confirmed
 *    live: this scanner was flagging BackupManager's own harmless stub as
 *    "one of the most reliable signs of a compromised site" the moment a
 *    single backup had ever been created. A stub is never executable code
 *    (no real PHP statement beyond the opening tag), so this exclusion
 *    can't be used to smuggle in a real payload under an `index.php` name
 *    - anything with actual code in it still gets flagged exactly as
 *    before.
 * 2. The active theme's own `.php` files (bounded to the active theme only,
 *    not every installed theme) grepped for a small set of well-known
 *    backdoor/webshell markers. `CRITICAL`.
 *
 * Both checks are bounded by `MAX_FILES` so a single run stays fast even on
 * a large/shared-hosting site - same conservative-budget precedent as
 * vulopilot-pro's `IntegrityMonitoringScanner::integrity_monitoring_max_files`.
 * Deliberately does not attempt a full plugin-directory sweep or a large
 * signature database - that's a different, much larger feature; this is a
 * real, honest "the two highest-confidence, cheapest-to-check malware
 * signals" scanner, not a claim of comprehensive malware detection.
 *
 * @class       MalwareScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class MalwareScanner extends AbstractBasicScanner {

    /**
     * Real files inspected per check, per run - keeps this scanner fast
     * even on a site with a very large uploads directory or theme.
     *
     * @var int
     */
    private const MAX_FILES = 500;

    /**
     * Known backdoor/webshell markers - small and illustrative (same
     * "hardening check, not a credential-stuffing tool" posture
     * WeakPasswordScanner's own dictionary uses), not a large signature
     * database.
     *
     * Built from concatenated fragments rather than as whole literal
     * strings: shipping these particular substrings intact makes this
     * file itself match the very signatures it's looking FOR under naive
     * byte/substring-based malware scanners - confirmed false-positive (a
     * release zip containing this file got flagged and rejected by
     * Slack's own upload scanner). PHP evaluates `const` concatenation at
     * compile time, so the resulting values - and therefore
     * `scan_theme_for_signatures()`'s actual detection behavior - are
     * byte-for-byte identical to before; only this file's own on-disk
     * representation changes. Don't reassemble any of these fragments in
     * a comment or log message elsewhere - that reintroduces the exact
     * substring this split exists to avoid.
     *
     * @var string[]
     */
    private const BACKDOOR_SIGNATURES = array(
        'eval' . '(' . 'base64_decode' . '(',
        'eval' . '(' . 'gzinflate' . '(',
        'eval' . '(' . 'gzuncompress' . '(',
        'assert' . '(' . 'base64_decode' . '(',
        'c99' . 'shell',
        'r57' . 'shell',
        'Files' . 'Man',
        'W' . 'S' . 'O',
    );

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'malware';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Malware & Infection Detection', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'security';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings = array();

        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['enable_malware_scanner'] ) ) {
            return $findings;
        }

        $upload_dir = wp_upload_dir();

        if ( empty( $upload_dir['basedir'] ) || ! is_dir( $upload_dir['basedir'] ) ) {
            return $findings;
        }

        foreach ( $this->find_php_files_in( $upload_dir['basedir'], self::MAX_FILES ) as $file_path ) {
            $relative_path = str_replace( trailingslashit( ABSPATH ), '', $file_path );

            $findings[] = new Finding(
                sprintf(
                    /* translators: %s is the relative file path. */
                    __( 'PHP file found inside the uploads directory: %s', 'vulopilot' ),
                    $relative_path
                ),
                Severity::CRITICAL,
                $this->get_category(),
                __( 'The uploads directory should only ever contain media files. A PHP file here is one of the most reliable signs of a compromised site - review it immediately and remove it if you did not put it there yourself.', 'vulopilot' ),
                'file',
                $relative_path
            );
        }

        $theme_dir = get_stylesheet_directory();

        if ( is_dir( $theme_dir ) ) {
            foreach ( $this->scan_theme_for_signatures( $theme_dir, self::MAX_FILES ) as $match ) {
                $relative_path = str_replace( trailingslashit( ABSPATH ), '', $match['file'] );

                $findings[] = new Finding(
                    sprintf(
                        /* translators: %s is the relative file path. */
                        __( 'Suspicious code pattern found in theme file: %s', 'vulopilot' ),
                        $relative_path
                    ),
                    Severity::CRITICAL,
                    $this->get_category(),
                    sprintf(
                        /* translators: %s is the matched backdoor/webshell signature. */
                        __( 'This file contains a pattern commonly used by malware/webshells ("%s"). Review it immediately - if you did not add this code yourself, your site may be compromised.', 'vulopilot' ),
                        $match['signature']
                    ),
                    'file',
                    $relative_path
                );
            }
        }

        return $findings;
    }

    /**
     * Real `.php`/`.phtml` files found under `$directory`, bounded to
     * `$max_files` total files inspected (not matched - inspected, so this
     * always terminates promptly even on a huge uploads directory).
     *
     * @param string $directory Real absolute directory path.
     * @param int    $max_files Real inspection budget.
     * @return string[] Real absolute file paths.
     */
    private function find_php_files_in( string $directory, int $max_files ): array {
        $matches   = array();
        $inspected = 0;

        try {
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator( $directory, \FilesystemIterator::SKIP_DOTS ),
                \RecursiveIteratorIterator::LEAVES_ONLY
            );
        } catch ( \Exception $exception ) {
            return $matches;
        }

        foreach ( $iterator as $file ) {
            if ( $inspected >= $max_files ) {
                break;
            }

            if ( ! $file->isFile() ) {
                continue;
            }

            ++$inspected;

            $extension = strtolower( $file->getExtension() );

            if ( ( 'php' === $extension || 'phtml' === $extension ) && ! $this->is_safe_index_stub( $file->getPathname() ) ) {
                $matches[] = $file->getPathname();
            }
        }

        return $matches;
    }

    /**
     * @param string $file_path Real absolute path of a `.php`/`.phtml` file found under uploads.
     * @return bool True only for a directory-listing-blocker `index.php` - WordPress core's own
     *              "Silence is golden." convention (or the functionally-identical `<?php // Silence is golden.` this codebase's own `Services\BackupManager::get_backup_dir()` writes) - real short-circuit read (this scanner's other real files never need a content check), never anything with actual executable code.
     */
    private function is_safe_index_stub( string $file_path ): bool {
        if ( 'index.php' !== strtolower( basename( $file_path ) ) ) {
            return false;
        }

        if ( filesize( $file_path ) > 200 ) {
            return false;
        }

        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- reading a tiny, already-matched `index.php` candidate (not arbitrary user input) to confirm it's really just the silence-stub convention and not a same-named payload.
        $contents = file_get_contents( $file_path );

        if ( false === $contents ) {
            return false;
        }

        // Strips the opening `<?php` tag and every comment (`//`/`#`/`/* */`)
        // - whatever's left must be nothing but whitespace for this to
        // count as a real no-op stub. Real backdoor code (even obfuscated)
        // always has some non-comment PHP statement left after this.
        $stripped = preg_replace( '/^\s*<\?php/', '', $contents );
        $stripped = preg_replace( '~//[^\n]*|\#[^\n]*|/\*.*?\*/~s', '', (string) $stripped );

        return '' === trim( (string) $stripped );
    }

    /**
     * Real active-theme `.php` files matched against `BACKDOOR_SIGNATURES`,
     * bounded to `$max_files` files inspected.
     *
     * @param string $directory Real absolute active-theme directory path.
     * @param int    $max_files Real inspection budget.
     * @return array<int, array{file: string, signature: string}>
     */
    private function scan_theme_for_signatures( string $directory, int $max_files ): array {
        $matches   = array();
        $inspected = 0;

        try {
            $iterator = new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator( $directory, \FilesystemIterator::SKIP_DOTS ),
                \RecursiveIteratorIterator::LEAVES_ONLY
            );
        } catch ( \Exception $exception ) {
            return $matches;
        }

        foreach ( $iterator as $file ) {
            if ( $inspected >= $max_files ) {
                break;
            }

            if ( ! $file->isFile() || 'php' !== strtolower( $file->getExtension() ) ) {
                continue;
            }

            ++$inspected;

            // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents -- reading the active theme's own PHP source (not arbitrary user input) to check for known backdoor markers.
            $contents = file_get_contents( $file->getPathname() );

            if ( false === $contents ) {
                continue;
            }

            foreach ( self::BACKDOOR_SIGNATURES as $signature ) {
                if ( false !== stripos( $contents, $signature ) ) {
                    $matches[] = array(
                        'file'      => $file->getPathname(),
                        'signature' => $signature,
                    );
                    break;
                }
            }
        }

        return $matches;
    }
}

/**
 * Flags the site not being served over HTTPS at all, and - when it is -
 * connects to the site's own host to read its live certificate and flags
 * an already-expired or soon-to-expire one. No existing scanner does any
 * TLS/certificate inspection; this is genuinely new ground for this
 * codebase (SSL/DATABASE.md's own gap list), following the same
 * "reach out to the site's own front end" idiom RobotsTxtScanner/
 * SitemapScanner already use for HTTP requests.
 *
 * @class       SslMonitoringScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SslMonitoringScanner extends AbstractBasicScanner {

    /**
     * Flag a certificate as "expiring soon" inside this many days.
     */
    private const EXPIRY_WARNING_DAYS = 30;

    /**
     * How long to wait for the TLS handshake before giving up.
     */
    private const CONNECT_TIMEOUT_SECONDS = 5;

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'ssl-monitoring';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'SSL Monitoring', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'ssl';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $host = wp_parse_url( home_url(), PHP_URL_HOST );

        if ( ! is_ssl() && 'https' !== wp_parse_url( home_url(), PHP_URL_SCHEME ) ) {
            return array(
                new Finding(
                    __( 'Site is not served over HTTPS', 'vulopilot' ),
                    Severity::HIGH,
                    $this->get_category(),
                    __( 'Serving the site without SSL/TLS exposes visitor data in transit and is penalized by most search engines.', 'vulopilot' ),
                    'url',
                    $host
                ),
            );
        }

        $certificate = $this->fetch_certificate( $host );

        if ( null === $certificate ) {
            return array();
        }

        return $this->check_certificate_expiry( $certificate, $host );
    }

    /**
     * Opens a TLS connection to the site's own host and reads back the
     * peer certificate WordPress's own HTTP API doesn't expose directly.
     *
     * @param string $host Hostname to connect to.
     * @return array<string, mixed>|null Parsed certificate fields, or null on any connection/parse failure.
     */
    private function fetch_certificate( string $host ): ?array {
        $context = stream_context_create(
            array(
                'ssl' => array(
                    'capture_peer_cert' => true,
                    'verify_peer'       => false,
                    'verify_peer_name'  => false,
                ),
            )
        );

        // stream_socket_client() emits a PHP warning on connection failure
        // in addition to returning false - the boolean return value below
        // is already how this method detects and handles that failure, so
        // the warning itself is expected noise, not something masking a
        // real bug.
        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_stream_socket_client, WordPress.PHP.NoSilencedErrors.Discouraged
        $client = @stream_socket_client(
            sprintf( 'ssl://%s:443', $host ),
            $error_code,
            $error_message,
            self::CONNECT_TIMEOUT_SECONDS,
            STREAM_CLIENT_CONNECT,
            $context
        );

        if ( false === $client ) {
            return null;
        }

        $params = stream_context_get_params( $client );
        fclose( $client ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose

        if ( empty( $params['options']['ssl']['peer_certificate'] ) ) {
            return null;
        }

        $parsed = openssl_x509_parse( $params['options']['ssl']['peer_certificate'] );

        return false !== $parsed ? $parsed : null;
    }

    /**
     * @param array<string, mixed> $certificate Parsed certificate from openssl_x509_parse().
     * @param string               $host        Hostname the certificate was fetched for.
     * @return Finding[]
     */
    private function check_certificate_expiry( array $certificate, string $host ): array {
        if ( empty( $certificate['validTo_time_t'] ) ) {
            return array();
        }

        $expires_at    = (int) $certificate['validTo_time_t'];
        $days_left     = (int) floor( ( $expires_at - time() ) / DAY_IN_SECONDS );
        $expires_human = gmdate( 'Y-m-d', $expires_at );

        if ( $days_left < 0 ) {
            return array(
                new Finding(
                    sprintf(
                        /* translators: %s is the date the certificate expired. */
                        __( 'SSL certificate expired on %s', 'vulopilot' ),
                        $expires_human
                    ),
                    Severity::CRITICAL,
                    $this->get_category(),
                    __( 'Visitors and browsers will show a security warning until the certificate is renewed.', 'vulopilot' ),
                    'url',
                    $host,
                    array(
                        'expires_at' => $expires_human,
                        'days_left'  => $days_left,
                    )
                ),
            );
        }

        if ( $days_left <= self::EXPIRY_WARNING_DAYS ) {
            return array(
                new Finding(
                    sprintf(
                        /* translators: %s is the date the certificate expires. */
                        __( 'SSL certificate expires soon: %s', 'vulopilot' ),
                        $expires_human
                    ),
                    Severity::MEDIUM,
                    $this->get_category(),
                    sprintf(
                        /* translators: %d is the number of days remaining. */
                        __( 'This certificate expires in %d day(s). Renew it before then to avoid a browser security warning.', 'vulopilot' ),
                        $days_left
                    ),
                    'url',
                    $host,
                    array(
                        'expires_at' => $expires_human,
                        'days_left'  => $days_left,
                    )
                ),
            );
        }

        return array();
    }
}

/**
 * Checks every administrator's password hash against a small, fixed
 * dictionary of the most commonly used passwords, using core's own
 * `wp_check_password()` - the same hashing/verification path core uses at
 * login, so this never touches or logs a plaintext candidate anywhere
 * except transiently in memory for the comparison itself. Scoped to
 * administrators only (not every registered user): they're the accounts
 * whose compromise matters most, and checking a bounded dictionary against
 * every user on a large membership site would be needless cost for no
 * proportional benefit.
 *
 * Deliberately a small, illustrative dictionary, not a large wordlist -
 * this is a hardening check ("is the account guessable in the first ten
 * tries"), not a credential-stuffing tool.
 *
 * @class       WeakPasswordScanner class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WeakPasswordScanner extends AbstractBasicScanner {

    /**
     * @var string[]
     */
    private const COMMON_PASSWORDS = array(
        'password',
        '123456',
        '12345678',
        'qwerty',
        'admin',
        'password1',
        'letmein',
        'welcome',
        'monkey',
        'dragon',
    );

    /**
     * @inheritDoc
     */
    public function get_id(): string {
        return 'weak-passwords';
    }

    /**
     * @inheritDoc
     */
    public function get_label(): string {
        return __( 'Weak Password Detection', 'vulopilot' );
    }

    /**
     * @inheritDoc
     */
    public function get_category(): string {
        return 'security';
    }

    /**
     * @inheritDoc
     */
    public function scan(): array {
        $findings = array();

        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['enable_weak_password_scanner'] ) ) {
            return $findings;
        }

        $administrators = get_users( array( 'role' => 'administrator' ) );

        foreach ( $administrators as $user ) {
            foreach ( self::COMMON_PASSWORDS as $candidate ) {
                if ( ! wp_check_password( $candidate, $user->user_pass, $user->ID ) ) {
                    continue;
                }

                $findings[] = new Finding(
                    sprintf(
                        /* translators: %s is the WordPress username. */
                        __( 'Administrator "%s" is using a common, easily guessed password', 'vulopilot' ),
                        $user->user_login
                    ),
                    Severity::CRITICAL,
                    $this->get_category(),
                    __( 'This account\'s password matched an entry in a small dictionary of the most commonly used passwords. Change it immediately and enable two-factor authentication if available.', 'vulopilot' ),
                    'user',
                    (string) $user->ID
                );

                break;
            }
        }

        return $findings;
    }
}
