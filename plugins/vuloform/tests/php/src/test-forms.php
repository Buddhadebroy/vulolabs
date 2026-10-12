<?php
/**
 * Schema, conditional logic and calculation tests.
 *
 * @package VuloForm
 */

namespace VuloForm\Tests;

use Brain\Monkey\Functions;
use VuloForm\Forms\Calculator;
use VuloForm\Forms\Conditions;
use VuloForm\Forms\Schema;
use VuloForm\Forms\Templates;
use VuloForm\Frontend\Renderer;

class TestForms extends TestCase {

	public function test_schema_rebuilds_fields_and_drops_unknown_keys() {
		$schema = Schema::sanitize(
			array(
				'fields' => array(
					array(
						'id'       => 'f_one',
						'type'     => 'text',
						'label'    => 'Your <b>name</b>',
						'required' => 1,
						'evil'     => '<script>',
					),
					array( 'label' => 'No type' ),
					'not-an-array',
				),
			)
		);

		$this->assertCount( 1, $schema['fields'] );
		$this->assertSame( 'f_one', $schema['fields'][0]['id'] );
		$this->assertSame( 'Your name', $schema['fields'][0]['label'] );
		$this->assertSame( 'your_name', $schema['fields'][0]['key'] );
		$this->assertTrue( $schema['fields'][0]['required'] );
		$this->assertArrayNotHasKey( 'evil', $schema['fields'][0] );
		$this->assertSame( VULOFORM_SCHEMA_VERSION, $schema['version'] );
	}

	public function test_fields_and_settings_of_an_inactive_extension_survive_a_save() {
		$input = array(
			'fields'   => array(
				array( 'type' => 'text', 'label' => 'Name', 'conditions' => array( 'enabled' => true, 'rules' => array( array( 'field' => 'sig', 'operator' => 'not_empty' ) ) ) ),
				array(
					'id'       => 'f_sig',
					'key'      => 'sig',
					'type'     => 'signature',
					'label'    => 'Sign <i>here</i>',
					'required' => true,
					'pen'      => array( 'color' => '#000', 'width' => 2, 'note' => '<script>x</script>ok' ),
				),
			),
			'settings' => array(
				'extensions' => array(
					'payments' => array( 'enabled' => true, 'amount' => '19.50', 'on-click' => 'x' ),
					'broken'   => 'not-an-array',
				),
			),
		);

		$once  = Schema::sanitize( $input );
		$twice = Schema::sanitize( $once );
		$field = $twice['fields'][1];

		$this->assertSame( 'signature', $field['type'] );
		$this->assertSame( 'f_sig', $field['id'] );
		$this->assertTrue( $field['required'], 'Settings the core cannot interpret are kept as they were.' );
		$this->assertSame( array( 'color' => '#000', 'width' => 2, 'note' => 'ok' ), $field['pen'], 'Kept, but cleaned.' );
		$this->assertSame( 'sig', $twice['fields'][0]['conditions']['rules'][0]['field'], 'A rule depending on the extension field is kept.' );
		$this->assertSame( array( 'payments' => array( 'enabled' => true, 'amount' => '19.50', 'onclick' => 'x' ) ), $twice['settings']['extensions'] );
		$this->assertSame( $once, $twice, 'Saving again changes nothing.' );
		$this->assertStringNotContainsString( 'signature', Renderer::render( array( 'id' => 1, 'title' => 'T', 'status' => 'published', 'schema' => $twice ) ), 'Visitors are not shown a field nothing can handle.' );
	}

	public function test_duplicated_fields_never_share_an_id_or_a_key() {
		$field  = array(
			'id'    => 'f_same',
			'key'   => 'email',
			'type'  => 'email',
			'label' => 'Email',
		);
		$schema = Schema::sanitize( array( 'fields' => array( $field, $field, $field ) ) );

		$this->assertCount( 3, array_unique( array_column( $schema['fields'], 'id' ) ) );
		$this->assertSame( array( 'email', 'email_2', 'email_3' ), array_column( $schema['fields'], 'key' ) );
	}

	public function test_html_field_loses_scripts_and_options_are_normalised() {
		$schema = Schema::sanitize(
			array(
				'fields' => array(
					array(
						'type'    => 'html',
						'content' => '<p>Hello</p><script>alert(1)</script>',
					),
					array(
						'type'    => 'select',
						'label'   => 'Plan',
						'options' => array( 'Basic', array( 'label' => 'Pro', 'value' => 'pro' ), array( 'label' => '', 'value' => '' ) ),
					),
				),
			)
		);

		$this->assertSame( '<p>Hello</p>', $schema['fields'][0]['content'] );
		$this->assertSame(
			array(
				array( 'label' => 'Basic', 'value' => 'Basic' ),
				array( 'label' => 'Pro', 'value' => 'pro' ),
			),
			$schema['fields'][1]['options']
		);
	}

	public function test_file_field_can_only_allow_safe_types() {
		$schema = Schema::sanitize(
			array(
				'fields' => array(
					array(
						'type'          => 'file',
						'label'         => 'CV',
						'allowed_types' => array( 'pdf', 'php', 'exe', 'svg', 'html', 'DOCX' ),
						'max_size_mb'   => 9999,
					),
				),
			)
		);

		$this->assertSame( array( 'pdf', 'docx' ), $schema['fields'][0]['allowed_types'] );
		$this->assertSame( 100, $schema['fields'][0]['max_size_mb'] );
	}

	public function test_conditions_referring_to_missing_fields_or_themselves_are_dropped() {
		$schema = Schema::sanitize(
			array(
				'fields' => array(
					array( 'type' => 'radio', 'label' => 'Type', 'key' => 'type', 'options' => array( 'Person', 'Business' ) ),
					array(
						'type'       => 'text',
						'label'      => 'Company',
						'key'        => 'company',
						'conditions' => array(
							'enabled' => true,
							'action'  => 'show',
							'rules'   => array(
								array( 'field' => 'type', 'operator' => 'is', 'value' => 'Business' ),
								array( 'field' => 'gone', 'operator' => 'is', 'value' => 'x' ),
								array( 'field' => 'company', 'operator' => 'not_empty' ),
								array( 'field' => 'type', 'operator' => 'bogus', 'value' => 'y' ),
							),
						),
					),
				),
			)
		);

		$rules = $schema['fields'][1]['conditions']['rules'];

		$this->assertCount( 2, $rules );
		$this->assertSame( 'is', $rules[1]['operator'], 'An unknown operator falls back to "is".' );
	}

	public function test_settings_are_validated() {
		$settings = Schema::sanitize(
			array(
				'settings' => array(
					'submit_label' => '',
					'confirmation' => array( 'type' => 'redirect', 'redirect_url' => 'javascript:alert(1)' ),
					'style'        => array( 'accent_color' => 'red; background:url(x)', 'label_position' => 'sideways', 'css_class' => 'a b<c' ),
					'webhooks'     => array(
						array( 'url' => 'http://insecure.example.com/hook', 'enabled' => true ),
						array( 'url' => 'https://hooks.example.com/in', 'secret' => "abc\r\nX-Evil: 1", 'enabled' => true ),
					),
					'injected'     => 'value',
				),
			)
		)['settings'];

		$this->assertSame( 'Submit', $settings['submit_label'] );
		$this->assertSame( '', $settings['confirmation']['redirect_url'] );
		$this->assertSame( '', $settings['style']['accent_color'] );
		$this->assertSame( 'top', $settings['style']['label_position'] );
		$this->assertSame( 'a bc', $settings['style']['css_class'] );
		$this->assertSame( '', $settings['webhooks'][0]['url'], 'Only https webhook URLs are kept.' );
		$this->assertSame( 'https://hooks.example.com/in', $settings['webhooks'][1]['url'] );
		$this->assertStringNotContainsString( "\n", $settings['webhooks'][1]['secret'] );
		$this->assertArrayNotHasKey( 'injected', $settings );
	}

	public function test_upgrade_fills_in_settings_added_after_a_form_was_saved() {
		$upgraded = Schema::upgrade( array( 'version' => 0, 'fields' => array(), 'settings' => array( 'submit_label' => 'Go', 'style' => array( 'spacing' => 'compact' ) ) ) );

		$this->assertSame( 'Go', $upgraded['settings']['submit_label'] );
		$this->assertSame( 'compact', $upgraded['settings']['style']['spacing'] );
		$this->assertSame( 'top', $upgraded['settings']['style']['label_position'] );
		$this->assertArrayHasKey( 'spam', $upgraded['settings'] );
	}

	public function test_problems_block_publishing_an_unusable_form() {
		$empty = Schema::problems( Schema::sanitize( array() ) );
		$bad   = Schema::problems(
			Schema::sanitize(
				array(
					'fields' => array(
						array( 'type' => 'select', 'label' => 'Pick' ),
						array( 'type' => 'calculation', 'label' => 'Total', 'formula' => '2 * (3' ),
						array( 'type' => 'page_break' ),
					),
				)
			)
		);

		$this->assertCount( 1, $empty );
		$this->assertCount( 3, $bad );
	}

	public function test_enabled_webhooks_and_notifications_must_have_a_destination() {
		$schema = Schema::sanitize(
			array(
				'fields'   => array( array( 'type' => 'text', 'label' => 'Name' ) ),
				'settings' => array(
					'notifications' => array(
						array( 'name' => 'Nobody', 'enabled' => true, 'channel' => 'email', 'to' => '' ),
						array( 'name' => 'Off', 'enabled' => false, 'channel' => 'email', 'to' => '' ),
					),
					'webhooks'      => array(
						array( 'name' => 'Insecure', 'enabled' => true, 'url' => 'http://example.com/in' ),
						array( 'name' => 'Fine', 'enabled' => true, 'url' => 'https://example.com/in' ),
					),
				),
			)
		);

		$problems = Schema::problems( $schema );

		$this->assertCount( 2, $problems, 'One for the notification with no recipient, one for the webhook whose http:// address was dropped.' );
		$this->assertStringContainsString( 'Insecure', implode( ' ', $problems ) );
		$this->assertStringContainsString( 'Nobody', implode( ' ', $problems ) );
	}

	public function test_conditions_show_hide_and_require() {
		$show = array(
			'required'   => true,
			'conditions' => array(
				'enabled' => true,
				'action'  => 'show',
				'match'   => 'all',
				'rules'   => array( array( 'field' => 'type', 'operator' => 'is', 'value' => 'Business' ) ),
			),
		);
		$hide                         = $show;
		$hide['conditions']['action'] = 'hide';
		$need                         = $show;
		$need['required']             = false;
		$need['conditions']['action'] = 'require';

		$this->assertTrue( Conditions::is_visible( $show, array( 'type' => 'business' ) ), 'Matching is case-insensitive.' );
		$this->assertFalse( Conditions::is_visible( $show, array( 'type' => 'Person' ) ) );
		$this->assertFalse( Conditions::is_visible( $hide, array( 'type' => 'Business' ) ) );
		$this->assertTrue( Conditions::is_visible( $need, array( 'type' => 'Person' ) ), 'A "require" rule never hides the field.' );
		$this->assertTrue( Conditions::is_required( $need, array( 'type' => 'Business' ) ) );
		$this->assertFalse( Conditions::is_required( $need, array( 'type' => 'Person' ) ) );
	}

	public function test_condition_operators_and_any_matching() {
		$conditions = array(
			'match' => 'any',
			'rules' => array(
				array( 'field' => 'interests', 'operator' => 'is', 'value' => 'Design' ),
				array( 'field' => 'budget', 'operator' => 'gt', 'value' => '1000' ),
			),
		);

		$this->assertTrue( Conditions::matches( $conditions, array( 'interests' => array( 'Code', 'Design' ), 'budget' => '5' ) ) );
		$this->assertTrue( Conditions::matches( $conditions, array( 'interests' => array(), 'budget' => '1500' ) ) );
		$this->assertFalse( Conditions::matches( $conditions, array( 'interests' => array( 'Code' ), 'budget' => 'lots' ) ) );

		$all = array( 'match' => 'all', 'rules' => array( array( 'field' => 'a', 'operator' => 'not_empty' ), array( 'field' => 'b', 'operator' => 'contains', 'value' => 'urgent' ) ) );

		$this->assertTrue( Conditions::matches( $all, array( 'a' => 'x', 'b' => 'This is URGENT' ) ) );
		$this->assertFalse( Conditions::matches( $all, array( 'a' => '', 'b' => 'urgent' ) ) );
	}

	public function test_calculator_evaluates_formulas_without_executing_them() {
		$values = array( 'qty' => '3', 'price' => '12.50', 'extras' => array( '5', '2.5' ) );

		$this->assertSame( 37.5, Calculator::evaluate( '{qty} * {price}', $values ) );
		$this->assertSame( 45.0, Calculator::evaluate( '{qty} * {price} + {extras}', $values ) );
		$this->assertSame( 14.0, Calculator::evaluate( '2 * (3 + 4)', array() ) );
		$this->assertSame( -6.0, Calculator::evaluate( '2 * -3', array() ) );
		$this->assertSame( -0.5, Calculator::evaluate( '2 / -4', array() ) );
		$this->assertSame( -3.0, Calculator::evaluate( '-(1 + 2)', array() ) );
		$this->assertSame( 0.0, Calculator::evaluate( '5 / {missing}', $values ), 'Dividing by zero gives 0.' );
		$this->assertNull( Calculator::evaluate( '2 * (3', array() ) );
		$this->assertNull( Calculator::evaluate( 'system("ls")', array() ) );
		$this->assertNull( Calculator::evaluate( '2 +', array() ) );
		$this->assertNull( Calculator::evaluate( '', array() ) );
	}

	public function test_every_template_is_a_publishable_form() {
		\Brain\Monkey\Functions\when( 'get_option' )->justReturn( 'admin@example.com' );

		$templates = Templates::all();

		$this->assertCount( 10, $templates );

		foreach ( $templates as $id => $template ) {
			$this->assertSame( array(), Schema::problems( $template['schema'] ), "Template {$id} has problems." );
			$this->assertTrue( $template['schema']['settings']['notifications'][0]['enabled'] );
		}

		$lead = $templates['lead']['schema']['fields'];
		$this->assertSame( 'enquiring_as', $lead[4]['conditions']['rules'][0]['field'], 'The lead template ships with working conditional logic.' );
		$this->assertContains( 'page_break', array_column( $templates['survey']['schema']['fields'], 'type' ) );
	}

	public function test_renderer_outputs_accessible_markup_and_splits_pages() {
		$form = array(
			'id'     => 7,
			'title'  => 'Test',
			'status' => 'published',
			'schema' => Schema::sanitize(
				array(
					'fields' => array(
						array( 'type' => 'email', 'label' => 'Email "address"', 'required' => true, 'description' => 'We reply here.' ),
						array( 'type' => 'radio', 'label' => 'Plan', 'options' => array( 'A', 'B' ) ),
						array( 'type' => 'page_break' ),
						array( 'type' => 'html', 'content' => '<p>Almost done</p>' ),
						array( 'type' => 'file', 'label' => 'File', 'allowed_types' => array( 'pdf' ) ),
					),
				)
			),
		);

		$html = Renderer::render( $form );

		$this->assertSame( 2, substr_count( $html, 'class="vuloform-page"' ) );
		$this->assertStringContainsString( 'enctype="multipart/form-data"', $html );
		$this->assertStringContainsString( 'Email &quot;address&quot;', $html, 'Labels are escaped.' );
		$this->assertStringContainsString( 'aria-required="true"', $html );
		$this->assertMatchesRegularExpression( '/<label class="vuloform-label" for="(vuloform-7-\d+-f_[a-z0-9]+)">/', $html );
		$this->assertStringContainsString( '<fieldset class="vuloform-fieldset"', $html );
		$this->assertStringContainsString( '<legend class="vuloform-label">Plan</legend>', $html );
		$this->assertStringContainsString( 'accept=".pdf"', $html );
		$this->assertStringContainsString( 'name="vf_website"', $html, 'The honeypot is present.' );
		$this->assertStringContainsString( 'vuloform-progress', $html );
		$this->assertStringNotContainsString( 'notifications', $html, 'Private settings never reach the page.' );
	}

	public function test_a_draft_form_is_not_rendered_for_visitors() {
		$form = array( 'id' => 1, 'title' => 'Draft', 'status' => 'draft', 'schema' => Schema::sanitize( array() ) );

		$this->assertSame( '', Renderer::render( $form ) );
		$this->assertStringContainsString( '<form', Renderer::render( $form, array( 'preview' => true ) ) );
	}

	public function test_dynamic_defaults_are_filled_from_the_address_the_visitor_and_the_page() {
		Functions\when( 'wp_unslash' )->returnArg();
		Functions\when( 'is_user_logged_in' )->justReturn( true );
		Functions\when( 'wp_get_current_user' )->justReturn(
			(object) array( 'user_email' => 'jane@example.com', 'display_name' => 'Jane Doe', 'first_name' => 'Jane', 'last_name' => 'Doe', 'user_login' => 'jane', 'ID' => 7 )
		);
		Functions\when( 'get_queried_object_id' )->justReturn( 42 );
		Functions\when( 'get_the_title' )->justReturn( 'Pricing' );
		Functions\when( 'get_permalink' )->justReturn( 'https://shop.example.com/pricing/' );
		Functions\when( 'wp_date' )->justReturn( '2026-10-10' );

		$_GET = array( 'utm_source' => ' newsletter<script> ', 'list' => array( 'not', 'scalar' ) );

		$this->assertSame( 'newsletter', \VuloForm\Forms\DynamicValues::resolve( '{query:utm_source}' ), 'Markup in a URL value is stripped.' );
		$this->assertSame( '', \VuloForm\Forms\DynamicValues::resolve( '{query:list}{query:missing}' ) );
		$this->assertSame( 'Jane Doe <jane@example.com>', \VuloForm\Forms\DynamicValues::resolve( '{user:name} <{user:email}>' ) );
		$this->assertSame( 'Pricing (42) on 2026-10-10', \VuloForm\Forms\DynamicValues::resolve( '{page:title} ({page:id}) on {date}' ) );
		$this->assertSame( 'https://shop.example.com/pricing/', \VuloForm\Forms\DynamicValues::resolve( '{page:url}' ) );
		$this->assertSame( 'Plain text and {unknown:tag} stay.', \VuloForm\Forms\DynamicValues::resolve( 'Plain text and {unknown:tag} stay.' ) );

		// What the browser is left to fill in: only the tags it answers better than the server.
		$this->assertSame( 'jane@example.com via {query:utm_source}', \VuloForm\Forms\DynamicValues::browser_template( '{user:email} via {query:utm_source}' ) );
		$this->assertSame( '', \VuloForm\Forms\DynamicValues::browser_template( '{user:email}' ) );

		$_GET = array();
	}

	public function test_dynamic_user_values_are_empty_for_a_visitor_who_is_not_logged_in() {
		Functions\when( 'is_user_logged_in' )->justReturn( false );

		$this->assertSame( 'Hello ', \VuloForm\Forms\DynamicValues::resolve( 'Hello {user:first_name}' ) );
	}
}
