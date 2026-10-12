<?php
/**
 * DynamicValues class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Forms;

defined( 'ABSPATH' ) || exit;

/**
 * Fills a field's starting value from where the form is shown and who is looking at it.
 *
 * A default (or a hidden field's value) may contain tags such as `{query:utm_source}`,
 * `{user:email}` or `{page:title}`. They are replaced when the form is drawn. Like every hidden or
 * pre-filled value, the result is sent by the browser and can be changed by the visitor, so it is
 * a convenience and not proof of anything.
 */
class DynamicValues {

	/**
	 * Matches one tag: a source, a colon and a name, or the bare `{date}`.
	 */
	const PATTERN = '/\{(query|user|page|site):([a-zA-Z0-9_\-]+)\}|\{(date)\}/';

	/**
	 * Tags the visitor's browser answers better than the server: the address bar and the page the
	 * form is on. A cached page, or a form embedded on another website, is drawn without the
	 * server knowing either, so the form's script fills these in again (public/js/form.js).
	 */
	const BROWSER_TAGS = '/\{(query:[a-zA-Z0-9_\-]+|page:url|page:title)\}/';

	/**
	 * Replaces every tag in a default value.
	 *
	 * @param string $template Default value as the form owner wrote it.
	 * @return string
	 */
	public static function resolve( $template ) {
		$template = (string) $template;

		if ( false === strpos( $template, '{' ) ) {
			return $template;
		}

		return (string) preg_replace_callback(
			self::PATTERN,
			static function ( $match ) {
				return isset( $match[3] ) && 'date' === $match[3] ? self::value( 'date', '' ) : self::value( $match[1], $match[2] );
			},
			$template
		);
	}

	/**
	 * What the form's script needs to fill in the browser-side tags itself: the default with
	 * everything else already replaced. Empty when the default has no such tag.
	 *
	 * @param string $template Default value as the form owner wrote it.
	 * @return string
	 */
	public static function browser_template( $template ) {
		$template = (string) $template;

		if ( ! preg_match( self::BROWSER_TAGS, $template ) ) {
			return '';
		}

		$left = (string) preg_replace_callback(
			self::PATTERN,
			static function ( $match ) {
				$value = isset( $match[3] ) && 'date' === $match[3] ? self::value( 'date', '' ) : self::value( $match[1], $match[2] );

				// The address bar is always the browser's to read. The page is too, but only when the
				// server does not know it (a form embedded elsewhere); otherwise both would answer
				// and could disagree, for instance on how the title is written.
				if ( 'query' === $match[1] || ( '' === $value && preg_match( self::BROWSER_TAGS, $match[0] ) ) ) {
					return $match[0];
				}

				return $value;
			},
			$template
		);

		return preg_match( self::BROWSER_TAGS, $left ) ? $left : '';
	}

	/**
	 * @param string $source query, user, page, site or date.
	 * @param string $name   What to read from it.
	 * @return string Empty when there is nothing to give, including for a visitor who is not logged in.
	 */
	private static function value( $source, $name ) {
		switch ( $source ) {
			case 'query':
				// phpcs:ignore WordPress.Security.NonceVerification.Recommended -- reading a public URL parameter to pre-fill a field, not acting on it.
				$value = isset( $_GET[ $name ] ) ? wp_unslash( $_GET[ $name ] ) : '';

				return is_scalar( $value ) ? sanitize_text_field( (string) $value ) : '';

			case 'user':
				$user = is_user_logged_in() ? wp_get_current_user() : null;

				if ( ! $user ) {
					return '';
				}

				$fields = array(
					'email'      => $user->user_email,
					'name'       => $user->display_name,
					'first_name' => $user->first_name,
					'last_name'  => $user->last_name,
					'username'   => $user->user_login,
					'id'         => $user->ID,
				);

				return isset( $fields[ $name ] ) ? (string) $fields[ $name ] : '';

			case 'page':
				$id = (int) get_queried_object_id();

				if ( 'id' === $name ) {
					return $id ? (string) $id : '';
				}

				if ( 'title' === $name ) {
					return $id ? wp_strip_all_tags( (string) get_the_title( $id ) ) : '';
				}

				return 'url' === $name && $id ? (string) get_permalink( $id ) : '';

			case 'site':
				if ( 'name' === $name ) {
					return wp_specialchars_decode( (string) get_bloginfo( 'name' ), ENT_QUOTES );
				}

				return 'url' === $name ? (string) home_url( '/' ) : '';

			case 'date':
				return (string) wp_date( 'Y-m-d' );
		}

		return '';
	}
}
