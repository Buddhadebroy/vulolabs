<?php
namespace VuloPilot\SeoVisibility;

defined( 'ABSPATH' ) || exit;

/**
 * Registers the post-editor metabox's own postmeta fields via `register_post_meta( ...,
 * 'show_in_rest' => true )`.
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
	 * AiCopilot\Actions\WriteMetaTitleAction/WriteMetaDescriptionAction's own post-type
	 * scope.
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

			// Same meta key this site's schema is saved under, registered here too so the Schema
			// tab's manual JSON textarea rides the same native save button as every other field.
			register_post_meta(
				$post_type,
				'_vulopilot_schema_json',
				$this->string_field_args(
					static function ( $value ) {
						$decoded = json_decode( (string) $value, true );

						return is_array( $decoded ) ? wp_json_encode( $decoded ) : '';
					}
				)
			);
		}

		// GenerateLandingPageAction's own meta key - 'page'-only (it always creates a `page`, never
		// a `post`).
		register_post_meta(
			'page',
			'_vulopilot_landing_page',
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
	 * The auth_callback every register_post_meta() call above passes.
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
