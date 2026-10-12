<?php
/**
 * Submission processing, spam protection, notifications and webhook tests.
 *
 * @package VuloForm
 */

namespace VuloForm\Tests;

use Brain\Monkey\Actions;
use Brain\Monkey\Functions;
use VuloForm\Forms\Schema;
use VuloForm\Notifications\Notifier;
use VuloForm\Notifications\Webhooks;
use VuloForm\Rest\Submissions as SubmissionsRest;
use VuloForm\Security\Token;
use VuloForm\Submissions\Formatter;
use VuloForm\Submissions\Processor;
use VuloForm\Submissions\SubmissionRepository;
use VuloForm\Submissions\Uploads;

/**
 * Keeps submissions in memory.
 */
class FakeSubmissions extends SubmissionRepository {

	public $rows = array();

	public function insert( $form_id, array $data, array $meta = array(), $status = 'unread' ) {
		$id                = count( $this->rows ) + 1;
		$this->rows[ $id ] = array(
			'id'         => $id,
			'form_id'    => $form_id,
			'status'     => $status,
			'data'       => $data,
			'meta'       => $meta,
			'created_at' => '2026-10-09 12:00:00',
		);

		return $id;
	}

	public function get( $id ) {
		return $this->rows[ $id ] ?? null;
	}

	public function update_meta( $id, array $meta ) {
		$this->rows[ $id ]['meta'] = $meta;
	}
}

class TestSubmissions extends TestCase {

	/**
	 * @var FakeSubmissions
	 */
	private $store;

	protected function setUp(): void {
		parent::setUp();

		$this->store = new FakeSubmissions();
		$_SERVER['REMOTE_ADDR'] = '203.0.113.9';
	}

	private function form( array $fields, array $settings = array(), $status = 'published' ) {
		return array(
			'id'     => 5,
			'title'  => 'Contact',
			'status' => $status,
			'schema' => Schema::sanitize(
				array(
					'fields'   => $fields,
					'settings' => $settings,
				)
			),
		);
	}

	/** A request that passes the spam checks: a token issued ten seconds ago. */
	private function post( array $values, array $extra = array() ) {
		return array_merge(
			array(
				'vf'       => $values,
				'vf_token' => Token::issue( 5, time() - 10 ),
			),
			$extra
		);
	}

	private function contact_fields() {
		return array(
			array( 'type' => 'text', 'label' => 'Name', 'key' => 'name', 'required' => true, 'minlength' => 2 ),
			array( 'type' => 'email', 'label' => 'Email', 'key' => 'email', 'required' => true ),
			array( 'type' => 'select', 'label' => 'Topic', 'key' => 'topic', 'options' => array( 'Sales', 'Support' ) ),
			array( 'type' => 'number', 'label' => 'Seats', 'key' => 'seats', 'min' => 1, 'max' => 10 ),
		);
	}

	public function test_a_valid_submission_is_stored_and_announced() {
		Actions\expectDone( 'vuloform_submission_created' )->once();

		$result = ( new Processor( $this->store ) )->handle(
			$this->form( $this->contact_fields() ),
			$this->post( array( 'name' => ' Jane <b>Doe</b> ', 'email' => 'jane@example.com', 'topic' => 'Sales', 'seats' => '3', 'not_a_field' => 'x' ) )
		);

		$this->assertTrue( $result['success'] );
		$this->assertSame( 1, $result['submission_id'] );
		$this->assertSame(
			array( 'name' => 'Jane Doe', 'email' => 'jane@example.com', 'topic' => 'Sales', 'seats' => '3' ),
			$this->store->rows[1]['data'],
			'Values are sanitized and anything that is not a field of the form is ignored.'
		);
		$this->assertSame( 'unread', $this->store->rows[1]['status'] );
		$this->assertArrayNotHasKey( 'ip', $this->store->rows[1]['meta'], 'The IP address is not stored unless the site owner opts in.' );
	}

	public function test_typed_backslashes_survive_and_the_confirmation_escapes_what_was_typed() {
		$form = $this->form(
			array( array( 'type' => 'text', 'label' => 'Path', 'key' => 'path' ) ),
			array( 'confirmation' => array( 'type' => 'message', 'message' => '<strong>Saved</strong> {path} for {form_title}' ) )
		);

		$result = ( new Processor( $this->store ) )->handle( $form, $this->post( array( 'path' => 'C:\\temp\\a & b' ) ) );

		$this->assertSame( 'C:\\temp\\a & b', $this->store->rows[1]['data']['path'], 'The REST route hands over unslashed values; they are stored as typed.' );
		$this->assertSame( '<strong>Saved</strong> C:\\temp\\a &amp; b for Contact', $result['message'], 'The owner\'s HTML is kept, the visitor\'s text is escaped.' );
	}

	public function test_a_form_that_needs_an_inactive_extension_refuses_submissions() {
		$form = $this->form(
			$this->contact_fields(),
			array( 'extensions' => array( 'payments' => array( 'enabled' => true, 'needs_module' => true, 'amount' => '20.00' ) ) )
		);

		$result = ( new Processor( $this->store ) )->handle( $form, $this->post( array( 'name' => 'Jane', 'email' => 'jane@example.com' ) ) );

		$this->assertFalse( $result['success'], 'A form that should take a payment must not quietly accept submissions for free.' );
		$this->assertSame( array(), $this->store->rows );
		$this->assertCount( 1, Schema::problems( $form['schema'] ) );

		$form['schema']['settings']['extensions']['payments']['enabled'] = false;

		$this->assertTrue( ( new Processor( $this->store ) )->handle( $form, $this->post( array( 'name' => 'Jane', 'email' => 'jane@example.com' ) ) )['success'] );
	}

	public function test_required_and_invalid_values_are_rejected_on_the_server() {
		$form   = $this->form( $this->contact_fields() );
		$result = ( new Processor( $this->store ) )->handle( $form, $this->post( array( 'name' => 'J', 'email' => 'nope', 'topic' => 'Hacked', 'seats' => '99' ) ) );
		$ids    = array_column( $form['schema']['fields'], 'id', 'key' );

		$this->assertFalse( $result['success'] );
		$this->assertCount( 4, $result['errors'] );
		$this->assertArrayHasKey( $ids['topic'], $result['errors'], 'A value the dropdown does not offer is refused.' );
		$this->assertSame( array(), $this->store->rows );

		$missing = ( new Processor( $this->store ) )->handle( $form, $this->post( array() ) );

		$this->assertSame( array( $ids['name'], $ids['email'] ), array_keys( $missing['errors'] ) );
	}

	public function test_hidden_conditional_fields_are_neither_required_nor_stored() {
		$form = $this->form(
			array(
				array( 'type' => 'radio', 'label' => 'Type', 'key' => 'type', 'required' => true, 'options' => array( 'Person', 'Business' ) ),
				array(
					'type'       => 'text',
					'label'      => 'Company',
					'key'        => 'company',
					'required'   => true,
					'conditions' => array( 'enabled' => true, 'action' => 'show', 'rules' => array( array( 'field' => 'type', 'operator' => 'is', 'value' => 'Business' ) ) ),
				),
			)
		);

		// The browser claims the field is hidden but sends a value anyway: it is dropped.
		$person = ( new Processor( $this->store ) )->handle( $form, $this->post( array( 'type' => 'Person', 'company' => 'Sneaky Ltd' ) ) );

		$this->assertTrue( $person['success'] );
		$this->assertSame( array( 'type' => 'Person' ), $this->store->rows[1]['data'] );

		// And when the field is visible, its "required" is enforced whatever the browser did.
		$business = ( new Processor( $this->store ) )->handle( $form, $this->post( array( 'type' => 'Business' ) ) );

		$this->assertFalse( $business['success'] );
		$this->assertCount( 1, $business['errors'] );
	}

	public function test_calculations_are_computed_on_the_server() {
		$form = $this->form(
			array(
				array( 'type' => 'number', 'label' => 'Qty', 'key' => 'qty' ),
				array( 'type' => 'calculation', 'label' => 'Total', 'key' => 'total', 'formula' => '{qty} * 19.99', 'decimals' => 2 ),
			)
		);

		( new Processor( $this->store ) )->handle( $form, $this->post( array( 'qty' => '3', 'total' => '0.01' ) ) );

		$this->assertSame( '59.97', $this->store->rows[1]['data']['total'], 'A total sent by the browser is ignored.' );
	}

	public function test_compound_checkbox_and_consent_values() {
		$form = $this->form(
			array(
				array( 'type' => 'name', 'label' => 'Name', 'key' => 'name', 'required' => true ),
				array( 'type' => 'checkboxes', 'label' => 'Extras', 'key' => 'extras', 'options' => array( 'A', 'B', 'C' ) ),
				array( 'type' => 'consent', 'label' => 'Agree', 'key' => 'agree', 'required' => true ),
			)
		);

		$ok = ( new Processor( $this->store ) )->handle( $form, $this->post( array( 'name' => array( 'first' => 'Jane', 'last' => 'Doe', 'evil' => 'x' ), 'extras' => array( 'A', 'C' ), 'agree' => '1' ) ) );

		$this->assertTrue( $ok['success'] );
		$this->assertSame( array( 'first' => 'Jane', 'last' => 'Doe' ), $this->store->rows[1]['data']['name'] );
		$this->assertSame( array( 'A', 'C' ), $this->store->rows[1]['data']['extras'] );

		$bad = ( new Processor( $this->store ) )->handle( $form, $this->post( array( 'name' => array( 'first' => '' ), 'extras' => array( 'A', 'Z' ) ) ) );

		$this->assertCount( 3, $bad['errors'], 'Empty name, an unknown checkbox value and missing consent.' );
	}

	public function test_spam_protection() {
		$form      = $this->form( $this->contact_fields() );
		$processor = new Processor( $this->store );
		$values    = array( 'name' => 'Jane', 'email' => 'jane@example.com' );

		Actions\expectDone( 'vuloform_submission_created' )->never();

		$no_token = $processor->handle( $form, array( 'vf' => $values ) );
		$forged   = $processor->handle( $form, array( 'vf' => $values, 'vf_token' => time() . '.forged' ) );
		$other    = $processor->handle( $form, array( 'vf' => $values, 'vf_token' => Token::issue( 99, time() - 10 ) ) );

		$this->assertFalse( $no_token['success'] );
		$this->assertFalse( $forged['success'] );
		$this->assertFalse( $other['success'], 'A token issued for another form is refused.' );
		$this->assertSame( array(), $this->store->rows );

		// A filled honeypot and an instant submission are accepted silently and filed as spam.
		$honeypot = $processor->handle( $form, $this->post( $values, array( 'vf_website' => 'http://spam.example' ) ) );
		$too_fast = $processor->handle( $form, array( 'vf' => $values, 'vf_token' => Token::issue( 5 ) ) );

		$this->assertTrue( $honeypot['success'] );
		$this->assertTrue( $too_fast['success'] );
		$this->assertSame( array( 'spam', 'spam' ), array_column( $this->store->rows, 'status' ) );
	}

	public function test_the_trap_field_and_fill_time_are_site_settings_and_can_be_switched_off() {
		$this->options['vuloform_settings'] = array(
			'honeypot'    => false,
			'min_seconds' => 0,
		);

		$form      = $this->form( $this->contact_fields() );
		$processor = new Processor( $this->store );
		$values    = array( 'name' => 'Jane', 'email' => 'jane@example.com' );

		$processor->handle( $form, $this->post( $values, array( 'vf_website' => 'http://spam.example' ) ) );
		$processor->handle( $form, array( 'vf' => $values, 'vf_token' => Token::issue( 5 ) ) );

		$this->assertSame( array( 'unread', 'unread' ), array_column( $this->store->rows, 'status' ) );
		$this->assertStringNotContainsString( 'name="vf_website"', \VuloForm\Frontend\Renderer::render( $form ) );
	}

	/** A form with reCAPTCHA switched on, on a site whose keys are saved. */
	private function recaptcha_form( $type = 'v2' ) {
		$this->options['vuloform_settings'] = array(
			'recaptcha_type'       => $type,
			'recaptcha_site_key'   => 'site-key',
			'recaptcha_secret_key' => 'secret-key',
			'recaptcha_score'      => 0.5,
		);

		return $this->form( $this->contact_fields(), array( 'spam' => array( 'recaptcha' => true ) ) );
	}

	/** Makes Google answer a verification request with the given body, and records what was sent. */
	private function google_answers( $body, &$sent = null ) {
		Functions\when( 'wp_remote_post' )->alias(
			static function ( $url, $args ) use ( $body, &$sent ) {
				$sent = array( 'url' => $url, 'body' => $args['body'] );

				return null === $body ? new \WP_Error( 'http_request_failed', 'timeout' ) : array( 'body' => json_encode( $body ) );
			}
		);
		Functions\when( 'wp_remote_retrieve_response_code' )->justReturn( 200 );
		Functions\when( 'wp_remote_retrieve_body' )->alias(
			static function ( $response ) {
				return $response['body'];
			}
		);
	}

	public function test_recaptcha_refuses_a_submission_without_a_token_and_never_asks_google() {
		Functions\expect( 'wp_remote_post' )->never();

		$result = ( new Processor( $this->store ) )->handle( $this->recaptcha_form(), $this->post( array( 'name' => 'Jane', 'email' => 'jane@example.com' ) ) );

		$this->assertFalse( $result['success'] );
		$this->assertStringContainsString( 'not a robot', $result['message'] );
		$this->assertSame( array(), $this->store->rows );
	}

	public function test_recaptcha_accepts_a_token_google_confirms_and_sends_only_the_secret_and_token() {
		$this->google_answers( array( 'success' => true ), $sent );

		$result = ( new Processor( $this->store ) )->handle(
			$this->recaptcha_form(),
			$this->post( array( 'name' => 'Jane', 'email' => 'jane@example.com' ), array( 'g-recaptcha-response' => 'token-1' ) )
		);

		$this->assertTrue( $result['success'] );
		$this->assertSame( 'unread', $this->store->rows[1]['status'] );
		$this->assertSame( 'https://www.google.com/recaptcha/api/siteverify', $sent['url'] );
		$this->assertSame( array( 'secret' => 'secret-key', 'response' => 'token-1' ), $sent['body'], 'The visitor\'s IP address is not sent to Google.' );
	}

	public function test_recaptcha_refuses_a_token_google_rejects() {
		$this->google_answers( array( 'success' => false, 'error-codes' => array( 'timeout-or-duplicate' ) ) );

		$result = ( new Processor( $this->store ) )->handle(
			$this->recaptcha_form(),
			$this->post( array( 'name' => 'Jane', 'email' => 'jane@example.com' ), array( 'g-recaptcha-response' => 'used-token' ) )
		);

		$this->assertFalse( $result['success'] );
		$this->assertSame( array(), $this->store->rows );
	}

	public function test_a_low_recaptcha_v3_score_is_filed_as_spam_and_a_wrong_action_is_refused() {
		$values = array( 'name' => 'Jane', 'email' => 'jane@example.com' );

		$this->google_answers( array( 'success' => true, 'score' => 0.2, 'action' => 'vuloform_submit' ) );
		$low = ( new Processor( $this->store ) )->handle( $this->recaptcha_form( 'v3' ), $this->post( $values, array( 'g-recaptcha-response' => 't' ) ) );

		$this->assertTrue( $low['success'], 'The sender is not told.' );
		$this->assertSame( 'spam', $this->store->rows[1]['status'] );

		$this->google_answers( array( 'success' => true, 'score' => 0.9, 'action' => 'vuloform_submit' ) );
		$high = ( new Processor( $this->store ) )->handle( $this->recaptcha_form( 'v3' ), $this->post( $values, array( 'g-recaptcha-response' => 't' ) ) );

		$this->assertSame( 'unread', $this->store->rows[2]['status'] );
		$this->assertTrue( $high['success'] );

		$this->google_answers( array( 'success' => true, 'score' => 0.9, 'action' => 'login' ) );
		$other = ( new Processor( $this->store ) )->handle( $this->recaptcha_form( 'v3' ), $this->post( $values, array( 'g-recaptcha-response' => 't' ) ) );

		$this->assertFalse( $other['success'] );
	}

	public function test_recaptcha_lets_a_submission_through_when_google_cannot_be_reached() {
		$this->google_answers( null );

		$result = ( new Processor( $this->store ) )->handle(
			$this->recaptcha_form(),
			$this->post( array( 'name' => 'Jane', 'email' => 'jane@example.com' ), array( 'g-recaptcha-response' => 'token-1' ) )
		);

		$this->assertTrue( $result['success'] );
	}

	public function test_recaptcha_does_nothing_until_the_keys_are_saved() {
		Functions\expect( 'wp_remote_post' )->never();

		$form   = $this->form( $this->contact_fields(), array( 'spam' => array( 'recaptcha' => true ) ) );
		$result = ( new Processor( $this->store ) )->handle( $form, $this->post( array( 'name' => 'Jane', 'email' => 'jane@example.com' ) ) );

		$this->assertTrue( $result['success'] );
	}

	public function test_a_notification_with_conditions_is_sent_only_for_matching_answers() {
		$this->options['vuloform_settings'] = array( 'rate_limit' => 0 );

		$form = $this->form(
			$this->contact_fields(),
			array(
				'notifications' => array(
					array(
						'id'         => 'n1',
						'name'       => 'Sales team',
						'enabled'    => true,
						'channel'    => 'email',
						'to'         => 'sales@example.com',
						'subject'    => 'Lead',
						'message'    => '{all_fields}',
						'conditions' => array( 'enabled' => true, 'match' => 'all', 'rules' => array( array( 'field' => 'topic', 'operator' => 'is', 'value' => 'Sales' ) ) ),
					),
				),
			)
		);

		$notifier = new Notifier( $this->store );
		$mails    = array();

		Functions\when( 'wp_mail' )->alias(
			static function ( $to ) use ( &$mails ) {
				$mails[] = $to;

				return true;
			}
		);

		$sales_id   = $this->store->insert( 5, array() );
		$support_id = $this->store->insert( 5, array() );

		$notifier->send_all( $sales_id, array( 'name' => 'Jane', 'email' => 'jane@example.com', 'topic' => 'Sales' ), $form );
		$notifier->send_all( $support_id, array( 'name' => 'Sam', 'email' => 'sam@example.com', 'topic' => 'Support' ), $form );

		$this->assertCount( 1, $mails, 'Only the Sales submission is emailed.' );
		$this->assertSame( 'skipped', $this->store->rows[ $support_id ]['meta']['events'][0]['status'], 'The skipped notification is recorded on the submission.' );
		$this->assertNotSame( 'skipped', $this->store->rows[ $sales_id ]['meta']['events'][0]['status'] );
	}

	public function test_the_confirmation_follows_the_answers_and_falls_back_to_the_usual_one() {
		$form = $this->form(
			$this->contact_fields(),
			array(
				'confirmation' => array(
					'type'         => 'message',
					'message'      => 'Thanks {name}.',
					'redirect_url' => '',
					'rules'        => array(
						array(
							'type'         => 'redirect',
							'redirect_url' => 'https://shop.example.com/book-a-call',
							'conditions'   => array( 'match' => 'all', 'rules' => array( array( 'field' => 'topic', 'operator' => 'is', 'value' => 'Sales' ) ) ),
						),
						// Its only rule is about a field the form does not have, so it never applies.
						array(
							'type'       => 'message',
							'message'    => 'Should never show.',
							'conditions' => array( 'rules' => array( array( 'field' => 'gone', 'operator' => 'is', 'value' => 'x' ) ) ),
						),
					),
				),
			)
		);

		$confirmation = $form['schema']['settings']['confirmation'];

		$this->assertSame( 'https://shop.example.com/book-a-call', Processor::confirmation_for( $confirmation, array( 'topic' => 'Sales' ) )['redirect_url'] );
		$this->assertSame( 'Thanks {name}.', Processor::confirmation_for( $confirmation, array( 'topic' => 'Support' ) )['message'] );
		$this->assertSame( 'Thanks {name}.', Processor::confirmation_for( $confirmation, array() )['message'], 'A hidden or unanswered field counts as empty.' );

		$this->options['vuloform_settings'] = array( 'rate_limit' => 0 );

		$sales = ( new Processor( $this->store ) )->handle( $form, $this->post( array( 'name' => 'Jane', 'email' => 'jane@example.com', 'topic' => 'Sales' ) ) );
		$other = ( new Processor( $this->store ) )->handle( $form, $this->post( array( 'name' => 'Sam', 'email' => 'sam@example.com', 'topic' => 'Support' ) ) );

		$this->assertSame( 'https://shop.example.com/book-a-call', $sales['redirect'] );
		$this->assertSame( '', $other['redirect'] );
		$this->assertStringContainsString( 'Thanks Sam', $other['message'] );
	}

	public function test_a_webhook_with_conditions_is_queued_only_for_matching_answers() {
		$form = $this->form(
			$this->contact_fields(),
			array(
				'webhooks' => array(
					array(
						'id'         => 'w1',
						'name'       => 'CRM',
						'enabled'    => true,
						'url'        => 'https://crm.example.com/hook',
						'conditions' => array( 'enabled' => true, 'match' => 'any', 'rules' => array( array( 'field' => 'seats', 'operator' => 'gt', 'value' => '5' ) ) ),
					),
				),
			)
		);

		$queued = array();

		Functions\when( 'wp_schedule_single_event' )->alias(
			static function ( $time, $hook, $args ) use ( &$queued ) {
				$queued[] = $args[0];

				return true;
			}
		);

		$webhooks = new Webhooks( new \VuloForm\Forms\FormRepository(), $this->store );

		$webhooks->queue( 11, array( 'seats' => '8' ), $form );
		$webhooks->queue( 12, array( 'seats' => '2' ), $form );

		$this->assertSame( array( 11 ), $queued );
	}

	public function test_rate_limit_and_drafts() {
		$this->options['vuloform_settings'] = array( 'rate_limit' => 2 );

		$form      = $this->form( $this->contact_fields() );
		$processor = new Processor( $this->store );
		$post      = $this->post( array( 'name' => 'Jane', 'email' => 'jane@example.com' ) );

		$this->assertTrue( $processor->handle( $form, $post )['success'] );
		$this->assertTrue( $processor->handle( $form, $post )['success'] );

		$third = $processor->handle( $form, $post );

		$this->assertFalse( $third['success'] );
		$this->assertStringContainsString( 'too quickly', $third['message'] );

		$draft = $processor->handle( $this->form( $this->contact_fields(), array(), 'draft' ), $post );

		$this->assertFalse( $draft['success'], 'A draft form accepts nothing.' );
	}

	public function test_redirect_confirmation_and_not_storing_submissions() {
		$form = $this->form(
			$this->contact_fields(),
			array(
				'store_submissions' => false,
				'confirmation'      => array( 'type' => 'redirect', 'redirect_url' => 'https://shop.example.com/thanks' ),
			)
		);

		$result = ( new Processor( $this->store ) )->handle( $form, $this->post( array( 'name' => 'Jane', 'email' => 'jane@example.com' ) ) );

		$this->assertTrue( $result['success'] );
		$this->assertSame( 'https://shop.example.com/thanks', $result['redirect'] );
		$this->assertSame( 0, $result['submission_id'] );
		$this->assertSame( array(), $this->store->rows );
	}

	public function test_uploads_reject_what_was_not_really_uploaded_and_unsafe_names() {
		$field = Schema::sanitize( array( 'fields' => array( array( 'type' => 'file', 'label' => 'CV', 'allowed_types' => array( 'pdf' ), 'max_size_mb' => 1, 'max_files' => 1 ) ) ) )['fields'][0];
		$tmp   = tempnam( sys_get_temp_dir(), 'vf' );

		// A path that PHP did not receive as an upload is never accepted.
		$this->assertNotSame( '', Uploads::validate( $field, array( array( 'name' => 'cv.pdf', 'tmp_name' => $tmp, 'size' => 10, 'error' => UPLOAD_ERR_OK ) ) ) );
		$this->assertNotSame( '', Uploads::validate( $field, array( array( 'name' => 'a.pdf', 'tmp_name' => $tmp, 'size' => 1, 'error' => 0 ), array( 'name' => 'b.pdf', 'tmp_name' => $tmp, 'size' => 1, 'error' => 0 ) ) ), 'More files than the field allows.' );

		unlink( $tmp ); // phpcs:ignore

		$this->assertSame( '', Uploads::path( array( 'path' => '../../wp-config.php' ) ), 'A stored path can never point outside the upload folder.' );
		$this->assertSame( array(), Uploads::normalise( array( 'name' => array( '' ), 'tmp_name' => array( '' ), 'size' => array( 0 ), 'error' => array( UPLOAD_ERR_NO_FILE ) ) ) );
	}

	public function test_formatter_and_placeholders() {
		$form   = $this->form(
			array(
				array( 'type' => 'name', 'label' => 'Name', 'key' => 'name' ),
				array( 'type' => 'select', 'label' => 'Plan', 'key' => 'plan', 'options' => array( array( 'label' => 'Professional', 'value' => 'pro' ) ) ),
				array( 'type' => 'file', 'label' => 'CV', 'key' => 'cv' ),
				array( 'type' => 'hidden', 'label' => 'Source', 'key' => 'source' ),
			)
		);
		$values = array(
			'name'   => array( 'first' => 'Jane', 'last' => 'Doe' ),
			'plan'   => 'pro',
			'cv'     => array( array( 'name' => 'cv.pdf', 'path' => 'abc/def.pdf', 'size' => 10, 'type' => 'application/pdf' ) ),
			'source' => 'ad',
		);

		$text = Formatter::fill( "Hi {name}, plan {plan}, {missing}!\n{all_fields}\n{form_title}", $form, $values );

		$this->assertStringContainsString( 'Hi Jane Doe, plan Professional, !', $text );
		$this->assertStringContainsString( 'CV: cv.pdf', $text );
		$this->assertStringNotContainsString( 'abc/def.pdf', $text, 'A stored file path never leaves the server.' );
		$this->assertStringNotContainsString( 'Source: ad', $text, 'Hidden fields are left out of {all_fields}.' );
		$this->assertStringContainsString( 'Contact', $text );
	}

	public function test_email_notification_is_built_safely_and_recorded_as_handed_off() {
		$sent = array();

		Functions\when( 'wp_mail' )->alias(
			static function ( $to, $subject, $message, $headers ) use ( &$sent ) {
				$sent[] = compact( 'to', 'subject', 'message', 'headers' );

				return true;
			}
		);

		$form = $this->form(
			$this->contact_fields(),
			array(
				'notifications' => array(
					array( 'name' => 'Admin', 'enabled' => true, 'channel' => 'email', 'to' => 'owner@example.com, {email}, not-an-address', 'subject' => "New: {name}", 'message' => '', 'reply_to' => 'email' ),
					array( 'name' => 'Off', 'enabled' => false, 'channel' => 'email', 'to' => 'x@example.com' ),
					array( 'name' => 'Text', 'enabled' => true, 'channel' => 'sms', 'to' => '+14155550123' ),
				),
			)
		);

		$id = $this->store->insert( 5, array( 'name' => "Jane\r\nBcc: evil@example.com", 'email' => 'jane@example.com' ) );

		( new Notifier( $this->store ) )->send_all( $id, $this->store->rows[ $id ]['data'], $form );

		$this->assertCount( 1, $sent );
		$this->assertSame( array( 'owner@example.com', 'jane@example.com' ), $sent[0]['to'] );
		$this->assertStringNotContainsString( "\n", $sent[0]['subject'], 'A subject can never carry an injected header.' );
		$this->assertContains( 'Reply-To: jane@example.com', $sent[0]['headers'] );
		$this->assertStringContainsString( 'Email: jane@example.com', $sent[0]['message'] );

		$events = $this->store->rows[ $id ]['meta']['events'];

		$this->assertSame( array( 'handed_off', 'skipped' ), array_column( $events, 'status' ), 'Email is "handed off", never "delivered"; SMS is skipped without VuloMail.' );
	}

	public function test_a_visitor_cannot_turn_a_notification_into_a_mass_mailing() {
		$sent = array();

		Functions\when( 'wp_mail' )->alias(
			static function ( $to ) use ( &$sent ) {
				$sent = $to;

				return true;
			}
		);

		$form = $this->form(
			array( array( 'type' => 'text', 'label' => 'Friends', 'key' => 'friends' ) ),
			array( 'notifications' => array( array( 'name' => 'Invite', 'enabled' => true, 'channel' => 'email', 'to' => '{friends}' ) ) )
		);

		$typed = array();

		for ( $i = 1; $i <= 40; $i++ ) {
			$typed[] = "stranger{$i}@example.com";
		}

		( new Notifier( $this->store ) )->send_email( $form['schema']['settings']['notifications'][0], $form, array( 'friends' => implode( ', ', $typed ) . ', stranger1@example.com' ) );

		$this->assertCount( Notifier::MAX_RECIPIENTS, $sent );
	}

	public function test_webhook_destinations_are_restricted() {
		$this->assertSame( '', Webhooks::url_problem( 'https://hooks.example.com/in' ) );
		$this->assertNotSame( '', Webhooks::url_problem( 'http://hooks.example.com/in' ) );
		$this->assertNotSame( '', Webhooks::url_problem( 'https://user:pass@hooks.example.com/in' ) );
		$this->assertNotSame( '', Webhooks::url_problem( 'https://127.0.0.1/admin' ) );
		$this->assertNotSame( '', Webhooks::url_problem( 'https://192.168.1.10/router' ) );
		$this->assertNotSame( '', Webhooks::url_problem( 'ftp://example.com' ) );
		$this->assertNotSame( '', Webhooks::url_problem( '' ) );
		$this->assertNotSame( '', Webhooks::url_problem( 'https://internal.example.com/in' ), 'A public name that resolves to a private address is refused.' );
		$this->assertNotSame( '', Webhooks::url_problem( 'https://mixed.example.com/in' ), 'One private address among several is enough to refuse.' );
		$this->assertNotSame( '', Webhooks::url_problem( 'https://unknown.example.com/in' ), 'A name that does not resolve is refused.' );
		$this->assertNotSame( '', Webhooks::url_problem( 'https://169.254.169.254/latest/meta-data' ) );
	}

	public function test_webhook_request_is_signed_and_failures_are_classified() {
		$requests = array();
		$answer   = array( 'response' => array( 'code' => 200 ) );

		Functions\when( 'wp_safe_remote_post' )->alias(
			static function ( $url, $args ) use ( &$requests, &$answer ) {
				$requests[] = compact( 'url', 'args' );

				return $answer;
			}
		);
		Functions\when( 'wp_remote_retrieve_response_code' )->alias(
			static function ( $response ) {
				return $response['response']['code'];
			}
		);

		$form     = $this->form( $this->contact_fields() );
		$webhook  = array( 'id' => 'w1', 'name' => 'CRM', 'enabled' => true, 'url' => 'https://hooks.example.com/in', 'secret' => 's3cret', 'fields' => array( 'email' ) );
		$webhooks = new Webhooks( new \VuloForm\Forms\FormRepository(), $this->store );
		$values   = array( 'name' => 'Jane', 'email' => 'jane@example.com' );

		$ok      = $webhooks->send( $webhook, $form, 12, $values, '2026-10-09 12:00:00' );
		$body    = $requests[0]['args']['body'];
		$payload = json_decode( $body, true );

		$this->assertSame( 'delivered', $ok['status'] );
		$this->assertSame( array( 'email' => 'jane@example.com' ), $payload['fields'], 'Only the chosen fields are sent.' );
		$this->assertSame( 'sha256=' . hash_hmac( 'sha256', $body, 's3cret' ), $requests[0]['args']['headers']['X-VuloForm-Signature'] );
		$this->assertSame( '12-w1', $requests[0]['args']['headers']['X-VuloForm-Delivery'] );
		$this->assertSame( 0, $requests[0]['args']['redirection'] );
		$this->assertStringNotContainsString( 's3cret', wp_json_encode( $ok ), 'The secret is never written to the log.' );

		$answer = array( 'response' => array( 'code' => 503 ) );
		$this->assertSame( 'retry', $webhooks->send( $webhook, $form, 12, $values, '2026-10-09 12:00:00' )['status'] );

		$answer = array( 'response' => array( 'code' => 404 ) );
		$this->assertSame( 'failed', $webhooks->send( $webhook, $form, 12, $values, '2026-10-09 12:00:00' )['status'], 'A 4xx is not retried.' );

		$webhook['url'] = 'https://10.0.0.5/internal';
		$before         = count( $requests );

		$this->assertSame( 'failed', $webhooks->send( $webhook, $form, 12, $values, '2026-10-09 12:00:00' )['status'] );
		$this->assertCount( $before, $requests, 'No request is made to a private address.' );
	}

	public function test_csv_cells_cannot_run_as_formulas() {
		$this->assertSame( "'=HYPERLINK(\"http://evil\")", SubmissionsRest::csv_safe( '=HYPERLINK("http://evil")' ) );
		$this->assertSame( "'+1+1", SubmissionsRest::csv_safe( '+1+1' ) );
		$this->assertSame( "'@SUM(A1)", SubmissionsRest::csv_safe( '@SUM(A1)' ) );
		$this->assertSame( 'Jane', SubmissionsRest::csv_safe( 'Jane' ) );
	}
}
