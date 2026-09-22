<?php
/**
 * Every class in this file used to be its own file under classes/Services/
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

namespace VuloPilot\Services;

use VuloPilot\AiCopilot\Actions\GenerateLandingPageAction;
use VuloPilot\AiCopilot\Actions\GenerateSchemaAction;
use VuloPilot\Repositories\FindingRepository;
use VuloPilot\Seo\Scanners\StructuredDataValidationScanner;
use VuloPilot\Utill;
use VuloPilot\ValueObjects\ScanResult;

defined( 'ABSPATH' ) || exit;

/**
 * Scanning → SEO's "Add canonical URL tags" toggle - the mechanical fix
 * behind Seo\Scanners\CanonicalUrlScanner's finding. That scanner's own
 * docblock explains WordPress core already outputs a canonical tag by
 * default (`rel_canonical()` on `wp_head`); its absence almost always
 * means a theme has removed `wp_head()` entirely or a caching/
 * optimization plugin is stripping head tags - something this plugin
 * can't safely repair in the theme/other-plugin's own code. What it CAN
 * safely do is add its own, independent canonical tag as a backup, so the
 * page has one regardless of what stripped core's. Same "wrap a safety
 * net around a WP-core behavior" shape as SitemapManager/RobotsTxtManager,
 * just for a tag instead of a route.
 *
 * Defaults OFF (Utill::VULOPILOT_SETTINGS_DEFAULTS) since most sites don't
 * need this - core's own tag already covers them; this exists specifically
 * for the site that doesn't, discoverable either from Settings → SEO
 * directly or via vulopilot-pro's OneClickFix "Fix" action on this
 * scanner's finding.
 *
 * Self-registers its own hook in the constructor (php-wordpress.md) and
 * is constructed unconditionally in VuloPilot::init_classes() - the
 * `canonical_url_enabled` setting gates OUTPUT, not construction, same as
 * SitemapManager/RobotsTxtManager.
 *
 * @class       CanonicalUrlManager class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CanonicalUrlManager {

    /**
     * CanonicalUrlManager constructor.
     */
    public function __construct() {
        add_action( 'wp_head', array( $this, 'maybe_output_canonical' ), 5 );

        // The post-editor metabox's Advanced tab canonical override - this
        // filters WP core's OWN wp_get_canonical_url()/rel_canonical()
        // output directly, so a per-post override always takes effect
        // regardless of the canonical_url_enabled setting above (that
        // setting only gates this class's OWN safety-net tag for sites
        // where core's canonical is missing entirely; an explicit per-post
        // override is a deliberate human action, not something that should
        // silently no-op because a separate, unrelated toggle is off).
        add_filter( 'get_canonical_url', array( $this, 'maybe_override_canonical' ), 10, 2 );
    }

    /**
     * Substitutes the post-editor metabox's per-post canonical override, if one is set.
     *
     * @param string   $canonical_url Core's own resolved canonical URL.
     * @param \WP_Post $post          The post being resolved.
     * @return string
     */
    public function maybe_override_canonical( string $canonical_url, \WP_Post $post ): string {
        $override = get_post_meta( $post->ID, PostSeoMetaFields::META_KEYS['canonical_url'], true );

        return $override ? $override : $canonical_url;
    }

    /**
     * Outputs the safety-net canonical tag on wp_head, if the setting is enabled.
     *
     * @return void
     */
    public function maybe_output_canonical(): void {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['canonical_url_enabled'] ) ) {
            return;
        }

        $url = $this->get_canonical_url();

        if ( ! $url ) {
            return;
        }

        echo '<link rel="canonical" href="' . esc_url( $url ) . '" />' . "\n";
    }

    /**
     * Resolves the canonical URL for the current singular/front-page request.
     *
     * @return string|null
     */
    private function get_canonical_url(): ?string {
        if ( is_singular() ) {
            $permalink = get_permalink( get_queried_object_id() );
            return $permalink ? $permalink : null;
        }

        if ( is_front_page() || is_home() ) {
            return home_url( '/' );
        }

        return null; // Archives/search/404 - core's own rel_canonical() already skips these too.
    }
}

/**
 * Outputs the `vulopilot_homepage_schema_json` option on `wp_head` for the
 * front page - the sitewide counterpart to Services\SchemaJsonLdRenderer's
 * per-post `_vulopilot_schema_json`. Distinct because Seo\Scanners\SchemaScanner/
 * StructuredDataValidationScanner both check `home_url('/')` specifically,
 * which isn't always a single post (a "latest posts" front page has no
 * one post to attach schema to), so this is a dedicated option rather than
 * postmeta - populated by vulopilot-pro's OneClickFix
 * `generate-homepage-schema` mechanical fix (MechanicalFixRunner), not by
 * any settings-screen field.
 *
 * No settings gate: like SchemaJsonLdRenderer, there's nothing to output
 * until the option actually has content, so construction is unconditional
 * and the hook is a no-op until then. Runs alongside SchemaJsonLdRenderer
 * without conflict - a static front page can legitimately have both its
 * own per-post schema (e.g. Article) AND this sitewide WebSite schema
 * output at once; multiple JSON-LD blocks per page is normal.
 *
 * @class       HomepageSchemaRenderer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class HomepageSchemaRenderer {

    /**
     * HomepageSchemaRenderer constructor.
     */
    public function __construct() {
        add_action( 'wp_head', array( $this, 'maybe_output_schema' ) );
    }

    /**
     * Outputs the stored homepage schema as JSON-LD, if the front page and set.
     *
     * @return void
     */
    public function maybe_output_schema(): void {
        if ( ! is_front_page() ) {
            return;
        }

        $schema_json = get_option( 'vulopilot_homepage_schema_json', '' );

        if ( '' === $schema_json ) {
            return;
        }

        $decoded = json_decode( (string) $schema_json, true );

        if ( ! is_array( $decoded ) ) {
            return;
        }

        echo '<script type="application/ld+json">' . wp_json_encode( $decoded ) . '</script>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- wp_json_encode() of a value this class itself constructed/validated, same pattern as SchemaJsonLdRenderer's own output.
    }
}

/**
 * Stateless on-page SEO checklist for the post-editor metabox
 * (RestAPI\Controllers\PostSeo::analyze_item()), grouped into
 * "Basic SEO"/"Additional"/"Title Readability". Deliberately NOT a
 * Scanners\ScannerRegistry scanner: runs against whatever the editor
 * currently holds (unsaved edits included) on every field change, not
 * against saved posts on a schedule. Thresholds that mirror an existing
 * scanner reuse that scanner's constant/setting rather than duplicating
 * the number.
 *
 * `fixable`/`action_id` is only set for checks with a real AIAction that
 * takes nothing but a post_id - checks driven by focus keyword or content
 * structure have no such action, so they're reported as not fixable.
 *
 * @class       OnPageAnalyzer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class OnPageAnalyzer {

    /**
     * Matches SeoScanner::TITLE_MIN_LENGTH/TITLE_MAX_LENGTH and
     * WriteMetaTitleAction::MIN_LENGTH/MAX_LENGTH.
     */
    private const TITLE_MIN_LENGTH = 10;
    private const TITLE_MAX_LENGTH = 60;

    /**
     * Reuses WriteMetaDescriptionAction::MAX_LENGTH (160) as the upper
     * bound rather than inventing a second number.
     */
    private const DESCRIPTION_MIN_LENGTH = 120;
    private const DESCRIPTION_MAX_LENGTH = 160;

    /**
     * Words from the start of the content the focus keyword should appear
     * within for the "keyword in first paragraph" check - an editorial
     * analogue of GeoSummaryBlockScanner's `ai_visibility_scans.answer_first.min_words`
     * setting, kept as its own constant since it checks keyword placement,
     * not an AI-summary marker.
     */
    private const FIRST_PARAGRAPH_WORDS = 100;

    /**
     * Runs every check against the editor's current (possibly unsaved)
     * field values.
     *
     * @param array<string, string> $fields Live editor state - 'title', 'content', 'excerpt', 'slug', 'focus_keyword' - not necessarily what's saved in the DB.
     * @return array<int, array<string, mixed>> Each entry shaped like result()'s own return value.
     */
    public function analyze( array $fields ): array {
        $title         = trim( (string) ( $fields['title'] ?? '' ) );
        $content_html  = (string) ( $fields['content'] ?? '' );
        $content_text  = trim( wp_strip_all_tags( $content_html ) );
        $excerpt       = trim( (string) ( $fields['excerpt'] ?? '' ) );
        $slug          = (string) ( $fields['slug'] ?? '' );
        $focus_keyword = trim( (string) ( $fields['focus_keyword'] ?? '' ) );

        $results = array();

        $results[] = $this->check_title_length( $title );
        $results[] = $this->check_description_length( $excerpt );
        $results[] = $this->check_content_length( $content_text );
        $results[] = $this->check_subheadings( $content_html );
        $results[] = $this->check_links( $content_html );
        $results[] = $this->check_image_alt( $content_html );

        if ( '' !== $focus_keyword ) {
            $results[] = $this->check_keyword_in_title( $focus_keyword, $title );
            $results[] = $this->check_keyword_in_description( $focus_keyword, $excerpt );
            $results[] = $this->check_keyword_in_slug( $focus_keyword, $slug );
            $results[] = $this->check_keyword_in_content( $focus_keyword, $content_text );
            $results[] = $this->check_keyword_in_first_paragraph( $focus_keyword, $content_text );
            $results[] = $this->check_keyword_at_title_start( $focus_keyword, $title );
        }

        $results[] = $this->check_title_has_number( $title );

        return $results;
    }

    /**
     * Checks the SEO title's length against SeoScanner/WriteMetaTitleAction's own thresholds.
     *
     * @param string $title Current post title.
     * @return array<string, mixed>
     */
    private function check_title_length( string $title ): array {
        $length = mb_strlen( $title );

        if ( 0 === $length ) {
            return $this->result( 'title_length', 'basic', 'fail', __( 'SEO title is empty.', 'vulopilot' ), 'write-meta-title' );
        }

        if ( $length < self::TITLE_MIN_LENGTH ) {
            return $this->result( 'title_length', 'basic', 'warning', __( 'SEO title is too short - search engines may show more than this.', 'vulopilot' ), 'write-meta-title' );
        }

        if ( $length > self::TITLE_MAX_LENGTH ) {
            return $this->result( 'title_length', 'basic', 'warning', __( 'SEO title may be truncated in search results.', 'vulopilot' ), 'write-meta-title' );
        }

        return $this->result( 'title_length', 'basic', 'pass', __( 'SEO title length is good.', 'vulopilot' ) );
    }

    /**
     * Checks the meta description's length against the recommended window.
     *
     * @param string $excerpt Current post excerpt (this codebase's meta description field, see MetaDescriptionScanner).
     * @return array<string, mixed>
     */
    private function check_description_length( string $excerpt ): array {
        $length = mb_strlen( $excerpt );

        if ( 0 === $length ) {
            return $this->result( 'description_length', 'basic', 'fail', __( 'Meta description is empty.', 'vulopilot' ), 'write-meta-description' );
        }

        if ( $length < self::DESCRIPTION_MIN_LENGTH ) {
            return $this->result( 'description_length', 'basic', 'warning', __( 'Meta description is shorter than the recommended length.', 'vulopilot' ), 'write-meta-description' );
        }

        if ( $length > self::DESCRIPTION_MAX_LENGTH ) {
            return $this->result( 'description_length', 'basic', 'warning', __( 'Meta description may be truncated in search results.', 'vulopilot' ), 'write-meta-description' );
        }

        return $this->result( 'description_length', 'basic', 'pass', __( 'Meta description length is good.', 'vulopilot' ) );
    }

    /**
     * Checks the content's word count against the thin-content threshold setting.
     *
     * @param string $content_text Plain-text content.
     * @return array<string, mixed>
     */
    private function check_content_length( string $content_text ): array {
        $settings  = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
        $threshold = absint( $settings['thin_content_word_threshold'] );
        $count     = str_word_count( $content_text );

        if ( $count < $threshold ) {
            return $this->result(
                'content_length',
                'basic',
                'warning',
                sprintf(
                    /* translators: 1: current word count, 2: minimum recommended word count. */
                    __( 'Content is %1$d words - aim for at least %2$d.', 'vulopilot' ),
                    $count,
                    $threshold
                ),
                'improve-readability'
            );
        }

        return $this->result( 'content_length', 'basic', 'pass', __( 'Content length is good.', 'vulopilot' ) );
    }

    /**
     * Checks whether the focus keyword appears in the SEO title.
     *
     * @param string $keyword Focus keyword.
     * @param string $title   Current post title.
     * @return array<string, mixed>
     */
    private function check_keyword_in_title( string $keyword, string $title ): array {
        // Deliberately not wired to 'write-meta-title' - see this class's
        // own docblock: that action takes no focus_keyword input (only
        // post_id, PostSeoFixRest::ACTION_ALLOWLIST), so running it
        // wouldn't reliably fix THIS check at all, just rewrite the title
        // for general length/SEO quality with no guarantee the keyword
        // ends up in it. A prior version of this method incorrectly set
        // action_id here, making "Fix with AI" change the title without
        // actually resolving the keyword-missing problem it was shown
        // next to.
        return $this->contains( $keyword, $title )
            ? $this->result( 'keyword_in_title', 'basic', 'pass', __( 'Focus keyword found in the SEO title.', 'vulopilot' ) )
            : $this->result( 'keyword_in_title', 'basic', 'fail', __( 'Focus keyword is missing from the SEO title.', 'vulopilot' ) );
    }

    /**
     * Checks whether the focus keyword appears in the meta description.
     *
     * @param string $keyword Focus keyword.
     * @param string $excerpt Current meta description.
     * @return array<string, mixed>
     */
    private function check_keyword_in_description( string $keyword, string $excerpt ): array {
        return $this->contains( $keyword, $excerpt )
            ? $this->result( 'keyword_in_description', 'basic', 'pass', __( 'Focus keyword found in the meta description.', 'vulopilot' ) )
            : $this->result( 'keyword_in_description', 'basic', 'fail', __( 'Focus keyword is missing from the meta description.', 'vulopilot' ) );
    }

    /**
     * Checks whether the focus keyword appears in the URL slug.
     *
     * @param string $keyword Focus keyword.
     * @param string $slug    Post slug.
     * @return array<string, mixed>
     */
    private function check_keyword_in_slug( string $keyword, string $slug ): array {
        return $this->contains( $keyword, str_replace( '-', ' ', $slug ) )
            ? $this->result( 'keyword_in_slug', 'basic', 'pass', __( 'Focus keyword found in the URL.', 'vulopilot' ) )
            : $this->result( 'keyword_in_slug', 'basic', 'warning', __( 'Focus keyword is missing from the URL.', 'vulopilot' ) );
    }

    /**
     * Checks whether the focus keyword appears anywhere in the content.
     *
     * @param string $keyword      Focus keyword.
     * @param string $content_text Plain-text content.
     * @return array<string, mixed>
     */
    private function check_keyword_in_content( string $keyword, string $content_text ): array {
        return $this->contains( $keyword, $content_text )
            ? $this->result( 'keyword_in_content', 'basic', 'pass', __( 'Focus keyword found in the content.', 'vulopilot' ) )
            : $this->result( 'keyword_in_content', 'basic', 'fail', __( 'Focus keyword is missing from the content.', 'vulopilot' ) );
    }

    /**
     * Checks whether the focus keyword appears within the opening words of the content.
     *
     * @param string $keyword      Focus keyword.
     * @param string $content_text Plain-text content.
     * @return array<string, mixed>
     */
    private function check_keyword_in_first_paragraph( string $keyword, string $content_text ): array {
        $words = preg_split( '/\s+/', $content_text );
        $lead  = implode( ' ', array_slice( is_array( $words ) ? $words : array(), 0, self::FIRST_PARAGRAPH_WORDS ) );

        return $this->contains( $keyword, $lead )
            ? $this->result( 'keyword_in_first_paragraph', 'additional', 'pass', __( 'Focus keyword appears early in the content.', 'vulopilot' ) )
            : $this->result( 'keyword_in_first_paragraph', 'additional', 'warning', __( 'Focus keyword does not appear in the opening paragraph.', 'vulopilot' ) );
    }

    /**
     * Checks whether the content has any h2-h6 subheadings.
     *
     * @param string $content_html Raw post content (blocks/HTML).
     * @return array<string, mixed>
     */
    private function check_subheadings( string $content_html ): array {
        return (bool) preg_match( '/<h[2-6][\s>]/i', $content_html )
            ? $this->result( 'has_subheadings', 'additional', 'pass', __( 'Content has subheadings.', 'vulopilot' ) )
            : $this->result( 'has_subheadings', 'additional', 'warning', __( 'Content has no subheadings - breaking it up improves readability and scannability.', 'vulopilot' ), 'add-subheadings' );
    }

    /**
     * Checks whether the content contains at least one link.
     *
     * @param string $content_html Raw post content.
     * @return array<string, mixed>
     */
    private function check_links( string $content_html ): array {
        return (bool) preg_match( '/<a\s[^>]*href=/i', $content_html )
            ? $this->result( 'has_links', 'additional', 'pass', __( 'Content contains at least one link.', 'vulopilot' ) )
            : $this->result( 'has_links', 'additional', 'warning', __( 'Content has no links - linking to related content or sources helps both readers and search engines.', 'vulopilot' ) );
    }

    /**
     * Checks whether every image in the content has alt text.
     *
     * @param string $content_html Raw post content.
     * @return array<string, mixed>
     */
    private function check_image_alt( string $content_html ): array {
        if ( ! preg_match_all( '/<img\s[^>]*>/i', $content_html, $images ) ) {
            return $this->result( 'image_alt', 'additional', 'pass', __( 'No images in this content.', 'vulopilot' ) );
        }

        foreach ( $images[0] as $image_tag ) {
            if ( ! preg_match( '/alt=["\'][^"\']+["\']/i', $image_tag ) ) {
                return $this->result( 'image_alt', 'additional', 'fail', __( 'One or more images are missing alt text.', 'vulopilot' ) );
            }
        }

        return $this->result( 'image_alt', 'additional', 'pass', __( 'All images have alt text.', 'vulopilot' ) );
    }

    /**
     * Checks whether the focus keyword appears near the start of the title.
     *
     * @param string $keyword Focus keyword.
     * @param string $title   Current post title.
     * @return array<string, mixed>
     */
    private function check_keyword_at_title_start( string $keyword, string $title ): array {
        $half = mb_substr( $title, 0, (int) ceil( mb_strlen( $title ) / 2 ) );

        return $this->contains( $keyword, $half )
            ? $this->result( 'keyword_at_title_start', 'title_readability', 'pass', __( 'Focus keyword appears near the beginning of the title.', 'vulopilot' ) )
            : $this->result( 'keyword_at_title_start', 'title_readability', 'warning', __( 'Focus keyword appears late in the title - titles rank slightly better with it near the start.', 'vulopilot' ) );
    }

    /**
     * Titles with a number (a year, a count, "7 ways to…") measurably
     * get more clicks.
     *
     * @param string $title Current post title.
     * @return array<string, mixed>
     */
    private function check_title_has_number( string $title ): array {
        return (bool) preg_match( '/\d/', $title )
            ? $this->result( 'title_has_number', 'title_readability', 'pass', __( 'Title contains a number.', 'vulopilot' ) )
            : $this->result( 'title_has_number', 'title_readability', 'warning', __( 'Consider adding a number to the title (e.g. a year or a count) - these tend to attract more clicks.', 'vulopilot' ) );
    }

    /**
     * Case-insensitive substring match, not word-boundary, since a focus
     * keyword is often a multi-word phrase.
     *
     * @param string $keyword  Focus keyword.
     * @param string $haystack Text to search within.
     * @return bool
     */
    private function contains( string $keyword, string $haystack ): bool {
        return '' !== $keyword && false !== stripos( $haystack, $keyword );
    }

    /**
     * Builds one checklist entry in the shape every check above returns.
     *
     * @param string      $id        Stable check id the frontend keys UI state on.
     * @param string      $group     'basic'|'additional'|'title_readability'.
     * @param string      $status    'pass'|'warning'|'fail'.
     * @param string      $message   Human-readable explanation.
     * @param string|null $action_id AIActions id that can fix this, if any.
     * @return array<string, mixed>
     */
    private function result( string $id, string $group, string $status, string $message, ?string $action_id = null ): array {
        return array(
            'id'        => $id,
            'group'     => $group,
            'status'    => $status,
            'message'   => $message,
            'fixable'   => null !== $action_id,
            'action_id' => $action_id,
        );
    }
}

/**
 * Registers the post-editor metabox's own postmeta fields via
 * `register_post_meta( ..., 'show_in_rest' => true )` rather than a
 * bespoke REST controller for reading/writing them - this makes every
 * field here ride along with the Block Editor's own native Save/Update
 * button (`wp/v2/posts|pages/{id}`'s `meta` property, read/written from
 * the sidebar via `wp.data.select('core/editor').getEditedPostAttribute(
 * 'meta' )`/`editPost({ meta })`), so undo/redo, autosave, and revisions
 * all already work without this plugin reimplementing any of them.
 *
 * `META_KEYS` is the single source of truth for the literal postmeta
 * strings - Services\CanonicalUrlManager/SocialMetaTagsManager/
 * PostRobotsMetaManager (which read these same keys to actually affect
 * frontend output) and Services\PostEditorAssets (which localizes this
 * same map to the editor's JS bundle) all reference it rather than each
 * holding their own copy.
 *
 * @class       PostSeoMetaFields class
 * @version     1.0.0
 * @author      VuloLabs
 */
class PostSeoMetaFields {

    /**
     * Postmeta key strings, keyed by field name.
     *
     * @var array<string, string>
     */
    public const META_KEYS = array(
        'focus_keyword'      => '_vulopilot_focus_keyword',
        'canonical_url'      => '_vulopilot_canonical_url',
        'robots_noindex'     => '_vulopilot_robots_noindex',
        'robots_nofollow'    => '_vulopilot_robots_nofollow',
        'social_title'       => '_vulopilot_social_title',
        'social_description' => '_vulopilot_social_description',
        'social_image_id'    => '_vulopilot_social_image_id',
        'schema_type'        => '_vulopilot_schema_type',
    );

    /**
     * Post types the metabox appears on - matches
     * AiCopilot\Actions\WriteMetaTitleAction/WriteMetaDescriptionAction's
     * own post-type scope. `product` (WooCommerce) was added alongside the
     * metabox's move to a real below-content `add_meta_box()` panel
     * (Services\PostEditorAssets::register_metabox()), which references
     * this same constant rather than holding its own separate copy - every
     * other real SEO/GEO/AI-Action scanner and action in this codebase
     * still only scopes to `post`/`page` (a much larger, separate change,
     * not part of this pass), so a product's fields/AI-fix buttons work
     * through this metabox, but it isn't scored by the wider SEO scan
     * suite yet.
     *
     * @var string[]
     */
    public const POST_TYPES = array( 'post', 'page', 'product' );

    /**
     * PostSeoMetaFields constructor.
     */
    public function __construct() {
        add_action( 'init', array( $this, 'register_meta_fields' ) );
    }

    /**
     * Registers every metabox field for both 'post' and 'page' post types.
     *
     * @return void
     */
    public function register_meta_fields(): void {
        foreach ( self::POST_TYPES as $post_type ) {
            register_post_meta(
                $post_type,
                self::META_KEYS['focus_keyword'],
                $this->string_field_args()
            );

            register_post_meta(
                $post_type,
                self::META_KEYS['canonical_url'],
                $this->string_field_args( 'esc_url_raw' )
            );

            register_post_meta( $post_type, self::META_KEYS['robots_noindex'], $this->boolean_field_args() );
            register_post_meta( $post_type, self::META_KEYS['robots_nofollow'], $this->boolean_field_args() );

            register_post_meta( $post_type, self::META_KEYS['social_title'], $this->string_field_args() );
            register_post_meta( $post_type, self::META_KEYS['social_description'], $this->string_field_args() );
            register_post_meta( $post_type, self::META_KEYS['social_image_id'], $this->integer_field_args() );
            register_post_meta( $post_type, self::META_KEYS['schema_type'], $this->string_field_args() );

            // GenerateSchemaAction's own meta key, registered here too so
            // the Schema tab's manual JSON textarea rides the same native
            // save button as every other field - the sanitize callback
            // re-encodes through json_decode/wp_json_encode so a stored
            // value is always either valid JSON or empty, never
            // arbitrary text mangled by sanitize_text_field's tag-stripping.
            register_post_meta(
                $post_type,
                GenerateSchemaAction::META_KEY,
                $this->string_field_args(
                    static function ( $value ) {
                        $decoded = json_decode( (string) $value, true );

                        return is_array( $decoded ) ? wp_json_encode( $decoded ) : '';
                    }
                )
            );
        }

        // GenerateLandingPageAction's own meta key - 'page'-only (it
        // always creates a `page`, never a `post`), unlike the loop
        // above's fields which apply to both.
        register_post_meta(
            'page',
            GenerateLandingPageAction::META_KEY,
            $this->boolean_field_args()
        );
    }

    /**
     * Shared register_post_meta() args for every plain-string field.
     *
     * @param callable|string $sanitize_callback Defaults to sanitize_text_field.
     * @return array<string, mixed>
     */
    private function string_field_args( $sanitize_callback = 'sanitize_text_field' ): array {
        return array(
            'type'              => 'string',
            'single'            => true,
            'default'           => '',
            'show_in_rest'      => true,
            'sanitize_callback' => $sanitize_callback,
            'auth_callback'     => array( $this, 'can_edit_post' ),
        );
    }

    /**
     * Shared register_post_meta() args for the two robots toggle fields.
     *
     * @return array<string, mixed>
     */
    private function boolean_field_args(): array {
        return array(
            'type'          => 'boolean',
            'single'        => true,
            'default'       => false,
            'show_in_rest'  => true,
            'auth_callback' => array( $this, 'can_edit_post' ),
        );
    }

    /**
     * The register_post_meta() args for the social image attachment id field.
     *
     * @return array<string, mixed>
     */
    private function integer_field_args(): array {
        return array(
            'type'          => 'integer',
            'single'        => true,
            'default'       => 0,
            'show_in_rest'  => true,
            'auth_callback' => array( $this, 'can_edit_post' ),
        );
    }

    /**
     * The auth_callback every register_post_meta() call above passes -
     * REST-exposed metadata defaults to requiring `edit_post`-equivalent
     * capability checks per field; this is that check, explicit rather
     * than relying on core's own default so every field here is
     * consistently gated.
     *
     * @param bool   $allowed Whether the value is allowed to be edited.
     * @param string $meta_key Meta key.
     * @param int    $post_id  Post id.
     * @return bool
     */
    public function can_edit_post( bool $allowed, string $meta_key, int $post_id ): bool {
        return current_user_can( 'edit_post', $post_id );
    }
}

/**
 * Real per-page JSON-LD sampling for the restyled Schema tab's own "Schema
 * Coverage" table - a deterministic structural check (fetch each sampled
 * page's real rendered HTML, extract `<script type="application/ld+json">`
 * blocks the same way StructuredDataValidationScanner already does for the
 * homepage, decode each block's real `@type`), not an AI call, so there's
 * no per-call cost or rate limit to worry about the way
 * GeoInsights\VisibilitySnapshotBuilder's own AI-scored sample has
 * (Pro, vulopilot-pro) - but it is still real outbound HTTP work per
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

    private const CACHE_KEY               = 'vulopilot_schema_coverage_snapshot';
    private const CACHE_TTL               = 6 * HOUR_IN_SECONDS;
    private const SAMPLE_SIZE             = 15;
    private const REQUEST_TIMEOUT_SECONDS = 8;

    /**
     * Plain-English meaning shown per real schema.org @type found - same
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
     * Regenerates the coverage snapshot whenever the schema scanner
     * finishes - i.e. as part of any "Run scan" that includes schema - so
     * the Schema Coverage table fills itself in without a separate button.
     * Hooked on `vulopilot_scan_completed` (fires once per scanner) and
     * keyed to the one `schema` scanner so it runs once per scan.
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
     * Settings → Developer Tools' "Clear cache" - same public
     * `clear_cache()` shape `Services\EntityExtractor` already establishes.
     *
     * @return void
     */
    public function clear_cache(): void {
        delete_transient( self::CACHE_KEY );
    }

    /**
     * Runs a fresh real sample and stores it - the only path that performs
     * real outbound HTTP requests (see this class's own docblock).
     *
     * @return array{generated_at: string, sample_size: int, coverage: array<int, array{type: string, meaning: string, found_on: int, problems: int, pages: array<int, array{id: int, title: string, url: string, edit_url: string|null}>}>, pages_checked: int, pages_with_valid_schema: int, pages_needing_attention: int}
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
        // Real, specific pages behind each type's `found_on` count -
        // "View pages" (StructuredDataSection.tsx) shows exactly these,
        // instead of the generic "go check the SEO tab" redirect it used
        // to be: a site owner can now see, per @type, precisely which
        // real page(s) actually carry it.
        $type_pages    = array();
        $pages_checked = 0;
        // A checked page "has valid schema" when at least one real
        // `application/ld+json` block with a real `@type` was actually
        // found on it - the "Schema Status" summary card's own
        // `pages_with_valid_schema`/`pages_needing_attention` tiles
        // (StructuredDataSection.tsx), a real per-PAGE pass/fail count,
        // distinct from `coverage`'s own per-TYPE `found_on`/`problems`
        // figures below.
        $pages_with_schema = 0;
        // Every checked page (with or without schema) - what clicking the
        // "Pages checked"/"Pages with valid schema"/"Need attention" stat
        // cards lists.
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
                'title'    => get_the_title( $post_id ) ?: $permalink,
                'url'      => $permalink,
                'edit_url' => current_user_can( 'edit_post', $post_id ) ? get_edit_post_link( $post_id, 'raw' ) : null,
            );

            $checked_pages[] = $page_entry + array( 'types' => array_values( array_unique( $types ) ) );

            foreach ( array_unique( $types ) as $type ) {
                $type_counts[ $type ]  = ( $type_counts[ $type ] ?? 0 ) + 1;
                $type_pages[ $type ][] = $page_entry;
            }
        }

        // The homepage's own sitewide Organization/WebSite schema (site
        // identity, not per-post content) - checked separately from the
        // per-post sample above, same "homepage is its own real signal"
        // reasoning SchemaScanner already applies. Counted into
        // `pages_checked`/`pages_with_schema` too now (it wasn't before):
        // the homepage genuinely is a real page this method just fetched
        // and inspected, so excluding it from "pages checked" undercounted
        // the very real work this method already does.
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
                // A real, coarse split of the site's total open schema-adjacent
                // findings across each real type found, proportional to how
                // often that type appears - there's no per-type problem
                // attribution in the finding data itself (a finding is scoped
                // to a post, not a schema @type), so this is an honest
                // estimate labelled as such on the frontend, not a precise
                // per-type count.
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
            // or a JSON array of several top-level objects - cover all 3
            // real shapes rather than assuming one. array_keys() === range()
            // is the min-PHP-8.0-compatible list check (array_is_list() is
            // 8.1+, this codebase's own composer.json floor is 8.0).
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

/**
 * Closes AiCopilot\Actions\GenerateSchemaAction's own documented gap:
 * that action only ever saved AI-generated JSON-LD to a postmeta key
 * (`_vulopilot_schema_json`) and said so itself - "Actually outputting
 * this JSON-LD on the frontend ... isn't built yet. This action's job
 * ends at saving valid schema data; rendering it is a separate, still-
 * needed piece." This class is that piece: it outputs whatever's saved
 * there as a real `<script type="application/ld+json">` tag on the
 * matching singular post/page, so a "Fix" via that action (or
 * vulopilot-pro's OneClickFix, e.g. for the sitewide-structured-data
 * scanner) actually resolves what a scanner checks for, not just writes
 * data nothing ever reads.
 *
 * No settings gate - unlike SitemapManager/RobotsTxtManager (which decide
 * whether to generate something site-wide), this only ever outputs
 * something a site owner (or an approved AI action) already explicitly
 * created for one specific post; there's nothing to output until that
 * postmeta exists.
 *
 * Self-registers its own hook in the constructor (php-wordpress.md) and
 * is constructed unconditionally in VuloPilot::init_classes().
 *
 * @class       SchemaJsonLdRenderer class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SchemaJsonLdRenderer {

    /**
     * Must match GenerateSchemaAction::META_KEY.
     */
    private const META_KEY = '_vulopilot_schema_json';

    /**
     * SchemaJsonLdRenderer constructor.
     */
    public function __construct() {
        add_action( 'wp_head', array( $this, 'maybe_output_schema' ) );
    }

    /**
     * @return void
     */
    public function maybe_output_schema(): void {
        if ( ! is_singular() ) {
            return;
        }

        $schema_json = get_post_meta( get_queried_object_id(), self::META_KEY, true );

        if ( '' === $schema_json || ! is_string( $schema_json ) ) {
            return;
        }

        $decoded = json_decode( $schema_json, true );

        if ( ! is_array( $decoded ) ) {
            return; // Malformed/edited-outside-the-action value - don't output invalid JSON-LD.
        }

        echo '<script type="application/ld+json">' . wp_json_encode( $decoded ) . '</script>' . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- wp_json_encode() output of a decoded structure, not raw user input.
    }
}

/**
 * Real single-page JSON-LD inspection for the "Schema & Knowledge" tab's
 * own Inspector section - a real `wp_remote_get()` of the requested page
 * plus the exact same `StructuredDataValidationScanner::extract_json_ld_blocks()`
 * extraction SchemaCoverageAnalyzer already uses for its own multi-page
 * sample (public+static specifically so this class can reuse it too - see
 * that method's own docblock), decoded the same `@graph`/list/object way
 * SchemaCoverageAnalyzer::extract_types_from_url() already does. No AI, no
 * fabricated data: every type/problem/preview field below is either
 * directly read off the real decoded JSON-LD or explicitly absent.
 *
 * @class       SchemaPageInspector class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SchemaPageInspector {

    private const REQUEST_TIMEOUT_SECONDS = 8;

    /**
     * Fields a real crawler/rich-results consumer expects for each @type -
     * StructuredDataValidationScanner only ever checks JSON *validity*, not
     * field presence, so this is genuinely new, not a duplicate of
     * anything already computed elsewhere.
     *
     * @var array<string, string[]>
     */
    private const EXPECTED_FIELDS = array(
        'Product'       => array( 'name', 'offers' ),
        'Organization'  => array( 'name', 'logo' ),
        'LocalBusiness' => array( 'name', 'address' ),
        'Article'       => array( 'headline', 'datePublished', 'author' ),
        'BlogPosting'   => array( 'headline', 'datePublished', 'author' ),
        'Review'        => array( 'reviewRating' ),
        'Person'        => array( 'name' ),
    );

    /**
     * @param string $url Real URL to fetch and inspect.
     * @return array{url: string, fetched_at: string, types: string[], blocks: array<int, array{index: int, type: string|null, raw: string}>, problems: array<int, array{type: string, block_index: int, field: string, message: string}>, conflicts: array<int, array{type: string, block_indexes: int[]}>, preview: array<string, mixed>|null}|null Null on a real fetch failure.
     */
    public function inspect( string $url ): ?array {
        $response = wp_remote_get(
            $url,
            array(
                'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
                'sslverify' => false,
            )
        );

        if ( is_wp_error( $response ) || 200 !== (int) wp_remote_retrieve_response_code( $response ) ) {
            return null;
        }

        $body       = wp_remote_retrieve_body( $response );
        $raw_blocks = StructuredDataValidationScanner::extract_json_ld_blocks( $body );
        $blocks_out = array();
        $types_seen = array();
        $problems   = array();
        $by_type    = array();
        $preview    = null;

        foreach ( $raw_blocks as $index => $raw_block ) {
            $decoded = json_decode( $raw_block, true );

            if ( JSON_ERROR_NONE !== json_last_error() || ! is_array( $decoded ) ) {
                $blocks_out[] = array(
                    'index' => $index,
                    'type'  => null,
                    'raw'   => $raw_block,
                );
                continue;
            }

            // Same 3 real shapes SchemaCoverageAnalyzer::extract_types_from_url()
            // already handles - a single object, a @graph of several, or a
            // JSON array of several top-level objects. array_keys() ===
            // range() is the min-PHP-8.0-compatible list check
            // (array_is_list() is 8.1+, this plugin's composer.json floor
            // is 8.0).
            $is_list    = array_keys( $decoded ) === range( 0, count( $decoded ) - 1 );
            $candidates = isset( $decoded['@graph'] ) && is_array( $decoded['@graph'] )
                ? $decoded['@graph']
                : ( $is_list ? $decoded : array( $decoded ) );

            $block_type = null;

            foreach ( $candidates as $candidate ) {
                if ( ! is_array( $candidate ) || empty( $candidate['@type'] ) ) {
                    continue;
                }

                foreach ( (array) $candidate['@type'] as $type ) {
                    if ( ! is_string( $type ) || '' === $type ) {
                        continue;
                    }

                    $block_type         = $block_type ?? $type;
                    $types_seen[]       = $type;
                    $by_type[ $type ][] = $index;

                    foreach ( self::EXPECTED_FIELDS[ $type ] ?? array() as $field ) {
                        if ( ! array_key_exists( $field, $candidate ) || '' === $candidate[ $field ] ) {
                            $problems[] = array(
                                'type'        => $type,
                                'block_index' => $index,
                                'field'       => $field,
                                'message'     => sprintf(
                                    /* translators: 1: schema.org field name, e.g. "offers", 2: schema.org @type, e.g. "Product". */
                                    __( '%1$s information missing from this page’s %2$s schema.', 'vulopilot' ),
                                    self::humanize_field( $field ),
                                    $type
                                ),
                            );
                        }
                    }

                    if ( null === $preview && in_array( $type, array( 'Product', 'Article', 'BlogPosting' ), true ) ) {
                        $preview = self::build_preview( $type, $candidate );
                    }
                }
            }

            $blocks_out[] = array(
                'index' => $index,
                'type'  => $block_type,
                'raw'   => $raw_block,
            );
        }

        $conflicts = array();
        foreach ( $by_type as $type => $indexes ) {
            if ( count( array_unique( $indexes ) ) > 1 ) {
                $conflicts[] = array(
                    'type'          => $type,
                    'block_indexes' => array_values( array_unique( $indexes ) ),
                );
            }
        }

        return array(
            'url'        => $url,
            'fetched_at' => current_time( 'mysql', true ),
            'types'      => array_values( array_unique( $types_seen ) ),
            'blocks'     => $blocks_out,
            'problems'   => $problems,
            'conflicts'  => $conflicts,
            'preview'    => $preview,
        );
    }

    /**
     * @param string $field e.g. 'offers'.
     * @return string e.g. 'Availability' - only the handful of fields this class actually checks need a mapping.
     */
    private static function humanize_field( string $field ): string {
        $labels = array(
            'name'          => __( 'Name', 'vulopilot' ),
            'offers'        => __( 'Price/availability', 'vulopilot' ),
            'logo'          => __( 'Logo', 'vulopilot' ),
            'address'       => __( 'Address', 'vulopilot' ),
            'headline'      => __( 'Headline', 'vulopilot' ),
            'datePublished' => __( 'Publish date', 'vulopilot' ),
            'author'        => __( 'Author', 'vulopilot' ),
            'reviewRating'  => __( 'Review rating', 'vulopilot' ),
        );

        return $labels[ $field ] ?? ucfirst( $field );
    }

    /**
     * Every field individually optional - a missing one is reported as
     * genuinely absent on the frontend, never backfilled with a
     * placeholder.
     *
     * @param string               $type      'Product'|'Article'|'BlogPosting'.
     * @param array<string, mixed> $candidate Decoded JSON-LD object.
     * @return array<string, mixed>
     */
    private static function build_preview( string $type, array $candidate ): array {
        $availability = null;
        $rating       = null;
        $rating_count = null;

        if ( 'Product' === $type && isset( $candidate['offers'] ) && is_array( $candidate['offers'] ) ) {
            $offers       = isset( $candidate['offers'][0] ) && is_array( $candidate['offers'][0] )
                ? $candidate['offers'][0]
                : $candidate['offers'];
            $availability = isset( $offers['availability'] ) && is_string( $offers['availability'] )
                ? basename( str_replace( 'http://schema.org/', '', $offers['availability'] ) )
                : null;
        }

        if ( isset( $candidate['aggregateRating'] ) && is_array( $candidate['aggregateRating'] ) ) {
            $rating       = isset( $candidate['aggregateRating']['ratingValue'] ) ? (float) $candidate['aggregateRating']['ratingValue'] : null;
            $rating_count = isset( $candidate['aggregateRating']['ratingCount'] ) ? (int) $candidate['aggregateRating']['ratingCount'] : null;
        }

        return array(
            'title'        => is_string( $candidate['name'] ?? null ) ? $candidate['name'] : ( is_string( $candidate['headline'] ?? null ) ? $candidate['headline'] : null ),
            'description'  => is_string( $candidate['description'] ?? null ) ? $candidate['description'] : null,
            'rating'       => $rating,
            'rating_count' => $rating_count,
            'availability' => $availability,
        );
    }
}

/**
 * Scanning → SEO's "Add Open Graph & Twitter Card tags" toggle - the
 * mechanical fix behind Seo\Scanners\OpenGraphScanner's and
 * TwitterCardScanner's findings, both of which only check the homepage
 * for og:title/og:description/og:image and twitter:card respectively.
 * This outputs those on every singular post/page too (not just the
 * homepage the scanners check), since the same missing-preview problem
 * affects every page a site owner might share, not only the front page.
 *
 * Defaults OFF (Utill::VULOPILOT_SETTINGS_DEFAULTS) since many sites
 * already have a theme or another plugin outputting these tags - this
 * exists specifically for the site that doesn't, discoverable either from
 * Settings → SEO directly or via vulopilot-pro's OneClickFix "Fix" action
 * on either scanner's finding. Doesn't attempt to detect an existing
 * og:/twitter: tag before adding its own (unlike RobotsTxtManager's
 * `Sitemap:` dedupe, checking rendered HTML from inside a `wp_head`
 * callback isn't practical without output buffering) - a site owner
 * turning this on is expected to have confirmed via the scanner that
 * nothing is outputting these today.
 *
 * Self-registers its own hook in the constructor (php-wordpress.md) and
 * is constructed unconditionally in VuloPilot::init_classes() - the
 * `social_meta_tags_enabled` setting gates OUTPUT, not construction, same
 * as SitemapManager/RobotsTxtManager/CanonicalUrlManager.
 *
 * @class       SocialMetaTagsManager class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SocialMetaTagsManager {

    /**
     * SocialMetaTagsManager constructor.
     */
    public function __construct() {
        add_action( 'wp_head', array( $this, 'maybe_output_tags' ), 5 );
    }

    /**
     * Outputs Open Graph/Twitter Card tags on wp_head, if enabled or overridden for this post.
     *
     * @return void
     */
    public function maybe_output_tags(): void {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
        $post_id  = is_singular() ? get_queried_object_id() : 0;

        // A per-post override from the post-editor metabox's Social tab
        // is a deliberate, explicit action for THAT post - it takes effect
        // even when the sitewide toggle is off, same posture
        // CanonicalUrlManager::maybe_override_canonical() already takes
        // for its own per-post override.
        if ( empty( $settings['social_meta_tags_enabled'] ) && ! ( $post_id && $this->has_post_override( $post_id ) ) ) {
            return;
        }

        $tags = $this->build_tags();

        if ( ! $tags ) {
            return;
        }

        foreach ( $tags as $property => $content ) {
            if ( '' === $content ) {
                continue;
            }

            $attribute = ( 0 === strpos( $property, 'twitter:' ) ) ? 'name' : 'property';

            echo '<meta ' . esc_attr( $attribute ) . '="' . esc_attr( $property ) . '" content="' . esc_attr( $content ) . '" />' . "\n";
        }
    }

    /**
     * Checks whether the post-editor metabox's Social tab has any override set for this post.
     *
     * @param int $post_id Post id.
     * @return bool
     */
    private function has_post_override( int $post_id ): bool {
        return (bool) get_post_meta( $post_id, PostSeoMetaFields::META_KEYS['social_title'], true )
            || (bool) get_post_meta( $post_id, PostSeoMetaFields::META_KEYS['social_description'], true )
            || (bool) get_post_meta( $post_id, PostSeoMetaFields::META_KEYS['social_image_id'], true );
    }

    /**
     * Builds the property/name => content map to output, or null off singular/home.
     *
     * @return array<string, string>|null
     */
    private function build_tags(): ?array {
        if ( is_singular() ) {
            $post_id           = get_queried_object_id();
            $override_image_id = absint( get_post_meta( $post_id, PostSeoMetaFields::META_KEYS['social_image_id'], true ) );
            $override_title    = get_post_meta( $post_id, PostSeoMetaFields::META_KEYS['social_title'], true );
            $override_excerpt  = get_post_meta( $post_id, PostSeoMetaFields::META_KEYS['social_description'], true );

            $title   = '' !== $override_title ? $override_title : get_the_title( $post_id );
            $excerpt = '' !== $override_excerpt ? $override_excerpt : get_the_excerpt( $post_id );
            $image   = $override_image_id ? wp_get_attachment_image_url( $override_image_id, 'large' ) : get_the_post_thumbnail_url( $post_id, 'large' );
        } elseif ( is_front_page() || is_home() ) {
            $title   = get_bloginfo( 'name' );
            $excerpt = get_bloginfo( 'description' );
            $image   = get_site_icon_url( 512 );
        } else {
            return null; // Archives/search/404 - same scope CanonicalUrlManager limits itself to.
        }

        $tags = array(
            'og:title'            => $title,
            'og:description'      => $excerpt,
            'twitter:card'        => $image ? 'summary_large_image' : 'summary',
            'twitter:title'       => $title,
            'twitter:description' => $excerpt,
        );

        if ( $image ) {
            $tags['og:image']      = $image;
            $tags['twitter:image'] = $image;
        }

        return $tags;
    }
}

/**
 * Scanning → SEO & Content → Tag Manager card's real backing - outputs
 * Google Tag Manager's own real two-part snippet: the `<script>` block on
 * `wp_head` and the `<noscript><iframe>` fallback immediately after the
 * opening `<body>` tag via `wp_body_open` (the real hook WordPress core
 * itself has shipped since 5.2 specifically for this purpose - no theme
 * template edit needed), same unconditional-construction/settings-gate-
 * output shape as WebmasterToolsManager/CanonicalUrlManager elsewhere in
 * this namespace.
 *
 * Self-registers its own hooks in the constructor (php-wordpress.md) and is
 * constructed unconditionally in VuloPilot::init_classes().
 *
 * @class       TagManagerService class
 * @version     1.0.0
 * @author      VuloLabs
 */
class TagManagerService {

    /**
     * TagManagerService constructor.
     */
    public function __construct() {
        add_action( 'wp_head', array( $this, 'maybe_output_head_script' ), 1 );
        add_action( 'wp_body_open', array( $this, 'maybe_output_body_noscript' ) );
    }

    /**
     * @return void
     */
    public function maybe_output_head_script(): void {
        $container_id = $this->get_container_id();

        if ( '' === $container_id ) {
            return;
        }

        printf(
            "<!-- Google Tag Manager -->\n<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':\n" .
            "new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],\n" .
            "j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=\n" .
            "'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);\n" .
            "})(window,document,'script','dataLayer','%s');</script>\n<!-- End Google Tag Manager -->\n",
            esc_js( $container_id )
        );
    }

    /**
     * @return void
     */
    public function maybe_output_body_noscript(): void {
        $container_id = $this->get_container_id();

        if ( '' === $container_id ) {
            return;
        }

        printf(
            '<!-- Google Tag Manager (noscript) --><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=%1$s" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript><!-- End Google Tag Manager (noscript) -->' . "\n",
            esc_attr( $container_id )
        );
    }

    /**
     * Real, trimmed GTM Container ID - empty when the toggle is off or no
     * id has been entered yet, the same "gate output, not construction"
     * posture WebmasterToolsManager's own per-provider codes already use.
     *
     * @return string
     */
    private function get_container_id(): string {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['tag_manager_enabled'] ) ) {
            return '';
        }

        return trim( (string) ( $settings['tag_manager_container_id'] ?? '' ) );
    }
}

/**
 * Settings → Site Identity → Title Formats' real backing - resolves
 * per-context `title_format_*`/`description_format_*` templates
 * (Utill::VULOPILOT_SETTINGS_DEFAULTS) against `%variable%` tokens and
 * outputs both the document `<title>` and a `<meta name="description">`
 * tag from the result, same "setting gates OUTPUT, not construction"
 * posture as CanonicalUrlManager/SocialMetaTagsManager.
 *
 * `pre_get_document_title` (not the older `wp_title` filter/action) is
 * core's own modern hook for the title - every theme built against
 * `wp_head()`/`_wp_render_title_tag()` since WP 4.4 already calls
 * `wp_get_document_title()`, which checks this filter first and, if a
 * non-empty string comes back, uses it verbatim instead of building its
 * own title from `wp_title()`/`get_bloginfo()`. That's exactly the
 * "replace, don't append" behavior a title-format feature needs. There is
 * no core equivalent filter for a description meta tag (core never
 * outputs one), so `maybe_output_description()` below just echoes
 * directly on `wp_head`, same shape `SocialMetaTagsManager`'s own
 * `wp_head` output already uses.
 *
 * For `post`/`page`, `description_format_*` is only ever a FALLBACK - a
 * real, non-empty `post_excerpt` (this codebase's already-established
 * "meta description" field; see Seo\Scanners\MetaDescriptionScanner's
 * own docblock and `WriteMetaDescriptionAction`, which both treat
 * `post_excerpt` as the real per-post description, not a bespoke postmeta
 * key) always wins when the current post/page actually has one.
 *
 * Self-registers its own hooks in the constructor (php-wordpress.md) and
 * is constructed unconditionally in VuloPilot::init_classes().
 *
 * @class       TitleFormatter class
 * @version     1.0.0
 * @author      VuloLabs
 */
class TitleFormatter {

    /**
     * `%variable%` token => resolver. Each resolver only ever runs for the
     * context it's actually relevant to (see `resolve_for_context()`) - a
     * template that references a variable outside its own context (e.g.
     * `%post_title%` inside `title_format_archive`) simply resolves that
     * token to an empty string, same "unknown/inapplicable token drops
     * silently" posture WebmasterToolsManager's own custom-tag parsing
     * uses for anything it doesn't recognize.
     *
     * @var array<string, callable>
     */
    private const VARIABLES = array(
        'site_title'       => array( __CLASS__, 'var_site_title' ),
        'site_description' => array( __CLASS__, 'var_site_description' ),
        'post_title'       => array( __CLASS__, 'var_current_title' ),
        'page_title'       => array( __CLASS__, 'var_current_title' ),
        'category_title'   => array( __CLASS__, 'var_current_title' ),
        'tag_title'        => array( __CLASS__, 'var_current_title' ),
        'search_term'      => array( __CLASS__, 'var_search_term' ),
        'archive_title'    => array( __CLASS__, 'var_current_title' ),
    );

    /**
     * TitleFormatter constructor.
     */
    public function __construct() {
        add_filter( 'pre_get_document_title', array( $this, 'maybe_filter_title' ), 5 );
        add_action( 'wp_head', array( $this, 'maybe_output_description' ), 5 );
    }

    /**
     * @param string $title Core's own already-resolved title (unused - this
     *                       either replaces it wholesale or returns it untouched).
     * @return string
     */
    public function maybe_filter_title( string $title ): string {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['site_identity_enabled'] ) || 'enabled' !== $settings['site_identity_enabled'] ) {
            return $title;
        }

        $context_key = $this->current_context_key();

        if ( ! $context_key ) {
            return $title; // 404s and any other context this feature doesn't cover - leave core's own title alone.
        }

        $template = trim( (string) ( $settings[ "title_format_{$context_key}" ] ?? '' ) );

        if ( '' === $template ) {
            return $title;
        }

        $resolved = $this->resolve( $template, $context_key, (string) ( $settings['title_separator'] ?? '|' ) );

        return '' !== $resolved ? $resolved : $title;
    }

    /**
     * Outputs `<meta name="description">` on `wp_head`, same
     * setting-gated/context-scoped posture as `maybe_filter_title()`
     * above - see this class's own top docblock for why `post`/`page`
     * defer to a real `post_excerpt` first.
     *
     * @return void
     */
    public function maybe_output_description(): void {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

        if ( empty( $settings['site_identity_enabled'] ) || 'enabled' !== $settings['site_identity_enabled'] ) {
            return;
        }

        $context_key = $this->current_context_key();

        if ( ! $context_key ) {
            return;
        }

        $content = '';

        if ( in_array( $context_key, array( 'post', 'page' ), true ) ) {
            $excerpt = trim( wp_strip_all_tags( get_the_excerpt() ) );

            if ( '' !== $excerpt ) {
                $content = $excerpt;
            }
        }

        if ( '' === $content ) {
            $template = trim( (string) ( $settings[ "description_format_{$context_key}" ] ?? '' ) );

            if ( '' !== $template ) {
                $content = $this->resolve( $template, $context_key, (string) ( $settings['title_separator'] ?? '|' ) );
            }
        }

        if ( '' === $content ) {
            return;
        }

        echo '<meta name="description" content="' . esc_attr( $content ) . '" />' . "\n";
    }

    /**
     * Resolves a template string against one context's own variable set -
     * also used by the Settings screen's live preview to stay a single
     * source of truth (Controllers\Settings::preview_title_formats()).
     *
     * @param string $template   Raw template, e.g. `%post_title% %sep% %site_title%`.
     * @param string $context    One of `home`/`post`/`page`/`category`/`tag`/`search`/`archive`.
     * @param string $separator  What `%sep%` itself resolves to.
     * @return string
     */
    public function resolve( string $template, string $context, string $separator ): string {
        $replacements = array( '%sep%' => $separator );

        foreach ( self::VARIABLES as $token => $resolver ) {
            $replacements[ "%{$token}%" ] = call_user_func( $resolver, $token, $context );
        }

        $resolved = strtr( $template, $replacements );

        // Collapse the empty-separator runs a template produces when one
        // of its own tokens resolves empty in this context (e.g.
        // `%site_description%` when the site tagline is blank) - same
        // "don't show a dangling separator" concern SnippetPreview.tsx's
        // own truncation already cares about for readability, just for
        // the opposite (too-short, not too-long) failure shape.
        $resolved = preg_replace( '/\s*' . preg_quote( $separator, '/' ) . '\s*$/', '', $resolved );
        $resolved = preg_replace( '/^\s*' . preg_quote( $separator, '/' ) . '\s*/', '', $resolved );

        return trim( (string) $resolved );
    }

    /**
     * @return string|null One of home/post/page/category/tag/search/archive, or null for anything else (404, embeds, ...).
     */
    private function current_context_key(): ?string {
        if ( is_front_page() || is_home() ) {
            return 'home';
        }

        if ( is_search() ) {
            return 'search';
        }

        if ( is_category() ) {
            return 'category';
        }

        if ( is_tag() ) {
            return 'tag';
        }

        if ( is_page() ) {
            return 'page';
        }

        if ( is_singular() ) {
            return 'post';
        }

        if ( is_archive() ) {
            return 'archive';
        }

        return null;
    }

    /**
     * @return string
     */
    private static function var_site_title(): string {
        return get_bloginfo( 'name' );
    }

    /**
     * @return string
     */
    private static function var_site_description(): string {
        return get_bloginfo( 'description' );
    }

    /**
     * `%post_title%`/`%page_title%`/`%category_title%`/`%tag_title%`/
     * `%archive_title%` all resolve the same way - core's own
     * `single_term_title()`/`get_the_title()`/`get_the_archive_title()`
     * already return the right string for whichever of those 5 contexts
     * is actually active, so one resolver covers all 5 rather than 5
     * near-duplicates.
     *
     * @return string
     */
    private static function var_current_title(): string {
        if ( is_category() || is_tag() ) {
            return single_term_title( '', false ) ?: '';
        }

        if ( is_archive() ) {
            return wp_strip_all_tags( get_the_archive_title() );
        }

        return get_the_title();
    }

    /**
     * @return string
     */
    private static function var_search_term(): string {
        return get_search_query();
    }
}
