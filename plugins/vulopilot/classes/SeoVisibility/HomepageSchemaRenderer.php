<?php
namespace VuloPilot\SeoVisibility;

use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Outputs the homepage's WebSite/Organization JSON-LD - the stored override from Settings →
 * Business Information (or vulopilot-pro's One-Click Fix) if one was saved, otherwise a default
 * built from the site's own WP data so a fresh install still carries sitewide schema out of the
 * box (same baseline Rank Math's Global Identity provides, without requiring that step).
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
	 * Outputs the homepage's JSON-LD, if the front page.
	 *
	 * @return void
	 */
	public function maybe_output_schema(): void {
		if ( ! is_front_page() ) {
			return;
		}

		$schema_json = get_option( 'vulopilot_homepage_schema_json', '' );
		$decoded     = '' !== $schema_json ? json_decode( (string) $schema_json, true ) : null;

		if ( ! is_array( $decoded ) ) {
			$decoded = $this->build_default_schema();
		}

		wp_print_inline_script_tag( (string) wp_json_encode( $decoded ), array( 'type' => 'application/ld+json' ) );
	}

	/**
	 * A WebSite schema with an Organization "publisher", built from the site's own data - same
	 * shape vulopilot-pro's MechanicalFixRunner writes into the option this falls back from, so a
	 * later explicit fix/edit only replaces this, it never conflicts with it.
	 *
	 * @return array<string, mixed>
	 */
	private function build_default_schema(): array {
		$schema = array(
			'@context' => 'https://schema.org',
			'@type'    => 'WebSite',
			'name'     => get_bloginfo( 'name' ),
			'url'      => home_url( '/' ),
		);

		$description = get_bloginfo( 'description' );

		if ( '' !== $description ) {
			$schema['description'] = $description;
		}

		$business_name = trim( (string) Utill::get_setting( 'entity_business_name', '' ) );
		$logo_id       = absint( Utill::get_setting( 'entity_business_logo_id', 0 ) );

		$organization = array(
			'@type' => 'Organization',
			'name'  => '' !== $business_name ? $business_name : get_bloginfo( 'name' ),
			'url'   => home_url( '/' ),
		);

		$logo = $logo_id ? wp_get_attachment_image_url( $logo_id, 'full' ) : get_site_icon_url();

		if ( $logo ) {
			$organization['logo'] = $logo;
		}

		$profile_urls = array_values( array_filter( array_map( 'trim', explode( "\n", (string) Utill::get_setting( 'social_profile_urls', '' ) ) ) ) );

		if ( ! empty( $profile_urls ) ) {
			$organization['sameAs'] = $profile_urls;
		}

		$schema['publisher'] = $organization;

		return $schema;
	}
}
