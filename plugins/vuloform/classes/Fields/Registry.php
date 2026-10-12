<?php
/**
 * Field Registry class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Fields;

defined( 'ABSPATH' ) || exit;

/**
 * The field types a form can contain, and what each one supports.
 *
 * This is the single list the builder palette, the schema validator, the renderer and the
 * submission processor all read, so a type can't exist in one of them and not the others.
 */
class Registry {

	/**
	 * Every field type.
	 *
	 * Keys per type:
	 * - label, icon, group (basic|layout|advanced)
	 * - input: whether it collects a value (false for headings, dividers, page breaks...)
	 * - supports: which generic settings apply (placeholder, required, default, options, range,
	 *   length, description)
	 *
	 * @return array<string, array>
	 */
	public static function types() {
		$types = array(
			'text'        => array(
				'label'    => __( 'Short text', 'vuloform' ),
				'icon'     => 'form-textbox',
				'group'    => 'basic',
				'input'    => true,
				'supports' => array( 'placeholder', 'required', 'default', 'length', 'description' ),
			),
			'textarea'    => array(
				'label'    => __( 'Long text', 'vuloform' ),
				'icon'     => 'form-textarea',
				'group'    => 'basic',
				'input'    => true,
				'supports' => array( 'placeholder', 'required', 'default', 'length', 'description' ),
			),
			'email'       => array(
				'label'    => __( 'Email', 'vuloform' ),
				'icon'     => 'form-email',
				'group'    => 'basic',
				'input'    => true,
				'supports' => array( 'placeholder', 'required', 'default', 'description' ),
			),
			'phone'       => array(
				'label'    => __( 'Phone', 'vuloform' ),
				'icon'     => 'form-phone',
				'group'    => 'basic',
				'input'    => true,
				'supports' => array( 'placeholder', 'required', 'default', 'description' ),
			),
			'number'      => array(
				'label'    => __( 'Number', 'vuloform' ),
				'icon'     => 'arrow-down-up',
				'group'    => 'basic',
				'input'    => true,
				'supports' => array( 'placeholder', 'required', 'default', 'range', 'description' ),
			),
			'url'         => array(
				'label'    => __( 'Website', 'vuloform' ),
				'icon'     => 'form-url',
				'group'    => 'basic',
				'input'    => true,
				'supports' => array( 'placeholder', 'required', 'default', 'description' ),
			),
			'select'      => array(
				'label'    => __( 'Dropdown', 'vuloform' ),
				'icon'     => 'form-dropdown',
				'group'    => 'basic',
				'input'    => true,
				'supports' => array( 'placeholder', 'required', 'default', 'options', 'description' ),
			),
			'radio'       => array(
				'label'    => __( 'Single choice', 'vuloform' ),
				'icon'     => 'form-radio',
				'group'    => 'basic',
				'input'    => true,
				'supports' => array( 'required', 'default', 'options', 'description' ),
			),
			'checkboxes'  => array(
				'label'    => __( 'Multiple choice', 'vuloform' ),
				'icon'     => 'form-checkboxes',
				'group'    => 'basic',
				'input'    => true,
				'supports' => array( 'required', 'options', 'description' ),
			),
			'consent'     => array(
				'label'    => __( 'Consent', 'vuloform' ),
				'icon'     => 'check',
				'group'    => 'basic',
				'input'    => true,
				'supports' => array( 'required', 'description' ),
			),
			'date'        => array(
				'label'    => __( 'Date', 'vuloform' ),
				'icon'     => 'calendar',
				'group'    => 'basic',
				'input'    => true,
				'supports' => array( 'required', 'default', 'description' ),
			),
			'time'        => array(
				'label'    => __( 'Time', 'vuloform' ),
				'icon'     => 'clock',
				'group'    => 'basic',
				'input'    => true,
				'supports' => array( 'required', 'default', 'description' ),
			),
			'file'        => array(
				'label'    => __( 'File upload', 'vuloform' ),
				'icon'     => 'form-attachment',
				'group'    => 'basic',
				'input'    => true,
				'supports' => array( 'required', 'description' ),
			),
			'heading'     => array(
				'label'    => __( 'Heading', 'vuloform' ),
				'icon'     => 'title',
				'group'    => 'layout',
				'input'    => false,
				'supports' => array( 'description' ),
			),
			'html'        => array(
				'label'    => __( 'Text block', 'vuloform' ),
				'icon'     => 'document',
				'group'    => 'layout',
				'input'    => false,
				'supports' => array(),
			),
			'divider'     => array(
				'label'    => __( 'Divider', 'vuloform' ),
				'icon'     => 'divider',
				'group'    => 'layout',
				'input'    => false,
				'supports' => array(),
			),
			'page_break'  => array(
				'label'    => __( 'Page break', 'vuloform' ),
				'icon'     => 'pagination-next-arrow',
				'group'    => 'layout',
				'input'    => false,
				'supports' => array(),
			),
			'name'        => array(
				'label'    => __( 'Name', 'vuloform' ),
				'icon'     => 'profile',
				'group'    => 'advanced',
				'input'    => true,
				'supports' => array( 'required', 'description' ),
			),
			'address'     => array(
				'label'    => __( 'Address', 'vuloform' ),
				'icon'     => 'form-address',
				'group'    => 'advanced',
				'input'    => true,
				'supports' => array( 'required', 'description' ),
			),
			'hidden'      => array(
				'label'    => __( 'Hidden value', 'vuloform' ),
				'icon'     => 'eye-blocked',
				'group'    => 'advanced',
				'input'    => true,
				'supports' => array( 'default' ),
			),
			'calculation' => array(
				'label'    => __( 'Calculation', 'vuloform' ),
				'icon'     => 'commission',
				'group'    => 'advanced',
				'input'    => true,
				'supports' => array( 'description' ),
			),
		);

		/**
		 * Filters the field types. An added type also needs to be rendered and validated: see the
		 * `vuloform_render_field` and `vuloform_validate_field` filters.
		 *
		 * @param array $types Field type id => definition.
		 */
		return (array) apply_filters( 'vuloform_field_types', $types );
	}

	/**
	 * Parts of the compound fields, in display order.
	 *
	 * @var array<string, string[]>
	 */
	const PARTS = array(
		'name'    => array( 'first', 'last' ),
		'address' => array( 'line1', 'line2', 'city', 'state', 'zip', 'country' ),
	);

	/**
	 * @param string $type Field type id.
	 * @return array|null
	 */
	public static function get( $type ) {
		$types = self::types();

		return isset( $types[ $type ] ) ? $types[ $type ] : null;
	}

	/**
	 * @param string $type    Field type id.
	 * @param string $feature Feature name.
	 * @return bool
	 */
	public static function supports( $type, $feature ) {
		$definition = self::get( $type );

		return $definition && in_array( $feature, $definition['supports'], true );
	}

	/**
	 * @param string $type Field type id.
	 * @return bool Whether the type collects a value.
	 */
	public static function is_input( $type ) {
		$definition = self::get( $type );

		return $definition && ! empty( $definition['input'] );
	}

	/**
	 * Labels for the parts of a compound field.
	 *
	 * @param string $type `name` or `address`.
	 * @return array<string, string> Part id => label.
	 */
	public static function part_labels( $type ) {
		if ( 'name' === $type ) {
			return array(
				'first' => __( 'First name', 'vuloform' ),
				'last'  => __( 'Last name', 'vuloform' ),
			);
		}

		return array(
			'line1'   => __( 'Address line 1', 'vuloform' ),
			'line2'   => __( 'Address line 2', 'vuloform' ),
			'city'    => __( 'City', 'vuloform' ),
			'state'   => __( 'State / Region', 'vuloform' ),
			'zip'     => __( 'ZIP / Postal code', 'vuloform' ),
			'country' => __( 'Country', 'vuloform' ),
		);
	}
}
