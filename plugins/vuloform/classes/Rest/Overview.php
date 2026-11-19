<?php
/**
 * Dashboard REST controller file.
 *
 * @package VuloForm
 */

namespace VuloForm\Rest;

use VuloForm\Utill;
use VuloForm\Security\Recaptcha;

defined( 'ABSPATH' ) || exit;

/**
 * GET /overview: everything the Dashboard tab shows, in one response.
 */
class Overview extends Controller {

	/**
	 * Registers GET /overview.
	 *
	 * @return void
	 */
	public function register_routes() {
		$this->route( '/overview', \WP_REST_Server::READABLE, 'get_items' );
	}

	/**
	 * Builds the Dashboard: totals for the period and the one before it, a zero-filled daily series,
	 * the busiest forms, and the state the "Needs you" list is worked out from.
	 *
	 * @param \WP_REST_Request $request Request.
	 * @return \WP_REST_Response
	 */
	public function get_items( $request ) {
		$days = in_array( absint( $request->get_param( 'days' ) ), array( 7, 30, 90 ), true ) ? absint( $request->get_param( 'days' ) ) : 30;

		// One point per day of the period, oldest first.
		$series = array();
		$start  = time() - ( $days - 1 ) * DAY_IN_SECONDS;

		for ( $i = 0; $i < $days; $i++ ) {
			$day            = gmdate( 'Y-m-d', $start + $i * DAY_IN_SECONDS );
			$series[ $day ] = array(
				'date'        => $day,
				'submissions' => 0,
				'spam'        => 0,
			);
		}

		$totals       = array(
			'submissions' => 0,
			'spam'        => 0,
		);
		$previous     = $totals;
		$by_form      = array();
		$period_start = gmdate( 'Y-m-d', $start );

		// The period before this one too, so each total can say how it changed.
		foreach ( VuloForm()->submissions->daily_counts( gmdate( 'Y-m-d 00:00:00', $start - $days * DAY_IN_SECONDS ) ) as $row ) {
			$key   = 'spam' === $row['status'] ? 'spam' : 'submissions';
			$total = (int) $row['total'];

			if ( (string) $row['day'] < $period_start ) {
				$previous[ $key ] += $total;
				continue;
			}

			$totals[ $key ] += $total;

			if ( isset( $series[ $row['day'] ] ) ) {
				$series[ $row['day'] ][ $key ] += $total;
			}

			if ( 'submissions' === $key ) {
				$by_form[ (int) $row['form_id'] ] = ( $by_form[ (int) $row['form_id'] ] ?? 0 ) + $total;
			}
		}

		// Forms: how many there are and how many are live, and the ones people used most in the period.
		$forms_total = (int) VuloForm()->forms->query( array( 'per_page' => 1 ) )['total'];
		$published   = (int) VuloForm()->forms->query(
			array(
				'status'   => 'published',
				'per_page' => 1,
			)
		)['total'];

		arsort( $by_form );
		$top_forms = array();

		foreach ( array_slice( $by_form, 0, 5, true ) as $form_id => $count ) {
			$title = $this->title( $form_id );

			if ( null !== $title ) {
				$top_forms[] = array(
					'id'    => $form_id,
					'title' => $title,
					'count' => $count,
				);
			}
		}

		// Unread across every form, and when the newest one came in.
		$unread = 0;

		foreach ( VuloForm()->submissions->counts_by_form() as $counts ) {
			$unread += $counts['unread'];
		}

		$failing  = VuloForm()->submissions->failing_notifications( gmdate( 'Y-m-d H:i:s', time() - 30 * DAY_IN_SECONDS ) );
		$settings = Utill::settings();

		return rest_ensure_response(
			array(
				'days'          => $days,
				'totals'        => $totals,
				'previous'      => $previous,
				'series'        => array_values( $series ),
				'top_forms'     => $top_forms,
				'forms'         => array(
					'total'     => $forms_total,
					'published' => $published,
				),
				'unread'        => $unread,
				'ever_received' => $this->ever_received(),
				'failing'       => array(
					'count'  => count( $failing ),
					'latest' => $failing ? array(
						'id'         => $failing[0]['id'],
						'form_id'    => $failing[0]['form_id'],
						'form_title' => (string) $this->title( $failing[0]['form_id'] ),
						'failed'     => $failing[0]['failed'],
						'day'        => Utill::format_datetime( $failing[0]['created_at'] ),
					) : null,
				),
				'spam_guard'    => array(
					'honeypot'  => (bool) $settings['honeypot'],
					'recaptcha' => Recaptcha::is_configured(),
				),
			)
		);
	}

	/**
	 * A form's name as the lists show it, or null when the form no longer exists.
	 *
	 * @param int $form_id Form id.
	 * @return string|null
	 */
	private function title( $form_id ) {
		$form = VuloForm()->forms->get( $form_id );

		if ( ! $form ) {
			return null;
		}

		return '' !== (string) $form['title'] ? (string) $form['title'] : __( '(no name)', 'vuloform' );
	}

	/**
	 * Whether any form has ever been sent, spam aside. Decides when the setup strip is done.
	 *
	 * @return bool
	 */
	private function ever_received() {
		foreach ( VuloForm()->submissions->counts_by_form() as $counts ) {
			if ( $counts['total'] > 0 ) {
				return true;
			}
		}

		return false;
	}
}
