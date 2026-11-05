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
		// Used both as an RSVP option and as what its own conditional fields check for.
		$rsvp_yes = __( 'Yes, I will be there', 'vuloform' );

		$templates = array(
			'contact'           => array(
				'title'  => __( 'Contact form', 'vuloform' ),
				'desc'   => __( 'Name, email and a message.', 'vuloform' ),
				'icon'   => 'mail',
				'fields' => array( $name, $email, self::field( 'text', __( 'Subject', 'vuloform' ) ), $message ),
			),
			'inquiry'           => array(
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
			'lead'              => array(
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
						array( 'conditions' => self::show_if( 'enquiring_as', __( 'A business', 'vuloform' ) ) )
					),
					self::field( 'textarea', __( 'What are you looking for?', 'vuloform' ) ),
					$consent,
				),
			),
			'newsletter'        => array(
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
			'feedback'          => array(
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
			'survey'            => array(
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
			'event'             => array(
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
			'job'               => array(
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
			'support'           => array(
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
			'quote'             => array(
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
			'donation'          => array(
				'title'  => __( 'Donation form', 'vuloform' ),
				'desc'   => __( 'A preset or custom amount, with donor details.', 'vuloform' ),
				'icon'   => 'dollar',
				'fields' => array(
					self::field(
						'radio',
						__( 'Donation amount', 'vuloform' ),
						array(
							'key'      => 'preset_amount',
							'required' => true,
							'options'  => self::options( array( '$10', '$25', '$50', '$100', __( 'Other amount', 'vuloform' ) ) ),
						)
					),
					self::field(
						'number',
						__( 'Enter your amount', 'vuloform' ),
						array(
							'key'        => 'custom_amount',
							'required'   => true,
							'min'        => '1',
							'conditions' => self::show_if( 'preset_amount', __( 'Other amount', 'vuloform' ) ),
						)
					),
					$name,
					$email,
					self::field( 'textarea', __( 'Message (optional)', 'vuloform' ) ),
					self::field(
						'consent',
						__( 'Consent', 'vuloform' ),
						array(
							'required'     => true,
							'consent_text' => __( 'I agree to my details being stored to process this donation.', 'vuloform' ),
						)
					),
				),
				'submit' => __( 'Donate', 'vuloform' ),
			),
			'complaint'         => array(
				'title'  => __( 'Customer complaint form', 'vuloform' ),
				'desc'   => __( 'Order reference, category and details of the issue.', 'vuloform' ),
				'icon'   => 'report',
				'fields' => array(
					$name,
					$email,
					$phone,
					self::field( 'text', __( 'Order or reference number', 'vuloform' ) ),
					self::field(
						'select',
						__( 'Complaint category', 'vuloform' ),
						array(
							'required' => true,
							'options'  => self::options( array( __( 'Product quality', 'vuloform' ), __( 'Service', 'vuloform' ), __( 'Billing', 'vuloform' ), __( 'Delivery', 'vuloform' ), __( 'Other', 'vuloform' ) ) ),
						)
					),
					self::field( 'textarea', __( 'Describe the issue', 'vuloform' ), array( 'required' => true ) ),
					self::field( 'textarea', __( 'What resolution would you like?', 'vuloform' ) ),
				),
				'submit' => __( 'Submit complaint', 'vuloform' ),
			),
			'event_feedback'    => array(
				'title'  => __( 'Event feedback form', 'vuloform' ),
				'desc'   => __( 'A rating and comments about an event just attended.', 'vuloform' ),
				'icon'   => 'review',
				'fields' => array(
					self::field( 'text', __( 'Which event did you attend?', 'vuloform' ), array( 'required' => true ) ),
					self::field(
						'radio',
						__( 'How would you rate the event?', 'vuloform' ),
						array(
							'required' => true,
							'options'  => self::options( array( __( 'Excellent', 'vuloform' ), __( 'Good', 'vuloform' ), __( 'Average', 'vuloform' ), __( 'Poor', 'vuloform' ) ) ),
						)
					),
					self::field( 'textarea', __( 'What did you like most?', 'vuloform' ) ),
					self::field( 'textarea', __( 'What could we improve?', 'vuloform' ) ),
					self::field( 'email', __( 'Email (optional)', 'vuloform' ), array( 'description' => __( 'Only if you would like a reply.', 'vuloform' ) ) ),
				),
				'submit' => __( 'Send feedback', 'vuloform' ),
			),
			'home_service'      => array(
				'title'  => __( 'Home service request form', 'vuloform' ),
				'desc'   => __( 'Service address, type of service and a preferred time.', 'vuloform' ),
				'icon'   => 'home',
				'fields' => array(
					$name,
					$email,
					$phone,
					self::field( 'address', __( 'Service address', 'vuloform' ), array( 'required' => true ) ),
					self::field(
						'select',
						__( 'Type of service', 'vuloform' ),
						array(
							'required' => true,
							'options'  => self::options( array( __( 'Cleaning', 'vuloform' ), __( 'Plumbing', 'vuloform' ), __( 'Electrical', 'vuloform' ), __( 'Repairs', 'vuloform' ), __( 'Other', 'vuloform' ) ) ),
						)
					),
					self::field(
                        'date',
                        __( 'Preferred date', 'vuloform' ),
                        array(
							'required' => true,
							'width'    => 50,
                        )
                    ),
					self::field( 'time', __( 'Preferred time', 'vuloform' ), array( 'width' => 50 ) ),
					self::field( 'textarea', __( 'Details', 'vuloform' ) ),
				),
				'submit' => __( 'Request service', 'vuloform' ),
			),
			'reservation'       => array(
				'title'  => __( 'Restaurant reservation form', 'vuloform' ),
				'desc'   => __( 'Date, time and party size for a table booking.', 'vuloform' ),
				'icon'   => 'booking',
				'fields' => array(
					$name,
					$email,
					$phone,
					self::field(
                        'date',
                        __( 'Reservation date', 'vuloform' ),
                        array(
							'required' => true,
							'width'    => 50,
                        )
                    ),
					self::field(
                        'time',
                        __( 'Reservation time', 'vuloform' ),
                        array(
							'required' => true,
							'width'    => 50,
                        )
                    ),
					self::field(
						'number',
						__( 'Number of guests', 'vuloform' ),
						array(
							'key'      => 'guests',
							'required' => true,
							'default'  => '2',
							'min'      => '1',
							'max'      => '20',
						)
					),
					self::field( 'textarea', __( 'Special requests (optional)', 'vuloform' ) ),
				),
				'submit' => __( 'Reserve a table', 'vuloform' ),
			),
			'rsvp'              => array(
				'title'  => __( 'RSVP form', 'vuloform' ),
				'desc'   => __( 'Attendance, guest count and dietary needs for an invitation.', 'vuloform' ),
				'icon'   => 'check',
				'fields' => array(
					$name,
					$email,
					self::field(
						'radio',
						__( 'Will you be attending?', 'vuloform' ),
						array(
							'key'      => 'attending',
							'required' => true,
							'options'  => self::options( array( $rsvp_yes, __( 'No, I cannot make it', 'vuloform' ), __( 'Maybe', 'vuloform' ) ) ),
						)
					),
					self::field(
						'number',
						__( 'Number of guests, including you', 'vuloform' ),
						array(
							'key'        => 'guest_count',
							'default'    => '1',
							'min'        => '1',
							'max'        => '10',
							'conditions' => self::show_if( 'attending', $rsvp_yes ),
						)
					),
					self::field(
						'textarea',
						__( 'Dietary restrictions (optional)', 'vuloform' ),
						array( 'conditions' => self::show_if( 'attending', $rsvp_yes ) )
					),
					self::field( 'textarea', __( 'Message (optional)', 'vuloform' ) ),
				),
				'submit' => __( 'Send RSVP', 'vuloform' ),
			),
			'registration'      => array(
				'title'  => __( 'Registration form', 'vuloform' ),
				'desc'   => __( 'Sign up for an account, membership or program.', 'vuloform' ),
				'icon'   => 'user-circle',
				'fields' => array(
					$name,
					$email,
					self::field( 'text', __( 'Username', 'vuloform' ), array( 'required' => true ) ),
					self::field(
                        'password',
                        __( 'Password', 'vuloform' ),
                        array(
							'required'  => true,
							'minlength' => 8,
                        )
                    ),
					$consent,
				),
				'submit' => __( 'Register', 'vuloform' ),
			),
			'appointment'       => array(
				'title'  => __( 'Appointment booking form', 'vuloform' ),
				'desc'   => __( 'Service, preferred date and time, and contact details.', 'vuloform' ),
				'icon'   => 'appointment',
				'fields' => array(
					$name,
					$email,
					$phone,
					self::field(
						'select',
						__( 'Service', 'vuloform' ),
						array(
							'required' => true,
							'options'  => self::options( array( __( 'Consultation', 'vuloform' ), __( 'Follow-up', 'vuloform' ), __( 'Other', 'vuloform' ) ) ),
						)
					),
					self::field(
                        'date',
                        __( 'Preferred date', 'vuloform' ),
                        array(
							'required' => true,
							'width'    => 50,
                        )
                    ),
					self::field( 'time', __( 'Preferred time', 'vuloform' ), array( 'width' => 50 ) ),
					self::field( 'textarea', __( 'Notes (optional)', 'vuloform' ) ),
				),
				'submit' => __( 'Book appointment', 'vuloform' ),
			),
			'order'             => array(
				'title'  => __( 'Order form', 'vuloform' ),
				'desc'   => __( 'Item, quantity and delivery details for a small business order.', 'vuloform' ),
				'icon'   => 'order',
				'fields' => array(
					$name,
					$email,
					$phone,
					self::field( 'text', __( 'Product or item', 'vuloform' ), array( 'required' => true ) ),
					self::field(
                        'number',
                        __( 'Quantity', 'vuloform' ),
                        array(
							'required' => true,
							'default'  => '1',
							'min'      => '1',
                        )
                    ),
					self::field( 'address', __( 'Delivery address', 'vuloform' ) ),
					self::field( 'textarea', __( 'Notes (optional)', 'vuloform' ) ),
				),
				'submit' => __( 'Place order', 'vuloform' ),
			),
			'volunteer'         => array(
				'title'  => __( 'Volunteer sign-up form', 'vuloform' ),
				'desc'   => __( 'Availability and areas of interest for volunteering.', 'vuloform' ),
				'icon'   => 'global-community',
				'fields' => array(
					$name,
					$email,
					$phone,
					self::field(
						'checkboxes',
						__( 'When are you available?', 'vuloform' ),
						array( 'options' => self::options( array( __( 'Weekdays', 'vuloform' ), __( 'Weekends', 'vuloform' ), __( 'Evenings', 'vuloform' ) ) ) )
					),
					self::field(
						'checkboxes',
						__( 'Areas you are interested in', 'vuloform' ),
						array( 'options' => self::options( array( __( 'Events', 'vuloform' ), __( 'Admin support', 'vuloform' ), __( 'Fundraising', 'vuloform' ), __( 'On-site help', 'vuloform' ) ) ) )
					),
					self::field( 'textarea', __( 'Anything else you would like to share?', 'vuloform' ) ),
				),
				'submit' => __( 'Sign up to volunteer', 'vuloform' ),
			),
			'enrollment'        => array(
				'title'  => __( 'Course enrollment form', 'vuloform' ),
				'desc'   => __( 'Student details and the course they want to join.', 'vuloform' ),
				'icon'   => 'classroom-enrollment',
				'fields' => array(
					$name,
					$email,
					$phone,
					self::field( 'text', __( 'Course', 'vuloform' ), array( 'required' => true ) ),
					self::field( 'date', __( 'Preferred start date', 'vuloform' ) ),
					self::field( 'textarea', __( 'Anything we should know?', 'vuloform' ) ),
				),
				'submit' => __( 'Enroll now', 'vuloform' ),
			),
			'real_estate'       => array(
				'title'  => __( 'Real estate inquiry form', 'vuloform' ),
				'desc'   => __( 'Property interest and contact details for a viewing or more information.', 'vuloform' ),
				'icon'   => 'location',
				'fields' => array(
					$name,
					$email,
					$phone,
					self::field( 'text', __( 'Property of interest', 'vuloform' ), array( 'required' => true ) ),
					self::field(
						'select',
						__( 'Budget range', 'vuloform' ),
						array( 'options' => self::options( array( __( 'Under $200,000', 'vuloform' ), __( '$200,000 - $500,000', 'vuloform' ), __( '$500,000 - $1,000,000', 'vuloform' ), __( 'Over $1,000,000', 'vuloform' ) ) ) )
					),
					self::field( 'textarea', __( 'Message', 'vuloform' ) ),
				),
				'submit' => __( 'Send inquiry', 'vuloform' ),
			),
			'medical_history'   => array(
				'title'  => __( 'Medical history form', 'vuloform' ),
				'desc'   => __( 'Patient details and health background for a provider.', 'vuloform' ),
				'icon'   => 'file-submission',
				'fields' => array(
					$name,
					$email,
					$phone,
					self::field( 'date', __( 'Date of birth', 'vuloform' ), array( 'required' => true ) ),
					self::field( 'textarea', __( 'Known allergies', 'vuloform' ) ),
					self::field( 'textarea', __( 'Current medications', 'vuloform' ) ),
					self::field(
						'consent',
						__( 'Consent', 'vuloform' ),
						array(
							'required'     => true,
							'consent_text' => __( 'I agree to this health information being stored and used to provide my care.', 'vuloform' ),
						)
					),
				),
				'submit' => __( 'Submit health history', 'vuloform' ),
			),
			'travel'            => array(
				'title'  => __( 'Travel booking form', 'vuloform' ),
				'desc'   => __( 'Destination, dates and traveler details for a trip request.', 'vuloform' ),
				'icon'   => 'booking1',
				'fields' => array(
					$name,
					$email,
					$phone,
					self::field( 'text', __( 'Destination', 'vuloform' ), array( 'required' => true ) ),
					self::field(
                        'date',
                        __( 'Departure date', 'vuloform' ),
                        array(
							'required' => true,
							'width'    => 50,
                        )
                    ),
					self::field( 'date', __( 'Return date', 'vuloform' ), array( 'width' => 50 ) ),
					self::field(
                        'number',
                        __( 'Number of travelers', 'vuloform' ),
                        array(
							'default' => '1',
							'min'     => '1',
                        )
                    ),
					self::field( 'textarea', __( 'Message', 'vuloform' ) ),
				),
				'submit' => __( 'Request booking', 'vuloform' ),
			),
			'rma'               => array(
				'title'  => __( 'Return request (RMA) form', 'vuloform' ),
				'desc'   => __( 'Order number, item and reason for a return.', 'vuloform' ),
				'icon'   => 'return-and-warrenty',
				'fields' => array(
					$name,
					$email,
					self::field( 'text', __( 'Order number', 'vuloform' ), array( 'required' => true ) ),
					self::field( 'text', __( 'Item', 'vuloform' ), array( 'required' => true ) ),
					self::field(
						'select',
						__( 'Reason for return', 'vuloform' ),
						array(
							'required' => true,
							'options'  => self::options( array( __( 'Defective', 'vuloform' ), __( 'Wrong item received', 'vuloform' ), __( 'No longer needed', 'vuloform' ), __( 'Other', 'vuloform' ) ) ),
						)
					),
					self::field(
						'select',
						__( 'Preferred resolution', 'vuloform' ),
						array( 'options' => self::options( array( __( 'Refund', 'vuloform' ), __( 'Replacement', 'vuloform' ), __( 'Store credit', 'vuloform' ) ) ) )
					),
					self::field( 'textarea', __( 'Details', 'vuloform' ) ),
				),
				'submit' => __( 'Submit return request', 'vuloform' ),
			),
			'course_evaluation' => array(
				'title'  => __( 'Course evaluation form', 'vuloform' ),
				'desc'   => __( 'Rating and feedback on a course just completed.', 'vuloform' ),
				'icon'   => 'thumbs-ok',
				'fields' => array(
					self::field( 'text', __( 'Course name', 'vuloform' ), array( 'required' => true ) ),
					self::field(
						'radio',
						__( 'How would you rate the instructor?', 'vuloform' ),
						array(
							'required' => true,
							'options'  => self::options( array( __( 'Excellent', 'vuloform' ), __( 'Good', 'vuloform' ), __( 'Average', 'vuloform' ), __( 'Poor', 'vuloform' ) ) ),
						)
					),
					self::field(
						'radio',
						__( 'How would you rate the course content?', 'vuloform' ),
						array(
							'required' => true,
							'options'  => self::options( array( __( 'Excellent', 'vuloform' ), __( 'Good', 'vuloform' ), __( 'Average', 'vuloform' ), __( 'Poor', 'vuloform' ) ) ),
						)
					),
					self::field( 'textarea', __( 'What did you like most?', 'vuloform' ) ),
					self::field( 'textarea', __( 'What could be improved?', 'vuloform' ) ),
					self::field( 'email', __( 'Email (optional)', 'vuloform' ) ),
				),
				'submit' => __( 'Submit evaluation', 'vuloform' ),
			),
			'conference'        => array(
				'title'  => __( 'Conference registration form', 'vuloform' ),
				'desc'   => __( 'Attendee details and session choices for a conference.', 'vuloform' ),
				'icon'   => 'announcement',
				'fields' => array(
					$name,
					$email,
					$phone,
					self::field( 'text', __( 'Organization', 'vuloform' ) ),
					self::field(
						'checkboxes',
						__( 'Which sessions are you interested in?', 'vuloform' ),
						array( 'options' => self::options( array( __( 'Keynote', 'vuloform' ), __( 'Workshops', 'vuloform' ), __( 'Networking', 'vuloform' ), __( 'Panel discussions', 'vuloform' ) ) ) )
					),
					self::field( 'textarea', __( 'Dietary requirements (optional)', 'vuloform' ) ),
				),
				'submit' => __( 'Register for the conference', 'vuloform' ),
			),
			'fitness'           => array(
				'title'  => __( 'Fitness class registration form', 'vuloform' ),
				'desc'   => __( 'Class choice, preferred schedule and an emergency contact.', 'vuloform' ),
				'icon'   => 'active',
				'fields' => array(
					$name,
					$email,
					$phone,
					self::field(
						'select',
						__( 'Class', 'vuloform' ),
						array(
							'required' => true,
							'options'  => self::options( array( __( 'Yoga', 'vuloform' ), __( 'Pilates', 'vuloform' ), __( 'Spin', 'vuloform' ), __( 'Strength training', 'vuloform' ), __( 'Other', 'vuloform' ) ) ),
						)
					),
					self::field(
						'select',
						__( 'Preferred schedule', 'vuloform' ),
						array( 'options' => self::options( array( __( 'Morning', 'vuloform' ), __( 'Afternoon', 'vuloform' ), __( 'Evening', 'vuloform' ) ) ) )
					),
					self::field( 'text', __( 'Emergency contact name', 'vuloform' ) ),
					self::field( 'phone', __( 'Emergency contact phone', 'vuloform' ) ),
				),
				'submit' => __( 'Register for class', 'vuloform' ),
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

	/**
	 * A field's `conditions` setting for "show this field only when another field's answer is X".
	 *
	 * @param string $field Key of the field to check.
	 * @param string $value The answer that shows this field.
	 * @return array
	 */
	private static function show_if( $field, $value ) {
		return array(
			'enabled' => true,
			'action'  => 'show',
			'match'   => 'all',
			'rules'   => array(
				array(
					'field'    => $field,
					'operator' => 'is',
					'value'    => $value,
				),
			),
		);
	}
}
