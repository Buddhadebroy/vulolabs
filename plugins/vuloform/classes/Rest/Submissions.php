<?php
/**
 * Submissions REST controller file.
 *
 * @package VuloForm
 */

namespace VuloForm\Rest;

use VuloForm\Fields\Registry;
use VuloForm\Submissions\Formatter;
use VuloForm\Submissions\SubmissionRepository;
use VuloForm\Submissions\Uploads;
use VuloForm\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * vuloform/v1/submissions - list, view, mark, delete, export and download files. Every route here
 * is administrator-only: submissions are never exposed publicly.
 */
class Submissions extends Controller {

	/**
	 * Registers this controller's routes.
	 *
	 * @return void
	 */
	public function register_routes() {
		$this->route( '/submissions', \WP_REST_Server::READABLE, 'get_items' );
		$this->route( '/submissions', \WP_REST_Server::DELETABLE, 'delete_items' );
		$this->route( '/submissions/status', \WP_REST_Server::CREATABLE, 'set_status' );
		$this->route( '/submissions/export', \WP_REST_Server::READABLE, 'export' );
		$this->route( '/submissions/(?P<id>\d+)', \WP_REST_Server::READABLE, 'get_item' );
		$this->route( '/submissions/(?P<id>\d+)/file', \WP_REST_Server::READABLE, 'download_file' );
	}

	/**
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_items( $request ) {
		// 0 means "All forms": every submission of every form, each formatted against its own schema.
		$form_id = absint( $request->get_param( 'form_id' ) );
		$form    = $form_id ? VuloForm()->forms->get( $form_id ) : null;

		if ( $form_id && ! $form ) {
			return $this->not_found();
		}

		$result = VuloForm()->submissions->query( $this->filters( $request, $form_id ) );
		$rows   = array();

		foreach ( $result['data'] as $submission ) {
			$rows[] = $this->summary( $form ?? VuloForm()->forms->get( $submission['form_id'] ), $submission );
		}

		$result['data'] = $rows;

		return rest_ensure_response( $result );
	}

	/**
	 * Returns one submission and marks it read.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function get_item( $request ) {
		$submission = VuloForm()->submissions->get( absint( $request['id'] ) );
		$form       = $submission ? VuloForm()->forms->get( $submission['form_id'] ) : null;

		if ( ! $form ) {
			return $this->not_found();
		}

		if ( 'unread' === $submission['status'] ) {
			VuloForm()->submissions->set_status( array( $submission['id'] ), 'read' );
			$submission['status'] = 'read';
		}

		$fields = array();

		foreach ( $form['schema']['fields'] as $field ) {
			if ( ! Registry::is_input( $field['type'] ) ) {
				continue;
			}

			$value = $submission['data'][ $field['key'] ] ?? '';
			$entry = array(
				'key'   => $field['key'],
				'label' => '' !== $field['label'] ? $field['label'] : $field['key'],
				'type'  => $field['type'],
				'text'  => Formatter::text( $field, $value ),
				'files' => array(),
			);

			if ( 'file' === $field['type'] && is_array( $value ) ) {
				foreach ( $value as $index => $record ) {
					// The stored path stays on the server; the file is fetched by position.
					$entry['files'][] = array(
						'name'  => (string) ( $record['name'] ?? '' ),
						'size'  => size_format( (int) ( $record['size'] ?? 0 ) ),
						'index' => (int) $index,
					);
				}
			}

			$fields[] = $entry;
		}

		return rest_ensure_response(
			array(
				'id'                 => $submission['id'],
				'form_id'            => $submission['form_id'],
				'status'             => $submission['status'],
				'created_at_display' => Utill::format_datetime( $submission['created_at'] ),
				'page_url'           => (string) ( $submission['meta']['page_url'] ?? '' ),
				'ip'                 => (string) ( $submission['meta']['ip'] ?? '' ),
				'events'             => array_values( (array) ( $submission['meta']['events'] ?? array() ) ),
				'fields'             => $fields,
			)
		);
	}

	/**
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function set_status( $request ) {
		$input  = (array) $request->get_json_params();
		$status = sanitize_key( (string) ( $input['status'] ?? '' ) );

		if ( ! in_array( $status, SubmissionRepository::STATUSES, true ) || empty( $input['ids'] ) || ! is_array( $input['ids'] ) ) {
			return new \WP_Error( 'vuloform_invalid_request', __( 'Choose at least one submission.', 'vuloform' ), array( 'status' => 400 ) );
		}

		return rest_ensure_response( array( 'updated' => VuloForm()->submissions->set_status( $input['ids'], $status ) ) );
	}

	/**
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response|\WP_Error
	 */
	public function delete_items( $request ) {
		$input = (array) $request->get_json_params();

		if ( empty( $input['ids'] ) || ! is_array( $input['ids'] ) ) {
			return new \WP_Error( 'vuloform_invalid_request', __( 'Choose at least one submission.', 'vuloform' ), array( 'status' => 400 ) );
		}

		return rest_ensure_response( array( 'deleted' => VuloForm()->submissions->delete( $input['ids'] ) ) );
	}

	/**
	 * Streams the filtered submissions as CSV: of one form, or of every form when `form_id` is 0.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_Error|void
	 */
	public function export( $request ) {
		// 0 means "All forms": one file, with a Form column and every form's questions as columns.
		$form_id = absint( $request->get_param( 'form_id' ) );
		$forms   = array();

		if ( $form_id ) {
			$form = VuloForm()->forms->get( $form_id );

			if ( ! $form ) {
				return $this->not_found();
			}

			$forms[ $form_id ] = $form;
		} else {
			$page = 1;

			do {
				$found = VuloForm()->forms->query(
					array(
						'page'     => $page,
						'per_page' => 100,
					)
				);

				foreach ( $found['data'] as $row ) {
					$form = VuloForm()->forms->get( (int) $row['id'] );

					if ( $form ) {
						$forms[ (int) $form['id'] ] = $form;
					}
				}

				++$page;
			} while ( 100 === count( $found['data'] ) );
		}

		// A question asked by several forms under the same label is one column.
		$labels = array();

		foreach ( $forms as $form ) {
			foreach ( Formatter::rows( $form, array() ) as $row ) {
				$labels[ $row['label'] ] = true;
			}
		}

		$labels  = array_keys( $labels );
		$filters = $this->filters( $request, $form_id );
		$name    = $form_id ? $forms[ $form_id ]['title'] : __( 'All forms', 'vuloform' );
		$heading = array( __( 'ID', 'vuloform' ) );

		if ( ! $form_id ) {
			$heading[] = __( 'Form', 'vuloform' );
		}

		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="' . sanitize_file_name( $name ) . '-' . gmdate( 'Y-m-d' ) . '.csv"' );
		header( 'X-Content-Type-Options: nosniff' );

		$out = fopen( 'php://output', 'w' ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fopen -- streaming a download, not writing a file.

		// A byte order mark, so spreadsheet programs read the file as UTF-8.
		fwrite( $out, "\xEF\xBB\xBF" ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fwrite

		fputcsv( $out, array_merge( $heading, array( __( 'Submitted', 'vuloform' ), __( 'Status', 'vuloform' ) ), array_map( array( self::class, 'csv_safe' ), $labels ) ), ',', '"', '\\' );

		$filters['per_page'] = 500;
		$filters['page']     = 1;

		// Page by page, so a long history is never held in memory at once.
		do {
			$result  = VuloForm()->submissions->query( $filters );
			$fetched = count( $result['data'] );

			foreach ( $result['data'] as $submission ) {
				$form = $forms[ (int) $submission['form_id'] ] ?? null;

				// Its form was deleted since; there is nothing to say what its answers mean.
				if ( ! $form ) {
					continue;
				}

				$line = array( $submission['id'] );

				if ( ! $form_id ) {
					$line[] = self::csv_safe( $form['title'] );
				}

				$line[]  = Utill::format_datetime( $submission['created_at'] );
				$line[]  = $submission['status'];
				$answers = array();

				foreach ( Formatter::rows( $form, $submission['data'] ) as $row ) {
					// Two questions of one form with the same label share the column.
					$answers[ $row['label'] ] = isset( $answers[ $row['label'] ] ) && '' !== $answers[ $row['label'] ] && '' !== $row['text'] ? $answers[ $row['label'] ] . ' | ' . $row['text'] : ( $answers[ $row['label'] ] ?? '' ) . $row['text'];
				}

				foreach ( $labels as $label ) {
					$line[] = self::csv_safe( $answers[ $label ] ?? '' );
				}

				fputcsv( $out, $line, ',', '"', '\\' );
			}

			++$filters['page'];
		} while ( 500 === $fetched );

		fclose( $out ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_fclose
		exit;
	}

	/**
	 * Sends an uploaded file to an administrator.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_Error|void
	 */
	public function download_file( $request ) {
		$submission = VuloForm()->submissions->get( absint( $request['id'] ) );
		$key        = sanitize_key( (string) $request->get_param( 'key' ) );
		$record     = $submission['data'][ $key ][ absint( $request->get_param( 'index' ) ) ] ?? null;
		$path       = is_array( $record ) ? Uploads::path( $record ) : '';

		if ( '' === $path ) {
			return $this->not_found();
		}

		nocache_headers();
		// Always a download, never rendered: an uploaded file must not run in the admin's browser.
		header( 'Content-Type: application/octet-stream' );
		header( 'Content-Disposition: attachment; filename="' . sanitize_file_name( (string) $record['name'] ) . '"' );
		header( 'Content-Length: ' . filesize( $path ) );
		header( 'X-Content-Type-Options: nosniff' );

		readfile( $path ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_system_operations_readfile -- streaming a private file to an authorised user.
		exit;
	}

	/**
	 * @param \WP_REST_Request $request Request.
	 * @param int              $form_id Form id.
	 * @return array Repository query arguments.
	 */
	private function filters( $request, $form_id ) {
		$status = sanitize_key( (string) $request->get_param( 'status' ) );

		return array(
			'form_id'  => $form_id,
			'status'   => in_array( $status, array_merge( SubmissionRepository::STATUSES, array( 'inbox' ) ), true ) ? $status : 'inbox',
			'search'   => sanitize_text_field( (string) $request->get_param( 'search' ) ),
			'after'    => self::day_boundary( $request->get_param( 'after' ), '00:00:00' ),
			'before'   => self::day_boundary( $request->get_param( 'before' ), '23:59:59' ),
			'page'     => absint( $request->get_param( 'page' ) ),
			'per_page' => absint( $request->get_param( 'per_page' ) ),
			'order'    => sanitize_key( (string) $request->get_param( 'order' ) ),
		);
	}

	/**
	 * One row of the list: the first few answers as a preview.
	 *
	 * @param array|null $form       Form, or null when it could not be resolved (an orphaned
	 *                               submission left behind by a form that no longer exists).
	 * @param array      $submission Submission.
	 * @return array
	 */
	private function summary( ?array $form, array $submission ) {
		$preview = array();

		if ( $form ) {
			foreach ( Formatter::rows( $form, $submission['data'] ) as $row ) {
				if ( '' !== $row['text'] && 'hidden' !== $row['type'] && count( $preview ) < 3 ) {
					$preview[] = array(
						'label' => $row['label'],
						'text'  => mb_substr( $row['text'], 0, 120 ),
					);
				}
			}
		}

		return array(
			'id'                 => $submission['id'],
			'form_id'            => $submission['form_id'],
			'form_title'         => $form ? $form['title'] : '',
			'status'             => $submission['status'],
			'created_at'         => $submission['created_at'],
			'created_at_display' => Utill::format_datetime( $submission['created_at'] ),
			'preview'            => $preview,
		);
	}

	/**
	 * Turns a calendar day into a UTC datetime, reading the day in the site's timezone.
	 *
	 * @param mixed  $day  `Y-m-d`.
	 * @param string $time `H:i:s` within that day.
	 * @return string UTC `Y-m-d H:i:s`, or ''.
	 */
	private static function day_boundary( $day, $time ) {
		$day = is_string( $day ) ? trim( $day ) : '';

		if ( ! preg_match( '/^\d{4}-\d{2}-\d{2}$/', $day ) ) {
			return '';
		}

		$local = date_create( $day . ' ' . $time, wp_timezone() );

		return $local ? $local->setTimezone( new \DateTimeZone( 'UTC' ) )->format( 'Y-m-d H:i:s' ) : '';
	}

	/**
	 * Stops a spreadsheet from running a submitted value as a formula.
	 *
	 * @param string $value Cell text.
	 * @return string
	 */
	public static function csv_safe( $value ) {
		return preg_match( '/^[=+\-@\t\r]/', (string) $value ) ? "'" . $value : (string) $value;
	}
}
