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
			case 'signature':
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
					if ( ! empty( $item ) ) {
						$chosen[] = isset( $labels[ $item ] ) ? $labels[ $item ] : (string) $item;
					}
				}

				return implode( ', ', $chosen );

			case 'name':
				return trim( implode( ' ', array_filter( is_array( $value ) ? $value : array(), 'strlen' ) ) );

			case 'address':
				return implode( ', ', array_filter( is_array( $value ) ? $value : array(), 'strlen' ) );

			case 'phone':
				return is_array( $value ) ? trim( ( empty( $value['country_code'] ) ? '' : $value['country_code'] ) . ' ' . ( empty( $value['phone'] ) ? '' : $value['phone'] ) ) : $value;

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
					'label' => ! empty( $field['label'] ) ? $field['label'] : $field['key'],
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

			if ( ! empty( $row['text'] ) && 'hidden' !== $row['type'] ) {
				$all[] = array( $row['label'], $row['text'] );
			}
		}

		if ( $as_html ) {
			$replace                 = array_map( 'esc_html', $replace );
			$replace['{all_fields}'] = self::all_fields_html( $all );
		} else {
			$replace['{all_fields}'] = implode(
				"\n",
				array_map(
					static function ( $row ) {
						return $row[0] . ': ' . $row[1];
					},
					$all
				)
			);
		}

		// Whatever placeholder is left names a field that no longer exists; it becomes empty.
		return preg_replace( '/\{[a-z0-9_]+\}/', '', strtr( (string) $template, $replace ) );
	}

	/**
	 * `{all_fields}` as a clean, email-safe table instead of plain "Label: value" lines.
	 *
	 * @param array<int, array{0: string, 1: string}> $rows Label, text - already escaped.
	 * @return string
	 */
	private static function all_fields_html( array $rows ) {
		if ( ! $rows ) {
			return '';
		}

		$cells = array();

		foreach ( $rows as $row ) {
			// A multi-line value's own "\n" is converted along with the rest of the message, in one
			// nl2br() pass the caller makes over the whole filled template - not here, or a value
			// with a line break would end up with its "<br>" doubled.
			$cells[] = sprintf(
				'<tr><td style="padding:6px 12px;border-bottom:1px solid #e2e4e7;color:#50575e;font-weight:600;white-space:nowrap;vertical-align:top;">%s</td><td style="padding:6px 12px;border-bottom:1px solid #e2e4e7;color:#1d2327;">%s</td></tr>',
				$row[0],
				'' === $row[1] ? '&nbsp;' : $row[1]
			);
		}

		return '<table cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;border:1px solid #e2e4e7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;font-size:14px;">' . implode( '', $cells ) . '</table>';
	}
}
