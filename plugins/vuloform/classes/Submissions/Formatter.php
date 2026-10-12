<?php
/**
 * Formatter class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Submissions;

use VuloForm\Fields\Registry;

defined( 'ABSPATH' ) || exit;

/**
 * Turns stored submission values into plain text, for emails, exports, webhooks and the admin list.
 */
class Formatter {

	/**
	 * @param array $field Field definition.
	 * @param mixed $value Stored value.
	 * @return string
	 */
	public static function text( array $field, $value ) {
		switch ( $field['type'] ) {
			case 'file':
				// Only the original file names: stored paths never leave the server.
				return implode( ', ', array_column( is_array( $value ) ? $value : array(), 'name' ) );

			case 'consent':
				return '1' === (string) $value ? __( 'Yes', 'vuloform' ) : __( 'No', 'vuloform' );

			case 'select':
			case 'radio':
			case 'checkboxes':
				$labels = array_column( $field['options'], 'label', 'value' );
				$chosen = array();

				foreach ( is_array( $value ) ? $value : array( $value ) as $item ) {
					if ( '' !== (string) $item ) {
						$chosen[] = isset( $labels[ $item ] ) ? $labels[ $item ] : (string) $item;
					}
				}

				return implode( ', ', $chosen );

			case 'name':
				return trim( implode( ' ', array_filter( is_array( $value ) ? $value : array(), 'strlen' ) ) );

			case 'address':
				return implode( ', ', array_filter( is_array( $value ) ? $value : array(), 'strlen' ) );

			case 'calculation':
				return '' === (string) $value ? '' : $field['prefix'] . $value;
		}

		return is_scalar( $value ) ? (string) $value : '';
	}

	/**
	 * Label and text for every field that collects a value, in form order.
	 *
	 * @param array $form   Form.
	 * @param array $values Field key => stored value.
	 * @return array<int, array{key: string, label: string, type: string, text: string}>
	 */
	public static function rows( array $form, array $values ) {
		$rows = array();

		foreach ( $form['schema']['fields'] as $field ) {
			if ( Registry::is_input( $field['type'] ) ) {
				$rows[] = array(
					'key'   => $field['key'],
					'label' => '' !== $field['label'] ? $field['label'] : $field['key'],
					'type'  => $field['type'],
					'text'  => self::text( $field, $values[ $field['key'] ] ?? '' ),
				);
			}
		}

		return $rows;
	}

	/**
	 * Replaces `{field_key}`, `{all_fields}`, `{form_title}` and `{site_name}` in a template.
	 *
	 * @param string $template Text with placeholders.
	 * @param array  $form     Form.
	 * @param array  $values   Field key => stored value.
	 * @param bool   $as_html  Whether the template is HTML, so what replaces a placeholder must be escaped.
	 * @return string
	 */
	public static function fill( $template, array $form, array $values, $as_html = false ) {
		$rows    = self::rows( $form, $values );
		$all     = array();
		$replace = array(
			'{form_title}' => $form['title'],
			'{site_name}'  => wp_specialchars_decode( get_bloginfo( 'name' ), ENT_QUOTES ),
		);

		foreach ( $rows as $row ) {
			$replace[ '{' . $row['key'] . '}' ] = $row['text'];

			if ( '' !== $row['text'] && 'hidden' !== $row['type'] ) {
				$all[] = $row['label'] . ': ' . $row['text'];
			}
		}

		$replace['{all_fields}'] = implode( "\n", $all );

		if ( $as_html ) {
			$replace = array_map( 'esc_html', $replace );
		}

		// Whatever placeholder is left names a field that no longer exists; it becomes empty.
		return preg_replace( '/\{[a-z0-9_]+\}/', '', strtr( (string) $template, $replace ) );
	}
}
