<?php
/**
 * Conditions class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Forms;

defined( 'ABSPATH' ) || exit;

/**
 * Evaluates a field's conditional logic against submitted values.
 *
 * The browser applies the same rules (public/js/form.js) for a responsive form, but this class is
 * the authority: a hidden field's value is discarded and its "required" is not enforced, whatever
 * the browser sent.
 */
class Conditions {

	const OPERATORS = array( 'is', 'is_not', 'contains', 'not_contains', 'empty', 'not_empty', 'gt', 'lt' );

	/**
	 * Whether a field is visible for the given values.
	 *
	 * @param array $field  Field definition.
	 * @param array $values Field key => submitted value, for every field.
	 * @return bool
	 */
	public static function is_visible( array $field, array $values ) {
		$conditions = isset( $field['conditions'] ) && is_array( $field['conditions'] ) ? $field['conditions'] : array();

		if ( empty( $conditions['enabled'] ) || empty( $conditions['rules'] ) || 'require' === ( $conditions['action'] ?? 'show' ) ) {
			return true;
		}

		$matched = self::matches( $conditions, $values );

		return 'hide' === $conditions['action'] ? ! $matched : $matched;
	}

	/**
	 * Whether a field is required for the given values.
	 *
	 * @param array $field  Field definition.
	 * @param array $values Field key => submitted value.
	 * @return bool
	 */
	public static function is_required( array $field, array $values ) {
		$conditions = isset( $field['conditions'] ) && is_array( $field['conditions'] ) ? $field['conditions'] : array();

		if ( ! empty( $conditions['enabled'] ) && ! empty( $conditions['rules'] ) && 'require' === ( $conditions['action'] ?? 'show' ) ) {
			return self::matches( $conditions, $values );
		}

		return ! empty( $field['required'] );
	}

	/**
	 * Whether something that can be limited to certain answers (a notification, a webhook, an
	 * alternative confirmation) applies to a submission. With no conditions it always does.
	 *
	 * @param mixed $conditions `enabled`, `match` and `rules`, or nothing.
	 * @param array $values     Field key => submitted value. A hidden field has no value.
	 * @return bool
	 */
	public static function applies( $conditions, array $values ) {
		if ( ! is_array( $conditions ) || empty( $conditions['enabled'] ) || empty( $conditions['rules'] ) ) {
			return true;
		}

		return self::matches( $conditions, $values );
	}

	/**
	 * @param array $conditions `match` (all|any) and `rules`.
	 * @param array $values     Field key => value.
	 * @return bool
	 */
	public static function matches( array $conditions, array $values ) {
		$any = 'any' === ( $conditions['match'] ?? 'all' );

		foreach ( (array) $conditions['rules'] as $rule ) {
			$result = self::rule_matches( (array) $rule, $values );

			if ( $any && $result ) {
				return true;
			}

			if ( ! $any && ! $result ) {
				return false;
			}
		}

		return ! $any;
	}

	/**
	 * @param array $rule   `field` (key), `operator`, `value`.
	 * @param array $values Field key => value.
	 * @return bool
	 */
	private static function rule_matches( array $rule, array $values ) {
		$actual   = self::flatten( $values[ (string) ( $rule['field'] ?? '' ) ] ?? '' );
		$expected = strtolower( trim( (string) ( $rule['value'] ?? '' ) ) );
		$joined   = strtolower( implode( ' ', $actual ) );

		switch ( $rule['operator'] ?? 'is' ) {
			case 'is':
				return in_array( $expected, array_map( 'strtolower', $actual ), true );

			case 'is_not':
				return ! in_array( $expected, array_map( 'strtolower', $actual ), true );

			case 'contains':
				return '' !== $expected && false !== strpos( $joined, $expected );

			case 'not_contains':
				return '' === $expected || false === strpos( $joined, $expected );

			case 'empty':
				return '' === trim( $joined );

			case 'not_empty':
				return '' !== trim( $joined );

			case 'gt':
				return is_numeric( $joined ) && is_numeric( $expected ) && (float) $joined > (float) $expected;

			case 'lt':
				return is_numeric( $joined ) && is_numeric( $expected ) && (float) $joined < (float) $expected;
		}

		return false;
	}

	/**
	 * Reduces any submitted value to a list of trimmed strings.
	 *
	 * @param mixed $value String, list (checkboxes) or map (name, address).
	 * @return string[]
	 */
	public static function flatten( $value ) {
		if ( ! is_array( $value ) ) {
			$value = trim( (string) $value );

			return '' === $value ? array() : array( $value );
		}

		$flat = array();

		foreach ( $value as $item ) {
			if ( is_scalar( $item ) && '' !== trim( (string) $item ) ) {
				$flat[] = trim( (string) $item );
			}
		}

		return $flat;
	}
}
