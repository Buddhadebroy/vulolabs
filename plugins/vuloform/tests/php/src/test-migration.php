<?php
/**
 * WPForms migration tests.
 *
 * @package VuloForm
 */

namespace VuloForm\Tests;

use Brain\Monkey\Functions;
use VuloForm\Forms\FormRepository;
use VuloForm\Forms\Schema;
use VuloForm\Migration\GravityFormsMigrator;
use VuloForm\Migration\MigrationManager;
use VuloForm\Migration\WpFormsMigrator;

/**
 * Keeps created/updated forms in memory, so a migration can be inspected without a real database.
 */
class FakeForms extends FormRepository {

	public $rows = array();

	public function create( $title, $schema = array(), $status = 'draft' ) {
		$id                = count( $this->rows ) + 1;
		$this->rows[ $id ] = array(
			'id'     => $id,
			'title'  => $title,
			'status' => $status,
			'schema' => Schema::sanitize( $schema ),
		);

		return $id;
	}

	public function update( $id, array $changes ) {
		if ( ! isset( $this->rows[ $id ] ) ) {
			return false;
		}

		if ( array_key_exists( 'title', $changes ) ) {
			$this->rows[ $id ]['title'] = $changes['title'];
		}

		if ( array_key_exists( 'status', $changes ) ) {
			$this->rows[ $id ]['status'] = $changes['status'];
		}

		if ( array_key_exists( 'schema', $changes ) ) {
			$this->rows[ $id ]['schema'] = Schema::sanitize( $changes['schema'] );
		}

		return true;
	}
}

class TestMigration extends TestCase {

	/**
	 * @var FakeForms
	 */
	private $forms;

	protected function setUp(): void {
		parent::setUp();

		$this->forms                            = new FakeForms();
		VuloForm()->forms                       = $this->forms;
		$GLOBALS['vuloform_test_wpforms_posts'] = array();
		\GFAPI::$forms                          = array();

		Functions\when( 'post_type_exists' )->alias(
			static function ( $post_type ) {
				return 'wpforms' === $post_type;
			}
		);
		Functions\when( 'get_posts' )->alias(
			static function () {
				return array_values( $GLOBALS['vuloform_test_wpforms_posts'] );
			}
		);
		Functions\when( 'get_post' )->alias(
			static function ( $id ) {
				return $GLOBALS['vuloform_test_wpforms_posts'][ $id ] ?? null;
			}
		);
		Functions\when( 'wp_update_post' )->justReturn( 0 );
		Functions\when( 'get_shortcode_regex' )->justReturn( '(?!)' ); // Matches nothing - no post content to scan in these tests.

		global $wpdb;
		$wpdb = new class() { // phpcs:ignore WordPress.NamingConventions.ValidVariableName.UsedPropertyNotSnakeCase, Universal.Files.SeparateFunctionsFromOO.Mixed
			public $posts = 'wp_posts';

			public function get_col( $query ) { // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
				return array();
			}
			public function prepare( $query, ...$args ) { // phpcs:ignore WordPress.DB.PreparedSQL.NotPrepared
				return $query;
			}
			public function esc_like( $text ) {
				return $text;
			}
		};
	}

	/**
	 * @param int    $id     WPForms post id.
	 * @param array  $fields Raw WPForms field definitions.
	 * @param array  $settings Raw WPForms settings.
	 * @param string $status  WPForms post status.
	 * @return void
	 */
	private function add_wpforms_post( int $id, array $fields, array $settings = array(), string $status = 'publish' ): void {
		$GLOBALS['vuloform_test_wpforms_posts'][ $id ] = (object) array(
			'ID'           => $id,
			'post_title'   => 'My WPForms form',
			'post_status'  => $status,
			'post_content' => wp_json_encode(
				array(
					'fields'   => $fields,
					'settings' => $settings,
				)
			),
		);
	}

	public function test_known_field_types_migrate_with_correct_shape() {
		$this->add_wpforms_post(
			1,
			array(
				array(
					'id'          => 1,
					'type'        => 'text',
					'label'       => 'Your name',
					'required'    => true,
					'placeholder' => 'Jane Doe',
				),
				array(
					'id'      => 2,
					'type'    => 'select',
					'label'   => 'Favorite color',
					'choices' => array(
						array( 'label' => 'Red' ),
						array( 'label' => 'Blue' ),
					),
				),
				array(
					'id'       => 3,
					'type'     => 'email',
					'label'    => 'Email',
					'required' => true,
				),
			)
		);

		$result = ( new WpFormsMigrator() )->migrate();

		$this->assertSame( 1, $result['migrated'] );
		$this->assertSame( 0, $result['skipped'] );
		$this->assertSame( array(), $result['errors'] );

		$schema = $this->forms->rows[1]['schema'];
		$this->assertCount( 3, $schema['fields'] );

		$this->assertSame( 'text', $schema['fields'][0]['type'] );
		$this->assertSame( 'Your name', $schema['fields'][0]['label'] );
		$this->assertTrue( $schema['fields'][0]['required'] );
		$this->assertSame( 'Jane Doe', $schema['fields'][0]['placeholder'] );
		$this->assertSame( 'your_name', $schema['fields'][0]['key'], 'Schema::sanitize() derives a real key even though the migrator never sets one.' );

		$this->assertSame( 'select', $schema['fields'][1]['type'] );
		$this->assertSame(
			array(
				array(
					'label' => 'Red',
					'value' => 'Red',
				),
				array(
					'label' => 'Blue',
					'value' => 'Blue',
				),
			),
			$schema['fields'][1]['options']
		);

		$this->assertSame( 'email', $schema['fields'][2]['type'] );
	}

	public function test_unsupported_field_type_is_reported_not_silently_dropped() {
		$this->add_wpforms_post(
			1,
			array(
				array(
					'id'    => 1,
					'type'  => 'text',
					'label' => 'Name',
				),
				array(
					'id'    => 2,
					'type'  => 'richtext',
					'label' => 'Bio',
				),
			)
		);

		$result = ( new WpFormsMigrator() )->migrate();

		$this->assertSame( 1, $result['migrated'] );
		$this->assertCount( 1, $this->forms->rows[1]['schema']['fields'], 'The unsupported field is skipped, not guessed at.' );
		$this->assertCount( 1, $result['errors'] );
		$this->assertStringContainsString( 'richtext', $result['errors'][0] );
	}

	public function test_number_slider_migrates_to_a_plain_number_field_with_a_note() {
		$this->add_wpforms_post(
			1,
			array(
				array(
					'id'    => 1,
					'type'  => 'number-slider',
					'label' => 'Budget',
					'min'   => 10,
					'max'   => 100,
					'step'  => 5,
				),
			)
		);

		$result = ( new WpFormsMigrator() )->migrate();
		$field  = $this->forms->rows[1]['schema']['fields'][0];

		$this->assertSame( 'number', $field['type'] );
		$this->assertSame( '10', $field['min'] );
		$this->assertSame( '100', $field['max'] );
		$this->assertCount( 1, $result['errors'], 'Dropping the slider control itself is a real compatibility note, not a silent change.' );
	}

	public function test_simple_name_format_keeps_only_the_first_name_part() {
		$this->add_wpforms_post(
			1,
			array(
				array(
					'id'     => 1,
					'type'   => 'name',
					'label'  => 'Name',
					'format' => 'simple',
				),
			)
		);

		( new WpFormsMigrator() )->migrate();

		$this->assertSame( array( 'first' ), $this->forms->rows[1]['schema']['fields'][0]['parts'] );
	}

	public function test_migrating_twice_without_overwrite_skips_the_second_time() {
		$this->add_wpforms_post(
            1,
            array(
				array(
					'id'    => 1,
					'type'  => 'text',
					'label' => 'Name',
				),
            )
        );

		$first  = ( new WpFormsMigrator() )->migrate();
		$second = ( new WpFormsMigrator() )->migrate();

		$this->assertSame( 1, $first['migrated'] );
		$this->assertSame( 0, $second['migrated'] );
		$this->assertSame( 1, $second['skipped'], 'Re-running without overwrite leaves the already-migrated form alone.' );
		$this->assertCount( 1, $this->forms->rows, 'No duplicate form was created.' );
	}

	public function test_overwrite_updates_the_same_form_instead_of_duplicating_it() {
		$this->add_wpforms_post(
            1,
            array(
				array(
					'id'    => 1,
					'type'  => 'text',
					'label' => 'Name',
				),
            )
        );
		( new WpFormsMigrator() )->migrate();

		$this->add_wpforms_post(
            1,
            array(
				array(
					'id'    => 1,
					'type'  => 'text',
					'label' => 'Full name',
				),
            )
        );
		$result = ( new WpFormsMigrator() )->migrate( array(), true );

		$this->assertSame( 1, $result['migrated'] );
		$this->assertCount( 1, $this->forms->rows );
		$this->assertSame( 'Full name', $this->forms->rows[1]['schema']['fields'][0]['label'] );
	}

	public function test_sources_count_excludes_already_migrated_forms() {
		$this->add_wpforms_post(
            1,
            array(
				array(
					'id'    => 1,
					'type'  => 'text',
					'label' => 'Name',
				),
            )
        );
		$this->add_wpforms_post(
            2,
            array(
				array(
					'id'    => 1,
					'type'  => 'text',
					'label' => 'Email',
				),
            )
        );

		$manager = new MigrationManager();

		$before = $manager->list_sources();
		$this->assertSame( 2, $before[0]['count'], 'Both forms are new.' );

		( new WpFormsMigrator() )->migrate( array( 1 ) );

		$after = $manager->list_sources();
		$this->assertSame( 1, $after[0]['count'], 'The migrated form no longer counts toward "forms found".' );
	}

	public function test_gravity_forms_known_field_types_migrate_with_correct_shape() {
		\GFAPI::$forms = array(
			1 => array(
				'id'        => 1,
				'title'     => 'Contact',
				'is_active' => true,
				'fields'    => array(
					array( 'id' => 1, 'type' => 'text', 'label' => 'Your name', 'isRequired' => true, 'placeholder' => 'Jane Doe' ),
					array(
						'id'      => 2,
						'type'    => 'select',
						'label'   => 'Favorite color',
						'choices' => array(
							array( 'text' => 'Red', 'value' => 'red' ),
							array( 'text' => 'Blue', 'value' => 'blue' ),
						),
					),
					array( 'id' => 3, 'type' => 'email', 'label' => 'Email', 'isRequired' => true ),
				),
			),
		);

		$result = ( new GravityFormsMigrator() )->migrate();

		$this->assertSame( 1, $result['migrated'] );
		$this->assertSame( 0, $result['skipped'] );
		$this->assertSame( array(), $result['errors'] );

		$schema = $this->forms->rows[1]['schema'];
		$this->assertCount( 3, $schema['fields'] );

		$this->assertSame( 'text', $schema['fields'][0]['type'] );
		$this->assertTrue( $schema['fields'][0]['required'] );
		$this->assertSame( 'Jane Doe', $schema['fields'][0]['placeholder'] );

		$this->assertSame( 'select', $schema['fields'][1]['type'] );
		$this->assertSame(
			array(
				array( 'label' => 'Red', 'value' => 'red' ),
				array( 'label' => 'Blue', 'value' => 'blue' ),
			),
			$schema['fields'][1]['options']
		);

		$this->assertSame( 'email', $schema['fields'][2]['type'] );
	}

	public function test_gravity_forms_unsupported_field_type_is_reported_not_silently_dropped() {
		\GFAPI::$forms = array(
			1 => array(
				'id'        => 1,
				'title'     => 'Order',
				'is_active' => true,
				'fields'    => array(
					array( 'id' => 1, 'type' => 'text', 'label' => 'Name' ),
					// Post Fields and Pricing Fields have no VuloForm equivalent at all.
					array( 'id' => 2, 'type' => 'post_title', 'label' => 'Title' ),
					array( 'id' => 3, 'type' => 'product', 'label' => 'Item' ),
				),
			),
		);

		$result = ( new GravityFormsMigrator() )->migrate();

		$this->assertSame( 1, $result['migrated'] );
		$this->assertCount( 1, $this->forms->rows[1]['schema']['fields'] );
		$this->assertCount( 2, $result['errors'] );
	}

	public function test_gravity_forms_name_and_address_parts_follow_the_real_sub_input_numbering() {
		\GFAPI::$forms = array(
			1 => array(
				'id'        => 1,
				'title'     => 'Shipping',
				'is_active' => true,
				'fields'    => array(
					array(
						'id'     => 1,
						'type'   => 'name',
						'label'  => 'Name',
						'inputs' => array(
							array( 'id' => '1.2', 'label' => 'Prefix', 'isHidden' => true ),
							array( 'id' => '1.3', 'label' => 'First' ),
							array( 'id' => '1.6', 'label' => 'Last' ),
						),
					),
					array(
						'id'     => 2,
						'type'   => 'address',
						'label'  => 'Address',
						'inputs' => array(
							array( 'id' => '2.1', 'label' => 'Street' ),
							array( 'id' => '2.3', 'label' => 'City' ),
							array( 'id' => '2.6', 'label' => 'Country' ),
						),
					),
				),
			),
		);

		( new GravityFormsMigrator() )->migrate();

		$fields = $this->forms->rows[1]['schema']['fields'];

		$this->assertSame( array( 'first', 'last' ), $fields[0]['parts'], 'The hidden prefix sub-input is dropped.' );
		$this->assertSame( array( 'line1', 'city', 'country' ), $fields[1]['parts'] );
	}

	public function test_gravity_forms_notifications_are_reported_not_guessed_at() {
		\GFAPI::$forms = array(
			1 => array(
				'id'            => 1,
				'title'         => 'Lead',
				'is_active'     => true,
				'fields'        => array( array( 'id' => 1, 'type' => 'email', 'label' => 'Email' ) ),
				'notifications' => array(
					'abc123' => array( 'name' => 'Admin Notification', 'to' => '{admin_email}', 'subject' => 'New lead' ),
				),
			),
		);

		$result = ( new GravityFormsMigrator() )->migrate();

		$this->assertSame( 1, $result['migrated'] );
		$this->assertCount( 1, $result['errors'] );
		$this->assertStringContainsString( 'Lead', $result['errors'][0] );
		$this->assertSame( array(), $this->forms->rows[1]['schema']['settings']['notifications'], 'Reported as a compatibility note, not guessed at.' );
	}

	public function test_gravity_forms_is_registered_as_a_migration_source() {
		$manager = new MigrationManager();
		$gravity = null;

		foreach ( $manager->list_sources() as $source ) {
			if ( 'gravityforms' === $source['id'] ) {
				$gravity = $source;
			}
		}

		$this->assertNotNull( $gravity );
		$this->assertSame( 0, $gravity['count'], 'No forms were set up for this test.' );
	}
}
