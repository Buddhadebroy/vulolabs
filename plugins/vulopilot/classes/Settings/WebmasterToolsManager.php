<?php
namespace VuloPilot\Settings;

use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Scanning → Webmaster Tools tab's real backing - outputs one `meta` verification tag
 * per configured provider on `wp_head`.
 *
 * @class       WebmasterToolsManager class
 * @version     1.0.0
 * @author      VuloLabs
 */
class WebmasterToolsManager {

	/**
	 * Settings key => meta tag `name` attribute.
	 *
	 * @var array<string, string>
	 */
	public const VERIFICATION_META_NAMES = array(
		'webmaster_google_verification'    => 'google-site-verification',
		'webmaster_bing_verification'      => 'msvalidate.01',
		'webmaster_baidu_verification'     => 'baidu-site-verification',
		'webmaster_yandex_verification'    => 'yandex-verification',
		'webmaster_pinterest_verification' => 'p:domain_verify',
		'webmaster_norton_verification'    => 'norton-safeweb-site-verification',
	);

	/**
	 * WebmasterToolsManager constructor.
	 */
	public function __construct() {
		add_action( 'wp_head', array( $this, 'maybe_output_tags' ), 5 );
	}

	/**
	 * @return void
	 */
	public function maybe_output_tags(): void {
		$settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

		foreach ( self::VERIFICATION_META_NAMES as $setting_key => $meta_name ) {
			$code = trim( (string) ( $settings[ $setting_key ] ?? '' ) );

			if ( '' === $code ) {
				continue;
			}

			$attribute = 'webmaster_pinterest_verification' === $setting_key ? 'property' : 'name';

			echo '<meta ' . esc_attr( $attribute ) . '="' . esc_attr( $meta_name ) . '" content="' . esc_attr( $code ) . '" />' . "\n";
		}

		$custom_tags = trim( (string) ( $settings['webmaster_custom_tags'] ?? '' ) );

		if ( '' !== $custom_tags ) {
			echo wp_kses(
				$this->sanitize_custom_meta_tags( $custom_tags ),
				array(
					'meta' => array(
						'name'     => true,
						'property' => true,
						'content'  => true,
					),
				)
			);
		}
	}

	/**
	 * Rebuilds `webmaster_custom_tags` from scratch as safe `meta` tags only - never
	 * echoes the admin's raw input string.
	 *
	 * @param string $raw Raw admin-entered textarea content.
	 * @return string Rebuilt, safe `meta` tags only.
	 */
	private function sanitize_custom_meta_tags( string $raw ): string {
		$safe_tags = array();

		if ( preg_match_all( '/<meta\s+([^>]*)\/?>/i', $raw, $matches ) ) {
			foreach ( $matches[1] as $attributes_string ) {
				$attributes = $this->parse_attributes( $attributes_string );

				if ( empty( $attributes['content'] ) || ( empty( $attributes['name'] ) && empty( $attributes['property'] ) ) ) {
					continue;
				}

				$tag = '<meta';

				foreach ( array( 'name', 'property', 'content' ) as $allowed_attribute ) {
					if ( ! empty( $attributes[ $allowed_attribute ] ) ) {
						$tag .= ' ' . $allowed_attribute . '="' . esc_attr( $attributes[ $allowed_attribute ] ) . '"';
					}
				}

				$safe_tags[] = $tag . ' />';
			}
		}

		return implode( "\n", $safe_tags );
	}

	/**
	 * Parses `name="x" content="y"`-style attribute pairs out of one matched `meta`
	 * tag's inner attribute string.
	 *
	 * @param string $attributes_string Raw attribute text between `<meta` and `/>`.
	 * @return array<string, string>
	 */
	private function parse_attributes( string $attributes_string ): array {
		$attributes = array();

		if ( preg_match_all( '/([a-zA-Z-]+)\s*=\s*(["\'])(.*?)\2/', $attributes_string, $pairs, PREG_SET_ORDER ) ) {
			foreach ( $pairs as $pair ) {
				$attributes[ strtolower( $pair[1] ) ] = $pair[3];
			}
		}

		return $attributes;
	}
}
