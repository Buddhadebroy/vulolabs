<?php
/**
 * EntityExtractor class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * "Entity Extraction" (KNOWLEDGE-GRAPH-MODULE.md) — the Free half of
 * Phase 05's Knowledge Graph. Every entity type is read from real,
 * already-existing WordPress data; nothing here is NLP/NER-style text
 * mining (this codebase has no such capability and none is introduced —
 * every other "entity" scanner audited for this feature turned out to be a
 * boolean regex presence check, not a parser, so there was no existing
 * extraction mechanism to build on regardless):
 *
 * - People: real WP users who have authored at least one published post/page.
 * - Organizations: the site's own real Organization entity — Services\HomepageSchemaRenderer's
 *   `vulopilot_homepage_schema_json` option's `publisher` sub-object when a
 *   site owner has run that Pro mechanical fix, falling back to the site's
 *   own title/URL (always real, never fabricated) when it hasn't.
 * - Products: real WooCommerce products, same `class_exists('WooCommerce')`
 *   + `wc_get_products()` guard every other Free WooCommerce scanner uses.
 * - Services/Locations: real data the site owner explicitly provides via
 *   two new settings (Scanning → Entity Extraction) — this codebase has no
 *   existing Service/LocalBusiness concept to derive these from
 *   automatically (confirmed absent everywhere), so rather than fabricate
 *   a data source that doesn't exist, these two types are owner-curated
 *   lists, same "Free owns the setting, deterministic once provided"
 *   posture `geo_competitor_urls` already uses. Empty (not fabricated)
 *   until configured.
 * - Categories: real taxonomy terms currently attached to at least one
 *   published post/product (`hide_empty` => true).
 *
 * Gated on the `entity-extraction` module being active
 * (`VuloPilot()->modules->get_active_modules()`) — same "deactivating a
 * module really changes behavior" posture `modules/Seo/Module.php`'s own
 * docblock documents, since this service has no scanner/finding of its own
 * to gate through the usual `ScannerRegistry` category mechanism.
 *
 * Results are transient-cached (1 hour, same TTL `RobotsTxtBotAccess`
 * already uses) since a full extraction touches users/products/terms/
 * settings on every call; `modules/EntityExtraction/Module.php` busts the
 * cache on the real content-change events that would affect it.
 *
 * @class       EntityExtractor class
 * @version     1.0.0
 * @author      VuloLabs
 */
class EntityExtractor {

    private const CACHE_KEY          = 'vulopilot_entity_extraction';
    private const CACHE_TTL_SECONDS  = HOUR_IN_SECONDS;
    private const AUTHOR_BATCH_SIZE  = 200;
    private const PRODUCT_BATCH_SIZE = 200;

    /**
     * @return array{people: array, organizations: array, products: array|null, services: array, locations: array, categories: array}
     */
    public function extract_all(): array {
        $cached = get_transient( self::CACHE_KEY );

        if ( is_array( $cached ) ) {
            return $cached;
        }

        if ( ! $this->is_module_active() ) {
            $empty = array(
                'people'        => array(),
                'organizations' => array(),
                'products'      => class_exists( 'WooCommerce' ) ? array() : null,
                'services'      => array(),
                'locations'     => array(),
                'categories'    => array(),
            );

            return $empty;
        }

        $result = array(
            'people'        => $this->extract_people(),
            'organizations' => $this->extract_organizations(),
            'products'      => $this->extract_products(),
            'services'      => $this->extract_services(),
            'locations'     => $this->extract_locations(),
            'categories'    => $this->extract_categories(),
        );

        set_transient( self::CACHE_KEY, $result, self::CACHE_TTL_SECONDS );

        return $result;
    }

    /**
     * @return void
     */
    public function clear_cache(): void {
        delete_transient( self::CACHE_KEY );
    }

    /**
     * @return bool
     */
    private function is_module_active(): bool {
        return in_array( 'entity-extraction', VuloPilot()->modules->get_active_modules(), true );
    }

    /**
     * @return array<int, array{id: string, type: string, name: string, url: string|null, source_object_type: string, source_object_ref: string, meta: array}>
     */
    private function extract_people(): array {
        global $wpdb;

        $author_ids = $wpdb->get_col(
            $wpdb->prepare(
                "SELECT DISTINCT post_author FROM {$wpdb->posts} WHERE post_status = %s AND post_type IN ('post','page') LIMIT %d", // phpcs:ignore WordPress.DB.PreparedSQL.InterpolatedNotPrepared
                'publish',
                self::AUTHOR_BATCH_SIZE
            )
        );

        $people = array();

        foreach ( (array) $author_ids as $author_id ) {
            $user = get_userdata( (int) $author_id );

            if ( ! $user ) {
                continue;
            }

            $people[] = array(
                'id'                 => 'person:' . $user->ID,
                'type'               => 'person',
                'name'               => $user->display_name,
                'url'                => get_author_posts_url( $user->ID ),
                'source_object_type' => 'user',
                'source_object_ref'  => (string) $user->ID,
                'meta'               => array(
                    'bio' => get_the_author_meta( 'description', $user->ID ),
                ),
            );
        }

        return $people;
    }

    /**
     * @return array<int, array{id: string, type: string, name: string, url: string|null, source_object_type: string, source_object_ref: string, meta: array}>
     */
    private function extract_organizations(): array {
        $organizations = array();
        $site_name     = trim( (string) get_bloginfo( 'name' ) );
        $site_url      = home_url( '/' );
        $publisher     = $this->get_homepage_publisher();

        $organizations[] = array(
            'id'                 => 'organization:site',
            'type'               => 'organization',
            'name'               => $publisher['name'] ?? $site_name,
            'url'                => $publisher['url'] ?? $site_url,
            'source_object_type' => 'site',
            'source_object_ref'  => '0',
            'meta'               => array(
                'logo' => $publisher['logo'] ?? null,
            ),
        );

        return $organizations;
    }

    /**
     * Reads the real Organization sub-object Pro's own
     * MechanicalFixRunner::generate_organization_schema() nests into
     * `vulopilot_homepage_schema_json` as `publisher`, if a site owner has
     * ever run that fix — the one place in this codebase with a real,
     * structured, deterministically-built Organization entity.
     *
     * @return array{name?: string, url?: string, logo?: string}|null
     */
    private function get_homepage_publisher(): ?array {
        $raw = get_option( 'vulopilot_homepage_schema_json', '' );

        if ( ! is_string( $raw ) || '' === $raw ) {
            return null;
        }

        $decoded = json_decode( $raw, true );

        if ( ! is_array( $decoded ) || empty( $decoded['publisher'] ) || ! is_array( $decoded['publisher'] ) ) {
            return null;
        }

        return $decoded['publisher'];
    }

    /**
     * @return array<int, array{id: string, type: string, name: string, url: string|null, source_object_type: string, source_object_ref: string, meta: array}>|null Null when WooCommerce isn't active — same "not applicable to this site" signal Dashboard's own category_scores.woocommerce already uses.
     */
    private function extract_products(): ?array {
        if ( ! class_exists( 'WooCommerce' ) || ! function_exists( 'wc_get_products' ) ) {
            return null;
        }

        $products = wc_get_products(
            array(
                'status' => 'publish',
                'limit'  => self::PRODUCT_BATCH_SIZE,
                'return' => 'objects',
            )
        );

        $entities = array();

        foreach ( (array) $products as $product ) {
            if ( ! $product instanceof \WC_Product ) {
                continue;
            }

            $entities[] = array(
                'id'                 => 'product:' . $product->get_id(),
                'type'               => 'product',
                'name'               => $product->get_name(),
                'url'                => get_permalink( $product->get_id() ),
                'source_object_type' => 'product',
                'source_object_ref'  => (string) $product->get_id(),
                'meta'               => array(
                    'sku'          => $product->get_sku(),
                    'price'        => $product->get_price(),
                    'category_ids' => $product->get_category_ids(),
                ),
            );
        }

        return $entities;
    }

    /**
     * Owner-curated, newline-separated page URLs/ids (Scanning → Entity
     * Extraction's `entity_service_pages` setting) — each resolved to a
     * real published page; anything that doesn't resolve is silently
     * skipped rather than fabricated as an entity.
     *
     * @return array<int, array{id: string, type: string, name: string, url: string|null, source_object_type: string, source_object_ref: string, meta: array}>
     */
    private function extract_services(): array {
        return $this->extract_pages_from_setting( 'entity_service_pages', 'service' );
    }

    /**
     * @param string $setting_key Utill::VULOPILOT_SETTINGS_DEFAULTS key.
     * @param string $entity_type 'service' or reused for other page-list entity types.
     * @return array<int, array{id: string, type: string, name: string, url: string|null, source_object_type: string, source_object_ref: string, meta: array}>
     */
    private function extract_pages_from_setting( string $setting_key, string $entity_type ): array {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
        $lines    = array_filter( array_map( 'trim', preg_split( '/[\r\n]+/', (string) ( $settings[ $setting_key ] ?? '' ) ) ) );

        $entities = array();

        foreach ( $lines as $line ) {
            $post_id = is_numeric( $line ) ? absint( $line ) : url_to_postid( $line );

            if ( ! $post_id || 'publish' !== get_post_status( $post_id ) ) {
                continue;
            }

            $entities[] = array(
                'id'                 => $entity_type . ':' . $post_id,
                'type'               => $entity_type,
                'name'               => get_the_title( $post_id ),
                'url'                => get_permalink( $post_id ),
                'source_object_type' => 'post',
                'source_object_ref'  => (string) $post_id,
                'meta'               => array(),
            );
        }

        return $entities;
    }

    /**
     * Owner-curated, newline-separated `Name | Address` lines (Scanning →
     * Entity Extraction's `entity_business_locations` setting) — real data
     * the site owner provides, since no LocalBusiness address/geo field is
     * ever written anywhere in this codebase to derive it from
     * automatically.
     *
     * @return array<int, array{id: string, type: string, name: string, url: null, source_object_type: string, source_object_ref: string, meta: array}>
     */
    private function extract_locations(): array {
        $settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
        $lines    = array_filter( array_map( 'trim', preg_split( '/[\r\n]+/', (string) ( $settings['entity_business_locations'] ?? '' ) ) ) );

        $entities = array();

        foreach ( $lines as $index => $line ) {
            $parts   = array_map( 'trim', explode( '|', $line, 2 ) );
            $name    = $parts[0] ?? '';
            $address = $parts[1] ?? '';

            if ( '' === $name ) {
                continue;
            }

            $entities[] = array(
                'id'                 => 'location:' . $index,
                'type'               => 'location',
                'name'               => $name,
                'url'                => null,
                'source_object_type' => 'setting',
                'source_object_ref'  => (string) $index,
                'meta'               => array(
                    'address' => $address,
                ),
            );
        }

        return $entities;
    }

    /**
     * @return array<int, array{id: string, type: string, name: string, url: string|null, source_object_type: string, source_object_ref: string, meta: array}>
     */
    private function extract_categories(): array {
        $taxonomies = array( 'category' );

        if ( class_exists( 'WooCommerce' ) ) {
            $taxonomies[] = 'product_cat';
        }

        $terms = get_terms(
            array(
                'taxonomy'   => $taxonomies,
                'hide_empty' => true,
            )
        );

        if ( is_wp_error( $terms ) || ! is_array( $terms ) ) {
            return array();
        }

        $entities = array();

        foreach ( $terms as $term ) {
            $term_link = get_term_link( $term );

            $entities[] = array(
                'id'                 => 'category:' . $term->term_id,
                'type'               => 'category',
                'name'               => $term->name,
                'url'                => is_wp_error( $term_link ) ? null : $term_link,
                'source_object_type' => 'term',
                'source_object_ref'  => (string) $term->term_id,
                'meta'               => array(
                    'taxonomy' => $term->taxonomy,
                    'count'    => $term->count,
                ),
            );
        }

        return $entities;
    }
}
