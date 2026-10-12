<?php
/**
 * Calculator class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Forms;

defined( 'ABSPATH' ) || exit;

/**
 * Evaluates a calculation field's formula: numbers, `{field_key}` references, + - * / and brackets.
 *
 * The formula is parsed, never executed as code. public/js/form.js has the same evaluator for the
 * live total; the value stored with a submission always comes from here.
 */
class Calculator {

	/**
	 * @param string $formula Formula, e.g. `{quantity} * 12.5 + {extras}`.
	 * @param array  $values  Field key => submitted value.
	 * @return float|null The result, or null when the formula is invalid.
	 */
	public static function evaluate( $formula, array $values ) {
		$tokens = self::tokenize( (string) $formula, $values );

		if ( null === $tokens || ! $tokens ) {
			return null;
		}

		$output = array();
		$stack  = array();
		$weight = array(
			'+'   => 1,
			'-'   => 1,
			'*'   => 2,
			'/'   => 2,
			// Unary minus: binds tighter than any binary operator and takes one operand.
			'neg' => 3,
		);

		// Shunting-yard: infix tokens to reverse Polish.
		foreach ( $tokens as $token ) {
			if ( is_float( $token ) ) {
				$output[] = $token;
			} elseif ( 'neg' === $token ) {
				$stack[] = $token;
			} elseif ( isset( $weight[ $token ] ) ) {
				while ( $stack && isset( $weight[ end( $stack ) ] ) && $weight[ end( $stack ) ] >= $weight[ $token ] ) {
					$output[] = array_pop( $stack );
				}

				$stack[] = $token;
			} elseif ( '(' === $token ) {
				$stack[] = $token;
			} else {
				while ( $stack && '(' !== end( $stack ) ) {
					$output[] = array_pop( $stack );
				}

				if ( ! $stack ) {
					return null;
				}

				array_pop( $stack );
			}
		}

		while ( $stack ) {
			$operator = array_pop( $stack );

			if ( '(' === $operator ) {
				return null;
			}

			$output[] = $operator;
		}

		$result = array();

		foreach ( $output as $token ) {
			if ( is_float( $token ) ) {
				$result[] = $token;
				continue;
			}

			if ( 'neg' === $token ) {
				if ( ! $result ) {
					return null;
				}

				$result[] = -1 * array_pop( $result );
				continue;
			}

			if ( count( $result ) < 2 ) {
				return null;
			}

			$right = array_pop( $result );
			$left  = array_pop( $result );

			switch ( $token ) {
				case '+':
					$result[] = $left + $right;
					break;
				case '-':
					$result[] = $left - $right;
					break;
				case '*':
					$result[] = $left * $right;
					break;
				default:
					// Dividing by zero gives 0 rather than an error the visitor can do nothing about.
					$result[] = 0.0 === $right ? 0.0 : $left / $right;
			}
		}

		return 1 === count( $result ) ? (float) $result[0] : null;
	}

	/**
	 * @param string $formula Formula.
	 * @param array  $values  Field key => value.
	 * @return array<int, float|string>|null Numbers, operator characters and 'neg'; null on an invalid character.
	 */
	private static function tokenize( $formula, array $values ) {
		$tokens = array();
		$length = strlen( $formula );
		$i      = 0;

		while ( $i < $length ) {
			$char = $formula[ $i ];

			if ( ctype_space( $char ) ) {
				++$i;
			} elseif ( '{' === $char ) {
				$end = strpos( $formula, '}', $i );

				if ( false === $end ) {
					return null;
				}

				$tokens[] = self::number( $values[ substr( $formula, $i + 1, $end - $i - 1 ) ] ?? 0 );
				$i        = $end + 1;
			} elseif ( ctype_digit( $char ) || '.' === $char ) {
				$start = $i;

				while ( $i < $length && ( ctype_digit( $formula[ $i ] ) || '.' === $formula[ $i ] ) ) {
					++$i;
				}

				$tokens[] = (float) substr( $formula, $start, $i - $start );
			} elseif ( false !== strpos( '+-*/()', $char ) ) {
				// A minus at the start, or after an operator or opening bracket, negates what follows.
				$previous = $tokens ? end( $tokens ) : '(';

				$tokens[] = '-' === $char && ! is_float( $previous ) && ')' !== $previous ? 'neg' : $char;
				++$i;
			} else {
				return null;
			}
		}

		return $tokens;
	}

	/**
	 * The numeric value of a submitted field: a number as is, several ticked options added up.
	 *
	 * @param mixed $value Submitted value.
	 * @return float
	 */
	private static function number( $value ) {
		$total = 0.0;

		foreach ( Conditions::flatten( $value ) as $item ) {
			$total += is_numeric( $item ) ? (float) $item : 0.0;
		}

		return $total;
	}
}
