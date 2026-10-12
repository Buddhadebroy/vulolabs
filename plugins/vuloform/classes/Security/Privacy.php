<?php
/**
 * Privacy class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Security;

use VuloForm\Submissions\Formatter;
use VuloForm\Utill;

defined( 'ABSPATH' ) || exit;

/**
 * Connects submissions to WordPress's personal data tools (Tools → Export / Erase Personal Data).
 *
 * A person's submissions are those they sent while logged in, plus any that contain their email
 * address.
 */
class Privacy {

	/**
	 * Privacy constructor.
	 */
	public function __construct() {
		add_filter( 'wp_privacy_personal_data_exporters', array( $this, 'register_exporter' ) );
		add_filter( 'wp_privacy_personal_data_erasers', array( $this, 'register_eraser' ) );
		add_action( 'admin_init', array( $this, 'add_policy_text' ) );
	}

	/**
	 * @param array $exporters Registered exporters.
	 * @return array
	 */
	public function register_exporter( $exporters ) {
		$exporters['vuloform'] = array(
			'exporter_friendly_name' => __( 'VuloForm submissions', 'vuloform' ),
			'callback'               => array( $this, 'export' ),
		);

		return $exporters;
	}

	/**
	 * @param array $erasers Registered erasers.
	 * @return array
	 */
	public function register_eraser( $erasers ) {
		$erasers['vuloform'] = array(
			'eraser_friendly_name' => __( 'VuloForm submissions', 'vuloform' ),
			'callback'             => array( $this, 'erase' ),
		);

		return $erasers;
	}

	/**
	 * @param string $email Person's email address.
	 * @param int    $page  Page of results.
	 * @return array{data: array, done: bool}
	 */
	public function export( $email, $page = 1 ) {
		$ids  = self::ids_for( $email, (int) $page );
		$data = array();

		foreach ( $ids as $id ) {
			$submission = VuloForm()->submissions->get( $id );
			$form       = $submission ? VuloForm()->forms->get( $submission['form_id'] ) : null;

			if ( ! $submission ) {
				continue;
			}

			$rows = array(
				array(
					'name'  => __( 'Submitted', 'vuloform' ),
					'value' => Utill::format_datetime( $submission['created_at'] ),
				),
			);

			if ( $form ) {
				foreach ( Formatter::rows( $form, $submission['data'] ) as $row ) {
					$rows[] = array(
						'name'  => $row['label'],
						'value' => $row['text'],
					);
				}
			}

			$data[] = array(
				'group_id'    => 'vuloform',
				'group_label' => __( 'Form submissions', 'vuloform' ),
				'item_id'     => 'vuloform-' . $id,
				'data'        => $rows,
			);
		}

		return array(
			'data' => $data,
			'done' => count( $ids ) < 50,
		);
	}

	/**
	 * @param string $email Person's email address.
	 * @param int    $page  Page of results.
	 * @return array{items_removed: int, items_retained: bool, messages: array, done: bool}
	 */
	public function erase( $email, $page = 1 ) { // phpcs:ignore Generic.CodeAnalysis.UnusedFunctionParameter.FoundAfterLastUsed -- signature required by WordPress.
		// Always the first page: each pass deletes what it finds.
		$ids     = self::ids_for( $email, 1 );
		$removed = $ids ? VuloForm()->submissions->delete( $ids ) : 0;

		return array(
			'items_removed'  => $removed,
			'items_retained' => false,
			'messages'       => array(),
			'done'           => count( $ids ) < 50,
		);
	}

	/**
	 * Suggests wording for the site's privacy policy.
	 *
	 * @return void
	 */
	public function add_policy_text() {
		if ( function_exists( 'wp_add_privacy_policy_content' ) ) {
			wp_add_privacy_policy_content(
				'VuloForm',
				wp_kses_post(
					'<p>' . __( 'When you submit a form on this site, the information you enter is stored so that we can respond to you. Files you upload are stored privately. We keep submissions for as long as needed for that purpose, and you can ask us to export or delete yours at any time.', 'vuloform' ) . '</p>'
					. ( Recaptcha::is_configured() ? '<p>' . __( 'Some forms on this site are protected by Google reCAPTCHA to stop spam. On pages with such a form, Google receives information about your device and how you use the page, under the Google Privacy Policy and Terms of Service.', 'vuloform' ) . '</p>' : '' )
				)
			);
		}
	}

	/**
	 * @param string $email Email address.
	 * @param int    $page  1-based page of 50.
	 * @return int[]
	 */
	private static function ids_for( $email, $page ) {
		global $wpdb;

		$user  = get_user_by( 'email', $email );
		$table = $wpdb->prefix . Utill::TABLES['submission'];

		// phpcs:ignore WordPress.DB.DirectDatabaseQuery.DirectQuery, WordPress.DB.DirectDatabaseQuery.NoCaching
		$ids = $wpdb->get_col(
			$wpdb->prepare(
				'SELECT id FROM %i WHERE ( user_id = %d AND user_id > 0 ) OR search_text LIKE %s ORDER BY id ASC LIMIT 50 OFFSET %d',
				$table,
				$user ? (int) $user->ID : 0,
				'%' . $wpdb->esc_like( $email ) . '%',
				( max( 1, $page ) - 1 ) * 50
			)
		);

		return array_map( 'intval', (array) $ids );
	}
}
