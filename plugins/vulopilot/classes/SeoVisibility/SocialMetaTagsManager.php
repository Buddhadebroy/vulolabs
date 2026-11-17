<?php
namespace VuloPilot\SeoVisibility;

use VuloPilot\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Scanning → SEO's "Add Open Graph & Twitter Card tags" toggle.
 *
 * @class       SocialMetaTagsManager class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SocialMetaTagsManager {

	/** SocialMetaTagsManager constructor. */
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

		// A per-post override from the post-editor metabox's Social tab is a deliberate, explicit action for THAT post.
		if ( empty( $settings['social_meta_tags_enabled'] ) && ! ( $post_id && $this->has_post_override( $post_id ) ) ) {
			return;
		}

		$tags = $this->build_tags();

		if ( ! $tags ) {
			return;
		}

		if ( '' !== (string) ( $settings['facebook_app_id'] ?? '' ) ) {
			$tags['fb:app_id'] = (string) $settings['facebook_app_id'];
		}

		if ( '' !== (string) ( $settings['facebook_admin_id'] ?? '' ) ) {
			$tags['fb:admin_id'] = (string) $settings['facebook_admin_id'];
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
	 * @return array|null
	 */
	private function build_tags(): ?array {
		$settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
		// Set only when a real post/page backs this page, to source article:*/og:updated_time and the "Written
		// by"/"Time to read" labels below - never used for title/excerpt/image.
		$dated_post_id   = null;
		$image_attach_id = 0;
		// The registered size $image was actually resolved at, so build_image_meta_tags() below reports
		// width/height for the right image - null for the site icon, which has no matching registered size.
		$image_size      = null;

		if ( is_front_page() ) {
			// Checked before is_singular() below: the front page is always "website", even when WordPress' own
			// Settings > Reading > "A static page" setting makes it a real Page object (so is_singular() would
			// also be true for it) - same choice Rank Math makes for its own homepage output.
			$title           = get_bloginfo( 'name' );
			$excerpt         = get_bloginfo( 'description' );
			$image_attach_id = absint( get_option( 'site_icon' ) );
			$image           = $image_attach_id ? get_site_icon_url( 512 ) : '';
			$url             = home_url( '/' );
			$og_type         = 'website';

			$front_page_id = (int) get_option( 'page_on_front' );
			$dated_post_id = $front_page_id ?: null;
		} elseif ( is_singular() ) {
			$post_id           = get_queried_object_id();
			$override_image_id = absint( get_post_meta( $post_id, PostSeoMetaFields::META_KEYS['social_image_id'], true ) );
			$override_title    = get_post_meta( $post_id, PostSeoMetaFields::META_KEYS['social_title'], true );
			$override_excerpt  = get_post_meta( $post_id, PostSeoMetaFields::META_KEYS['social_description'], true );

			$title           = '' !== $override_title ? $override_title : get_the_title( $post_id );
			$excerpt         = '' !== $override_excerpt ? $override_excerpt : get_the_excerpt( $post_id );
			$image_attach_id = $override_image_id ? $override_image_id : (int) get_post_thumbnail_id( $post_id );
			$image           = $image_attach_id ? wp_get_attachment_image_url( $image_attach_id, 'large' ) : '';
			$image_size      = $image_attach_id ? 'large' : null;
			$url             = (string) get_permalink( $post_id );
			$og_type         = 'article';
			$dated_post_id   = $post_id;
		} elseif ( is_home() ) {
			$title           = get_bloginfo( 'name' );
			$excerpt         = get_bloginfo( 'description' );
			$image_attach_id = absint( get_option( 'site_icon' ) );
			$image           = $image_attach_id ? get_site_icon_url( 512 ) : '';
			$url             = home_url( '/' );
			$og_type         = 'website';
		} else {
			return null; // Archives/search/404 - same scope CanonicalUrlManager limits itself to.
		}

		if ( ! $image ) {
			$image_attach_id = absint( $settings['social_default_image_id'] ?? 0 );
			$image           = $image_attach_id ? wp_get_attachment_image_url( $image_attach_id, 'large' ) : '';
			$image_size      = $image_attach_id ? 'large' : null;
		}

		$card_type = $image ? (string) ( $settings['social_twitter_card_type'] ?? 'summary_large_image' ) : 'summary';

		$tags = array(
			// get_locale() already returns the underscore form (e.g. "en_US") Open Graph's og:locale expects.
			'og:locale'           => get_locale(),
			'og:type'             => $og_type,
			'og:title'            => $title,
			'og:description'      => $excerpt,
			'og:url'              => $url,
			'og:site_name'        => get_bloginfo( 'name' ),
			'twitter:card'        => $card_type,
			'twitter:title'       => $title,
			'twitter:description' => $excerpt,
		);

		$twitter_username = $this->normalize_twitter_username( (string) ( $settings['social_twitter_username'] ?? '' ) );

		if ( $twitter_username ) {
			// No per-post author handle exists yet, so the sitewide handle backs twitter:creator too - same
			// fallback Rank Math itself falls back to when a post's author has no Twitter username of their own.
			$tags['twitter:site']    = $twitter_username;
			$tags['twitter:creator'] = $twitter_username;
		}

		if ( $dated_post_id ) {
			$modified = get_the_modified_date( 'c', $dated_post_id );

			$tags['og:updated_time']        = $modified;
			$tags['article:published_time'] = get_the_date( 'c', $dated_post_id );
			$tags['article:modified_time']  = $modified;
		}

		if ( $image ) {
			$tags['og:image']      = $image;
			$tags['twitter:image'] = $image;

			if ( $image_attach_id ) {
				$tags = array_merge( $tags, $this->build_image_meta_tags( $image_attach_id, $image, $image_size ) );
			}
		}

		// Slack/Twitter "enhanced data" labels - real post/page content only, same scope as Rank Math's own
		// Slack-sharing feature (Open Graph\Slack::get_post_data()/get_page_data()).
		if ( $dated_post_id && is_singular() ) {
			$label_index = 0;

			$post = get_post( $dated_post_id );

			if ( $post && 'post' === $post->post_type ) {
				++$label_index;
				$tags[ "twitter:label{$label_index}" ] = __( 'Written by', 'vulopilot' );
				$tags[ "twitter:data{$label_index}" ]  = get_the_author_meta( 'display_name', $post->post_author );
			}

			if ( $post && ! post_password_required( $post ) ) {
				++$label_index;
				$tags[ "twitter:label{$label_index}" ] = __( 'Time to read', 'vulopilot' );
				$tags[ "twitter:data{$label_index}" ]  = $this->calculate_time_to_read( $post );
			}
		}

		return $tags;
	}

	/**
	 * Trims whitespace, strips any leading "@" and URL the admin might have pasted, then re-adds a single "@" -
	 * `twitter:site`/`twitter:creator` are only ever valid with it.
	 *
	 * @param string $raw_username Settings → Scanning → SEO's "X/Twitter username" field, as stored.
	 * @return string Empty when nothing usable was entered.
	 */
	private function normalize_twitter_username( string $raw_username ): string {
		$username = trim( $raw_username );

		if ( '' === $username ) {
			return '';
		}

		// A pasted profile URL (https://x.com/handle or https://twitter.com/handle) - keep just the handle.
		if ( preg_match( '~(?:x|twitter)\.com/([^/?#]+)~i', $username, $matches ) ) {
			$username = $matches[1];
		}

		$username = ltrim( $username, '@' );
		$username = preg_replace( '/[^A-Za-z0-9_]/', '', $username );

		return '' !== $username ? '@' . $username : '';
	}

	/**
	 * `og:image:width`/`height`/`alt`/`type`/`secure_url` - same derivation Rank Math's own
	 * `OpenGraph\Image::get_attachment_image()`/`image_tag()` use, straight off the attachment's own WP metadata.
	 *
	 * @param int         $attachment_id The image's attachment id.
	 * @param string      $image_url     The already-resolved image URL.
	 * @param string|null $size          The registered image size $image_url itself was resolved at, so width/height
	 *                                   actually describe that URL - null skips width/height entirely rather than
	 *                                   reporting a different size's dimensions under the wrong image.
	 * @return array
	 */
	private function build_image_meta_tags( int $attachment_id, string $image_url, ?string $size ): array {
		$tags = array();

		if ( 0 === strpos( $image_url, 'https://' ) ) {
			$tags['og:image:secure_url'] = $image_url;
		}

		$src = $size ? wp_get_attachment_image_src( $attachment_id, $size ) : false;

		if ( $src ) {
			list( , $width, $height ) = $src;

			$tags['og:image:width']  = (string) $width;
			$tags['og:image:height'] = (string) $height;
		}

		$mime_type = get_post_mime_type( $attachment_id );

		if ( $mime_type ) {
			$tags['og:image:type'] = $mime_type;
		}

		$alt = get_post_meta( $attachment_id, '_wp_attachment_image_alt', true );

		if ( $alt ) {
			$tags['og:image:alt'] = $alt;
		}

		return $tags;
	}

	/**
	 * Same algorithm as Rank Math's own `OpenGraph\Slack::calculate_time_to_read()`: count `\p{L}+` "word" runs in
	 * the stripped post content, divide by 200 words/minute, floor, and format.
	 *
	 * @param \WP_Post $post Post to estimate reading time for.
	 * @return string
	 */
	private function calculate_time_to_read( \WP_Post $post ): string {
		$content          = wp_strip_all_tags( $post->post_content );
		$words_per_minute = 200;
		$words            = preg_match_all( '/\p{L}+/u', $content );
		$minutes          = floor( $words / $words_per_minute );

		if ( $minutes > 0 ) {
			return sprintf(
				/* translators: %d is how many minutes this post/page takes to read. */
				_n( '%d minute', '%d minutes', $minutes, 'vulopilot' ),
				$minutes
			);
		}

		return __( 'Less than a minute', 'vulopilot' );
	}
}
