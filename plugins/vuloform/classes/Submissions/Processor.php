<?php
/**
 * Processor class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Submissions;

use VuloForm\Fields\Registry;
use VuloForm\Forms\Calculator;
use VuloForm\Forms\Conditions;
use VuloForm\Forms\Schema;
use VuloForm\Security\Spam;
use VuloForm\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Takes a posted form from request to stored submission.
 *
 * Nothing the browser says about the form is trusted: which fields exist, which are required, which
 * are hidden by a condition and what a calculation comes to are all worked out here from the stored
 * schema.
 */
class Processor {

	/**
	 * @var SubmissionRepository
	 */
	private $submissions;

	/**
	 * @param SubmissionRepository $submissions Submission storage.
	 */
	public function __construct( SubmissionRepository $submissions ) {
		$this->submissions = $submissions;
	}

	/**
	 * Handles one submission.
	 *
	 * @param array $form  Form (id, title, status, schema).
	 * @param array $post  Request fields: `vf` (field key => value), `vf_token`, the honeypot, `vf_page`.
	 * @param array $files `$_FILES`-shaped uploads, keyed `vf_file_{field key}`.
	 * @return array{success: bool, message: string, errors: array<string, string>, redirect: string, submission_id: int}
	 */
	public function handle( array $form, array $post, array $files = array() ) {
		$settings = $form['schema']['settings'];

		if ( 'published' !== $form['status'] ) {
			return self::failure( __( 'This form is not accepting submissions.', 'vuloform' ) );
		}

		if ( Schema::missing_modules( $form['schema'] ) ) {
			// The form depends on an extension that is not running, for example one that takes its
			// payment. Accepting the submission anyway would do the wrong thing silently.
			return self::failure( __( 'This form is temporarily unavailable. Please try again later.', 'vuloform' ) );
		}

		/**
		 * Lets an extension refuse a submission before anything is checked or stored, for example
		 * because something the form depends on is not configured. Return a message for the visitor
		 * to refuse, '' to carry on.
		 *
		 * @param string $message Refusal message, '' to accept.
		 * @param array  $form    Form.
		 */
		$refusal = (string) apply_filters( 'vuloform_refuse_submission', '', $form );

		if ( '' !== $refusal ) {
			return self::failure( $refusal );
		}

		$spam = Spam::check( $form, $post );

		if ( 'reject' === $spam['verdict'] ) {
			return self::failure( $spam['message'] );
		}

		$raw    = isset( $post['vf'] ) && is_array( $post['vf'] ) ? $post['vf'] : array();
		$values = array();

		// First pass: clean every value, so conditions can be evaluated against the whole form.
		foreach ( $form['schema']['fields'] as $field ) {
			if ( Registry::is_input( $field['type'] ) && 'file' !== $field['type'] && 'calculation' !== $field['type'] ) {
				$values[ $field['key'] ] = self::clean( $field, $raw[ $field['key'] ] ?? '' );
			}
		}

		$errors  = array();
		$uploads = array();

		// Second pass: validate what is visible, drop what is not.
		foreach ( $form['schema']['fields'] as $field ) {
			if ( ! Registry::is_input( $field['type'] ) ) {
				continue;
			}

			$key = $field['key'];

			if ( ! Conditions::is_visible( $field, $values ) ) {
				unset( $values[ $key ] );
				continue;
			}

			$required = Conditions::is_required( $field, $values );

			if ( 'calculation' === $field['type'] ) {
				continue;
			}

			if ( 'file' === $field['type'] ) {
				$sent = Uploads::normalise( $files[ 'vf_file_' . $key ] ?? null );

				if ( ! $sent ) {
					$error = $required ? $settings['messages']['required'] : '';
				} else {
					$error           = Uploads::validate( $field, $sent );
					$uploads[ $key ] = array( $field, $sent );
				}
			} else {
				$error = self::validate( $field, $values[ $key ], $required, $settings['messages'] );
			}

			/**
			 * Filters one field's validation error. Return a message to reject the value, '' to accept it.
			 *
			 * @param string $error  Current error, '' when valid.
			 * @param array  $field  Field definition.
			 * @param mixed  $value  Cleaned value (null for a file field).
			 * @param array  $values Every cleaned value, by field key.
			 * @param array  $form   Form.
			 */
			$error = (string) apply_filters( 'vuloform_validate_field', $error, $field, $values[ $key ] ?? null, $values, $form );

			if ( '' !== $error ) {
				$errors[ $field['id'] ] = $error;
			}
		}

		if ( $errors ) {
			$result           = self::failure( $settings['messages']['error'] );
			$result['errors'] = $errors;

			return $result;
		}

		// Calculations run last, on validated values only.
		foreach ( $form['schema']['fields'] as $field ) {
			if ( 'calculation' === $field['type'] && Conditions::is_visible( $field, $values ) ) {
				$total                   = Calculator::evaluate( $field['formula'], $values );
				$values[ $field['key'] ] = null === $total ? '' : number_format( $total, (int) $field['decimals'], '.', '' );
			}
		}

		foreach ( $uploads as $key => $upload ) {
			$values[ $key ] = Uploads::store( $upload[0], $upload[1] );

			if ( ! $values[ $key ] ) {
				// Nothing was stored for a file that passed validation: the server could not write it.
				foreach ( $values as $stored ) {
					if ( is_array( $stored ) && isset( $stored[0]['path'] ) ) {
						Uploads::delete_for_submission( array( 'data' => array( $stored ) ) );
					}
				}

				return self::failure( __( 'Your file could not be saved. Please try again later.', 'vuloform' ) );
			}
		}

		/**
		 * Filters the values about to be stored.
		 *
		 * @param array $values Field key => value.
		 * @param array $form   Form.
		 */
		$values = (array) apply_filters( 'vuloform_submission_values', $values, $form );
		$status = 'spam' === $spam['verdict'] ? 'spam' : 'unread';
		$id     = 0;

		if ( ! empty( $settings['store_submissions'] ) || 'spam' === $status ) {
			$id = $this->submissions->insert( $form['id'], $values, self::meta( $post ), $status );

			if ( ! $id ) {
				return self::failure( __( 'Your message could not be saved. Please try again later.', 'vuloform' ) );
			}
		}

		if ( 'spam' !== $status ) {
			/**
			 * Fires after a submission is accepted. Notifications and webhooks run from here.
			 *
			 * @param int   $id     Submission id (0 when the form does not store submissions).
			 * @param array $values Field key => value.
			 * @param array $form   Form.
			 */
			do_action( 'vuloform_submission_created', $id, $values, $form );
		}

		$confirmation = self::confirmation_for( $settings['confirmation'], $values );
		$result       = array(
			'success'       => true,
			// The message is HTML the site owner wrote; what the visitor typed goes into it escaped.
			'message'       => Formatter::fill( $confirmation['message'], $form, $values, true ),
			'errors'        => array(),
			'redirect'      => 'redirect' === $confirmation['type'] ? $confirmation['redirect_url'] : '',
			'submission_id' => $id,
		);

		if ( 'spam' === $status ) {
			return $result;
		}

		/**
		 * Filters what an accepted submission answers with. An extension can change the message or
		 * send the visitor somewhere else, for example to a payment page.
		 *
		 * @param array $result `success`, `message`, `errors`, `redirect`, `submission_id`.
		 * @param array $values Field key => value.
		 * @param array $form   Form.
		 */
		$filtered = apply_filters( 'vuloform_submission_result', $result, $values, $form );

		return is_array( $filtered ) ? array_merge( $result, array_intersect_key( $filtered, $result ) ) : $result;
	}

	/**
	 * Picks the confirmation for a submission: the first alternative whose conditions its answers
	 * meet, otherwise the form's usual one.
	 *
	 * @param array $confirmation The form's confirmation settings, with its `rules`.
	 * @param array $values       Field key => value.
	 * @return array{type: string, message: string, redirect_url: string}
	 */
	public static function confirmation_for( array $confirmation, array $values ) {
		foreach ( isset( $confirmation['rules'] ) && is_array( $confirmation['rules'] ) ? $confirmation['rules'] : array() as $rule ) {
			// An alternative with no rules left (its field was deleted) must not replace the usual one.
			if ( ! empty( $rule['conditions']['rules'] ) && Conditions::applies( $rule['conditions'], $values ) ) {
				return $rule;
			}
		}

		return $confirmation;
	}

	/**
	 * Reduces a posted value to the type its field stores.
	 *
	 * @param array $field Field definition.
	 * @param mixed $value Raw posted value.
	 * @return string|string[]
	 */
	public static function clean( array $field, $value ) {
		$value = is_array( $value ) || is_string( $value ) ? $value : '';

		switch ( $field['type'] ) {
			case 'checkboxes':
				return array_values( array_filter( array_map( 'sanitize_text_field', is_array( $value ) ? array_filter( $value, 'is_scalar' ) : array() ), 'strlen' ) );

			case 'name':
			case 'address':
				$parts = array();

				foreach ( $field['parts'] as $part ) {
					$parts[ $part ] = is_array( $value ) && isset( $value[ $part ] ) && is_scalar( $value[ $part ] ) ? sanitize_text_field( (string) $value[ $part ] ) : '';
				}

				return $parts;

			case 'textarea':
				return is_string( $value ) ? sanitize_textarea_field( $value ) : '';

			case 'email':
				return is_string( $value ) ? sanitize_email( $value ) : '';

			case 'url':
				return is_string( $value ) ? esc_url_raw( trim( $value ), array( 'http', 'https' ) ) : '';

			case 'consent':
				return is_string( $value ) && '' !== $value ? '1' : '';

			default:
				return is_string( $value ) ? sanitize_text_field( $value ) : '';
		}
	}

	/**
	 * Validates one cleaned value.
	 *
	 * @param array $field    Field definition.
	 * @param mixed $value    Cleaned value.
	 * @param bool  $required Whether the field is required for this submission.
	 * @param array $messages The form's `required` and `invalid` messages.
	 * @return string Error message, or ''.
	 */
	public static function validate( array $field, $value, $required, array $messages ) {
		$flat  = Conditions::flatten( $value );
		$empty = ! $flat;

		if ( 'name' === $field['type'] ) {
			$empty = '' === ( $value['first'] ?? ( $value['last'] ?? '' ) );
		} elseif ( 'address' === $field['type'] ) {
			$empty = '' === ( $value['line1'] ?? implode( '', $flat ) );
		}

		if ( $empty ) {
			return $required ? $messages['required'] : '';
		}

		$text = is_string( $value ) ? $value : '';

		switch ( $field['type'] ) {
			case 'email':
				return is_email( $text ) ? '' : __( 'Enter a valid email address.', 'vuloform' );

			case 'url':
				return wp_http_validate_url( $text ) || filter_var( $text, FILTER_VALIDATE_URL ) ? '' : __( 'Enter a valid web address, starting with https://.', 'vuloform' );

			case 'phone':
				$digits = strlen( preg_replace( '/\D/', '', $text ) );

				return preg_match( '/^[0-9+().\-\s]+$/', $text ) && $digits >= 5 && $digits <= 15 ? '' : __( 'Enter a valid phone number.', 'vuloform' );

			case 'number':
				if ( ! is_numeric( $text ) ) {
					return __( 'Enter a number.', 'vuloform' );
				}

				if ( '' !== $field['min'] && (float) $text < (float) $field['min'] ) {
					/* translators: %s: smallest allowed number. */
					return sprintf( __( 'Enter a number of %s or more.', 'vuloform' ), $field['min'] );
				}

				if ( '' !== $field['max'] && (float) $text > (float) $field['max'] ) {
					/* translators: %s: largest allowed number. */
					return sprintf( __( 'Enter a number of %s or less.', 'vuloform' ), $field['max'] );
				}

				return '';

			case 'date':
				$date = \DateTime::createFromFormat( 'Y-m-d', $text );

				return $date && $date->format( 'Y-m-d' ) === $text ? '' : __( 'Enter a valid date.', 'vuloform' );

			case 'time':
				return preg_match( '/^([01]\d|2[0-3]):[0-5]\d$/', $text ) ? '' : __( 'Enter a valid time.', 'vuloform' );

			case 'select':
			case 'radio':
			case 'checkboxes':
				// Only values the form offers are accepted, however the request was built.
				$allowed = array_column( $field['options'], 'value' );

				return array_diff( $flat, $allowed ) ? $messages['invalid'] : '';

			case 'text':
			case 'textarea':
				$length = mb_strlen( $text );

				if ( $field['minlength'] > 0 && $length < $field['minlength'] ) {
					/* translators: %d: number of characters. */
					return sprintf( _n( 'Enter at least %d character.', 'Enter at least %d characters.', $field['minlength'], 'vuloform' ), $field['minlength'] );
				}

				if ( $field['maxlength'] > 0 && $length > $field['maxlength'] ) {
					/* translators: %d: number of characters. */
					return sprintf( _n( 'Enter no more than %d character.', 'Enter no more than %d characters.', $field['maxlength'], 'vuloform' ), $field['maxlength'] );
				}

				return '';
		}

		return '';
	}

	/**
	 * What VuloForm records about a submission besides its values.
	 *
	 * @param array $post Request fields.
	 * @return array
	 */
	private static function meta( array $post ) {
		$meta = array(
			// The page the form was on, as reported by the form itself.
			'page_url' => esc_url_raw( (string) ( $post['vf_page'] ?? '' ), array( 'http', 'https' ) ),
			'events'   => array(),
		);

		// The address is personal data, so it is only kept when the site owner has opted in.
		if ( ! empty( Utill::settings()['store_ip'] ) ) {
			$meta['ip'] = Spam::ip();
		}

		return $meta;
	}

	/**
	 * @param string $message Message for the visitor.
	 * @return array
	 */
	private static function failure( $message ) {
		return array(
			'success'       => false,
			'message'       => $message,
			'errors'        => array(),
			'redirect'      => '',
			'submission_id' => 0,
		);
	}
}
