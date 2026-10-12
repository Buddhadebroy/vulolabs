<?php
/**
 * Templates class file.
 *
 * @package VuloForm
 */

namespace VuloForm\Forms;

defined( 'ABSPATH' ) || exit;

/**
 * Starter forms. Each one is an ordinary schema: creating a form from a template copies it, and the
 * result is edited like any other form.
 */
class Templates {

	/**
	 * @return array<string, array{title: string, desc: string, icon: string, schema: array}>
	 */
	public static function all() {
		$name    = self::field( 'name', __( 'Name', 'vuloform' ), array( 'required' => true ) );
		$email   = self::field( 'email', __( 'Email', 'vuloform' ), array( 'required' => true ) );
		$phone   = self::field( 'phone', __( 'Phone', 'vuloform' ) );
		$message = self::field( 'textarea', __( 'Message', 'vuloform' ), array( 'required' => true ) );
		$consent = self::field(
			'consent',
			__( 'Consent', 'vuloform' ),
			array(
				'required'     => true,
				'consent_text' => __( 'I agree to my details being stored so you can reply to me.', 'vuloform' ),
			)
		);

		$templates = array(
			'contact'    => array(
				'title'  => __( 'Contact form', 'vuloform' ),
				'desc'   => __( 'Name, email and a message.', 'vuloform' ),
				'icon'   => 'mail',
				'fields' => array( $name, $email, self::field( 'text', __( 'Subject', 'vuloform' ) ), $message ),
			),
			'inquiry'    => array(
				'title'  => __( 'General inquiry', 'vuloform' ),
				'desc'   => __( 'Lets the visitor say what the question is about.', 'vuloform' ),
				'icon'   => 'help',
				'fields' => array(
					$name,
					$email,
					$phone,
					self::field(
						'select',
						__( 'What is your question about?', 'vuloform' ),
						array(
							'required' => true,
							'options'  => self::options( array( __( 'Sales', 'vuloform' ), __( 'Support', 'vuloform' ), __( 'Billing', 'vuloform' ), __( 'Something else', 'vuloform' ) ) ),
						)
					),
					$message,
				),
			),
			'lead'       => array(
				'title'  => __( 'Lead generation', 'vuloform' ),
				'desc'   => __( 'Collects a business contact, with a company field for businesses.', 'vuloform' ),
				'icon'   => 'profile',
				'fields' => array(
					$name,
					$email,
					$phone,
					self::field(
						'radio',
						__( 'I am enquiring as', 'vuloform' ),
						array(
							'key'      => 'enquiring_as',
							'required' => true,
							'options'  => self::options( array( __( 'An individual', 'vuloform' ), __( 'A business', 'vuloform' ) ) ),
						)
					),
					self::field(
						'text',
						__( 'Company', 'vuloform' ),
						array(
							'conditions' => array(
								'enabled' => true,
								'action'  => 'show',
								'match'   => 'all',
								'rules'   => array(
									array(
										'field'    => 'enquiring_as',
										'operator' => 'is',
										'value'    => __( 'A business', 'vuloform' ),
									),
								),
							),
						)
					),
					self::field( 'textarea', __( 'What are you looking for?', 'vuloform' ) ),
					$consent,
				),
			),
			'newsletter' => array(
				'title'  => __( 'Newsletter signup', 'vuloform' ),
				'desc'   => __( 'An email address and consent.', 'vuloform' ),
				'icon'   => 'notification',
				'fields' => array(
					$email,
					self::field(
						'consent',
						__( 'Consent', 'vuloform' ),
						array(
							'required'     => true,
							'consent_text' => __( 'Yes, send me the newsletter. I can unsubscribe at any time.', 'vuloform' ),
						)
					),
				),
				'submit' => __( 'Subscribe', 'vuloform' ),
			),
			'feedback'   => array(
				'title'  => __( 'Feedback form', 'vuloform' ),
				'desc'   => __( 'A rating and a comment.', 'vuloform' ),
				'icon'   => 'star',
				'fields' => array(
					self::field(
						'radio',
						__( 'How would you rate your experience?', 'vuloform' ),
						array(
							'required' => true,
							'options'  => self::options( array( __( 'Excellent', 'vuloform' ), __( 'Good', 'vuloform' ), __( 'Average', 'vuloform' ), __( 'Poor', 'vuloform' ) ) ),
						)
					),
					self::field( 'textarea', __( 'What could we do better?', 'vuloform' ) ),
					self::field( 'email', __( 'Email (optional)', 'vuloform' ), array( 'description' => __( 'Only if you would like a reply.', 'vuloform' ) ) ),
				),
				'submit' => __( 'Send feedback', 'vuloform' ),
			),
			'survey'     => array(
				'title'  => __( 'Survey', 'vuloform' ),
				'desc'   => __( 'A two-step survey with multiple-choice questions.', 'vuloform' ),
				'icon'   => 'bar-chart',
				'fields' => array(
					self::field( 'heading', __( 'About you', 'vuloform' ) ),
					self::field(
						'select',
						__( 'How did you hear about us?', 'vuloform' ),
						array( 'options' => self::options( array( __( 'Search engine', 'vuloform' ), __( 'Social media', 'vuloform' ), __( 'A friend', 'vuloform' ), __( 'Other', 'vuloform' ) ) ) )
					),
					self::field(
						'checkboxes',
						__( 'Which of our services have you used?', 'vuloform' ),
						array( 'options' => self::options( array( __( 'Service A', 'vuloform' ), __( 'Service B', 'vuloform' ), __( 'Service C', 'vuloform' ) ) ) )
					),
					self::field( 'page_break', __( 'Page break', 'vuloform' ) ),
					self::field( 'heading', __( 'Your opinion', 'vuloform' ) ),
					self::field(
						'radio',
						__( 'How likely are you to recommend us?', 'vuloform' ),
						array(
							'required' => true,
							'options'  => self::options( array( __( 'Very likely', 'vuloform' ), __( 'Likely', 'vuloform' ), __( 'Unlikely', 'vuloform' ), __( 'Very unlikely', 'vuloform' ) ) ),
						)
					),
					self::field( 'textarea', __( 'Anything else you would like to tell us?', 'vuloform' ) ),
				),
			),
			'event'      => array(
				'title'  => __( 'Event registration', 'vuloform' ),
				'desc'   => __( 'Attendee details, number of tickets and dietary needs.', 'vuloform' ),
				'icon'   => 'calendar',
				'fields' => array(
					$name,
					$email,
					$phone,
					self::field(
						'number',
						__( 'Number of attendees', 'vuloform' ),
						array(
							'required' => true,
							'default'  => '1',
							'min'      => '1',
							'max'      => '10',
						)
					),
					self::field(
						'checkboxes',
						__( 'Dietary requirements', 'vuloform' ),
						array( 'options' => self::options( array( __( 'Vegetarian', 'vuloform' ), __( 'Vegan', 'vuloform' ), __( 'Gluten free', 'vuloform' ) ) ) )
					),
					self::field( 'textarea', __( 'Anything we should know?', 'vuloform' ) ),
				),
				'submit' => __( 'Register', 'vuloform' ),
			),
			'job'        => array(
				'title'  => __( 'Job application', 'vuloform' ),
				'desc'   => __( 'Applicant details with a CV upload.', 'vuloform' ),
				'icon'   => 'document',
				'fields' => array(
					$name,
					$email,
					$phone,
					self::field( 'text', __( 'Position you are applying for', 'vuloform' ), array( 'required' => true ) ),
					self::field(
						'file',
						__( 'Your CV', 'vuloform' ),
						array(
							'required'      => true,
							'allowed_types' => array( 'pdf', 'doc', 'docx' ),
							'max_size_mb'   => 5,
						)
					),
					self::field( 'textarea', __( 'Cover letter', 'vuloform' ) ),
					self::field(
						'consent',
						__( 'Consent', 'vuloform' ),
						array(
							'required'     => true,
							'consent_text' => __( 'I agree to my application being stored and reviewed.', 'vuloform' ),
						)
					),
				),
				'submit' => __( 'Apply', 'vuloform' ),
			),
			'support'    => array(
				'title'  => __( 'Support request', 'vuloform' ),
				'desc'   => __( 'Priority, a description and an optional screenshot.', 'vuloform' ),
				'icon'   => 'tools',
				'fields' => array(
					$name,
					$email,
					self::field(
						'select',
						__( 'Priority', 'vuloform' ),
						array(
							'required' => true,
							'options'  => self::options( array( __( 'Low', 'vuloform' ), __( 'Normal', 'vuloform' ), __( 'Urgent', 'vuloform' ) ) ),
						)
					),
					self::field( 'textarea', __( 'Describe the problem', 'vuloform' ), array( 'required' => true ) ),
					self::field(
						'file',
						__( 'Screenshot (optional)', 'vuloform' ),
						array(
							'allowed_types' => array( 'jpg', 'jpeg', 'png' ),
							'max_size_mb'   => 5,
						)
					),
				),
			),
			'quote'      => array(
				'title'  => __( 'Order or quote inquiry', 'vuloform' ),
				'desc'   => __( 'Quantity and unit price with a calculated estimate.', 'vuloform' ),
				'icon'   => 'cart',
				'fields' => array(
					$name,
					$email,
					self::field( 'text', __( 'Product or service', 'vuloform' ), array( 'required' => true ) ),
					self::field(
						'number',
						__( 'Quantity', 'vuloform' ),
						array(
							'key'      => 'quantity',
							'required' => true,
							'default'  => '1',
							'min'      => '1',
							'width'    => 50,
						)
					),
					self::field(
						'number',
						__( 'Budget per item', 'vuloform' ),
						array(
							'key'   => 'budget',
							'min'   => '0',
							'width' => 50,
						)
					),
					self::field(
						'calculation',
						__( 'Estimated total', 'vuloform' ),
						array(
							'formula'  => '{quantity} * {budget}',
							'decimals' => 2,
						)
					),
					self::field( 'textarea', __( 'Details', 'vuloform' ) ),
				),
				'submit' => __( 'Request a quote', 'vuloform' ),
			),
		);

		$out = array();

		foreach ( $templates as $id => $template ) {
			$settings = Schema::default_settings();

			if ( isset( $template['submit'] ) ) {
				$settings['submit_label'] = $template['submit'];
			}

			// Every template tells the site admin about a submission out of the box.
			$settings['notifications'][] = self::admin_notification( 'email' );

			$out[ $id ] = array(
				'title'  => $template['title'],
				'desc'   => $template['desc'],
				'icon'   => $template['icon'],
				'schema' => Schema::sanitize(
					array(
						'fields'   => $template['fields'],
						'settings' => $settings,
					)
				),
			);
		}

		/**
		 * Filters the starter templates.
		 *
		 * @param array $out Template id => title, desc, icon, schema.
		 */
		return (array) apply_filters( 'vuloform_templates', $out );
	}

	/**
	 * The notification every new form starts with: an email to the site's admin address for each
	 * submission. A form that tells nobody is almost never what was meant.
	 *
	 * @param string $reply_to Key of the form's email field, so a reply goes to the visitor; '' for none.
	 * @return array
	 */
	public static function admin_notification( $reply_to = '' ) {
		return array(
			'id'       => 'admin',
			'name'     => __( 'Admin notification', 'vuloform' ),
			'enabled'  => true,
			'channel'  => 'email',
			'to'       => get_option( 'admin_email' ),
			'subject'  => __( 'New submission: {form_title}', 'vuloform' ),
			'message'  => '{all_fields}',
			'reply_to' => $reply_to,
		);
	}

	/**
	 * @param string $type  Field type.
	 * @param string $label Label.
	 * @param array  $extra Other field settings.
	 * @return array
	 */
	private static function field( $type, $label, array $extra = array() ) {
		return array_merge(
			array(
				'type'  => $type,
				'label' => $label,
			),
			$extra
		);
	}

	/**
	 * @param string[] $labels Option labels; each is also its value.
	 * @return array
	 */
	private static function options( array $labels ) {
		$options = array();

		foreach ( $labels as $label ) {
			$options[] = array(
				'label' => $label,
				'value' => $label,
			);
		}

		return $options;
	}
}
