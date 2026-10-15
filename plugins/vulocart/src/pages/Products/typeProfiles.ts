import { __ } from '@wordpress/i18n';

/**
 * What each product type is, how it splits into subtypes, and which cards the editor needs to sell it.
 *
 * The rule: a card or field appears only if the merchant cannot deliver that kind of product without it. Everything
 * else stays out of the way, so a course never asks for a package weight and a donation never asks for a shipping
 * policy. The rows below are the single source of that decision - the editor reads `profileFor()` and renders from it,
 * and the REST controller's SUBTYPES / TYPE_DETAIL_FIELDS mirror the same lists so nothing else is ever stored.
 *
 * Always shown: Product Details, Pricing, Images, Catalog & Sourcing, Search & content, Embed code, Passport.
 * Decided here: Attributes & Variations, Inventory, Shipping, the Type Details card (and which of its fields), the
 * shipping policy, the cancellation policy and the Specifications table.
 */

export interface TypeDetailField {
	key: string;
	label: string;
	kind: 'text' | 'number' | 'select' | 'checkbox' | 'date';
	options?: { label: string; value: string }[];
	hint?: string;
	/** Show only for these subtypes; omitted = every subtype of the type. */
	subtypes?: string[];
}

export interface Subtype {
	value: string;
	label: string;
	/** One line for the picker: what the merchant is selling. */
	hint: string;
	/** Overrides of the type's card needs for this subtype. */
	cards?: Partial< CardNeeds >;
}

export interface CardNeeds {
	/** Attributes & Variations (size, colour, ...). */
	variants: boolean;
	/** Inventory card: units on hand, availability, warehouses. */
	inventory: boolean;
	/** Shipping card: weight, package size, class. */
	shipping: boolean;
	/** Shipping policy field. */
	shippingPolicy: boolean;
	/** Cancellation policy field. */
	cancellation: boolean;
	/** Specifications table in Search & content. */
	specs: boolean;
}

export interface TypeProfile {
	value: string;
	/** `adminfont-*` icon for the chooser and pickers. */
	icon: string;
	/** What the name field is called for this type, e.g. "Course name". */
	nameLabel: string;
	label: string;
	hint: string;
	subtypes: Subtype[];
	cards: CardNeeds;
	/** Title of the Type Details card, when the type has one. */
	detailsTitle?: string;
	fields: TypeDetailField[];
}

const NONE: CardNeeds = { variants: false, inventory: false, shipping: false, shippingPolicy: false, cancellation: false, specs: false };

const PERIODS = [
	{ label: __( 'Per hour', 'vulocart' ), value: 'hour' },
	{ label: __( 'Per day', 'vulocart' ), value: 'day' },
	{ label: __( 'Per week', 'vulocart' ), value: 'week' },
	{ label: __( 'Per month', 'vulocart' ), value: 'month' },
];

export const TYPE_PROFILES: TypeProfile[] = [
	{
		value: 'physical',
		icon: 'product',
		nameLabel: __( 'Product name', 'vulocart' ),
		label: __( 'Physical', 'vulocart' ),
		hint: __( 'A product you ship to the buyer.', 'vulocart' ),
		cards: { ...NONE, inventory: true, shipping: true, shippingPolicy: true, specs: true },
		detailsTitle: __( 'Fulfilment', 'vulocart' ),
		subtypes: [
			{ value: 'standard', label: __( 'Standard', 'vulocart' ), hint: __( 'One product, one price.', 'vulocart' ) },
			{ value: 'variable', label: __( 'With options', 'vulocart' ), hint: __( 'Sizes, colours or other choices.', 'vulocart' ), cards: { variants: true } },
			{ value: 'preorder', label: __( 'Pre-order', 'vulocart' ), hint: __( 'Sold before it is in stock.', 'vulocart' ) },
			{
				value: 'made_to_order',
				label: __( 'Made to order', 'vulocart' ),
				hint: __( 'Produced after the order, no stock held.', 'vulocart' ),
				cards: { inventory: false },
			},
		],
		fields: [
			{ key: 'release_date', label: __( 'Release date', 'vulocart' ), kind: 'date', subtypes: [ 'preorder' ], hint: __( 'When pre-orders start shipping.', 'vulocart' ) },
			{ key: 'preorder_limit', label: __( 'Pre-order limit', 'vulocart' ), kind: 'number', subtypes: [ 'preorder' ], hint: __( 'Leave blank for no cap.', 'vulocart' ) },
			{ key: 'lead_time_days', label: __( 'Production time (days)', 'vulocart' ), kind: 'number', subtypes: [ 'made_to_order' ], hint: __( 'Shown to the customer as the wait before shipping.', 'vulocart' ) },
		],
	},
	{
		value: 'digital',
		icon: 'download',
		nameLabel: __( 'Product name', 'vulocart' ),
		label: __( 'Digital', 'vulocart' ),
		hint: __( 'A file, key or online access delivered instantly.', 'vulocart' ),
		cards: { ...NONE, specs: true },
		detailsTitle: __( 'Digital Delivery', 'vulocart' ),
		subtypes: [
			{ value: 'download', label: __( 'File download', 'vulocart' ), hint: __( 'E-book, template, music, design files.', 'vulocart' ) },
			{ value: 'software', label: __( 'Software & keys', 'vulocart' ), hint: __( 'An app or plugin with a license key.', 'vulocart' ) },
			{ value: 'access', label: __( 'Online access', 'vulocart' ), hint: __( 'A private link, community or stream.', 'vulocart' ) },
		],
		fields: [
			{ key: 'download_url', label: __( 'Download file URL', 'vulocart' ), kind: 'text', subtypes: [ 'download', 'software' ], hint: __( 'Link the customer receives after purchase.', 'vulocart' ) },
			{ key: 'download_limit', label: __( 'Download limit', 'vulocart' ), kind: 'number', subtypes: [ 'download', 'software' ], hint: __( 'Leave blank for unlimited downloads.', 'vulocart' ) },
			{ key: 'download_expiry_days', label: __( 'Link expires after (days)', 'vulocart' ), kind: 'number', subtypes: [ 'download', 'software' ], hint: __( 'Leave blank to never expire.', 'vulocart' ) },
			{ key: 'activations_limit', label: __( 'Sites / devices per key', 'vulocart' ), kind: 'number', subtypes: [ 'software' ], hint: __( 'How many activations one license allows.', 'vulocart' ) },
			{ key: 'validity_days', label: __( 'License valid for (days)', 'vulocart' ), kind: 'number', subtypes: [ 'software' ], hint: __( 'Leave blank for a lifetime license.', 'vulocart' ) },
			{ key: 'access_url', label: __( 'Access link', 'vulocart' ), kind: 'text', subtypes: [ 'access' ], hint: __( 'Where the customer goes after purchase.', 'vulocart' ) },
		],
	},
	{
		value: 'subscription',
		icon: 'subscription',
		nameLabel: __( 'Plan name', 'vulocart' ),
		label: __( 'Subscription', 'vulocart' ),
		hint: __( 'Billed on a schedule until cancelled.', 'vulocart' ),
		cards: { ...NONE, cancellation: true },
		detailsTitle: __( 'Subscription Terms', 'vulocart' ),
		subtypes: [
			{ value: 'access', label: __( 'Access plan', 'vulocart' ), hint: __( 'Software, content or a service.', 'vulocart' ) },
			{
				value: 'box',
				label: __( 'Recurring box', 'vulocart' ),
				hint: __( 'A physical product sent every cycle.', 'vulocart' ),
				cards: { inventory: true, shipping: true, shippingPolicy: true },
			},
		],
		fields: [
			{ key: 'trial_period_days', label: __( 'Free trial (days)', 'vulocart' ), kind: 'number', hint: __( 'Leave blank for no trial.', 'vulocart' ) },
			{ key: 'subscription_length_cycles', label: __( 'Ends after (billing cycles)', 'vulocart' ), kind: 'number', hint: __( 'Leave blank to renew until cancelled.', 'vulocart' ) },
		],
	},
	{
		value: 'course',
		icon: 'cohort',
		nameLabel: __( 'Course name', 'vulocart' ),
		label: __( 'Course', 'vulocart' ),
		hint: __( 'Lessons a student works through.', 'vulocart' ),
		cards: { ...NONE, cancellation: true },
		detailsTitle: __( 'Course Details', 'vulocart' ),
		subtypes: [
			{ value: 'self_paced', label: __( 'Self-paced', 'vulocart' ), hint: __( 'Learn any time, at your own speed.', 'vulocart' ) },
			{ value: 'cohort', label: __( 'Live cohort', 'vulocart' ), hint: __( 'Fixed dates, taught live.', 'vulocart' ) },
		],
		fields: [
			{ key: 'lesson_count', label: __( 'Number of lessons', 'vulocart' ), kind: 'number' },
			{ key: 'duration_hours', label: __( 'Total duration (hours)', 'vulocart' ), kind: 'number' },
			{
				key: 'skill_level',
				label: __( 'Skill level', 'vulocart' ),
				kind: 'select',
				options: [
					{ label: __( 'Beginner', 'vulocart' ), value: 'beginner' },
					{ label: __( 'Intermediate', 'vulocart' ), value: 'intermediate' },
					{ label: __( 'Advanced', 'vulocart' ), value: 'advanced' },
				],
			},
			{ key: 'start_date', label: __( 'Starts on', 'vulocart' ), kind: 'date', subtypes: [ 'cohort' ] },
			{ key: 'live_sessions', label: __( 'Live sessions', 'vulocart' ), kind: 'number', subtypes: [ 'cohort' ] },
			{ key: 'enrollment_limit', label: __( 'Enrollment limit', 'vulocart' ), kind: 'number', hint: __( 'Leave blank for unlimited.', 'vulocart' ) },
		],
	},
	{
		value: 'service',
		icon: 'feature',
		nameLabel: __( 'Service name', 'vulocart' ),
		label: __( 'Service', 'vulocart' ),
		hint: __( 'Work you do for the customer.', 'vulocart' ),
		cards: { ...NONE, cancellation: true },
		detailsTitle: __( 'Service Details', 'vulocart' ),
		subtypes: [
			{ value: 'project', label: __( 'Fixed project', 'vulocart' ), hint: __( 'A defined piece of work with a deadline.', 'vulocart' ) },
			{ value: 'session', label: __( 'Session', 'vulocart' ), hint: __( 'Time with you: consulting, coaching, repair.', 'vulocart' ) },
		],
		fields: [
			{ key: 'delivery_days', label: __( 'Delivered within (days)', 'vulocart' ), kind: 'number', subtypes: [ 'project' ] },
			{ key: 'revisions', label: __( 'Revisions included', 'vulocart' ), kind: 'number', subtypes: [ 'project' ] },
			{ key: 'duration_minutes', label: __( 'Session length (minutes)', 'vulocart' ), kind: 'number', subtypes: [ 'session' ] },
			{
				key: 'location_type',
				label: __( 'Location', 'vulocart' ),
				kind: 'select',
				options: [
					{ label: __( 'In person', 'vulocart' ), value: 'in_person' },
					{ label: __( 'Remote', 'vulocart' ), value: 'remote' },
					{ label: __( 'Either', 'vulocart' ), value: 'either' },
				],
			},
		],
	},
	{
		value: 'membership',
		icon: 'membership',
		nameLabel: __( 'Membership name', 'vulocart' ),
		label: __( 'Membership', 'vulocart' ),
		hint: __( 'Ongoing access to perks or a members area.', 'vulocart' ),
		cards: { ...NONE, cancellation: true },
		detailsTitle: __( 'Membership Details', 'vulocart' ),
		subtypes: [
			{ value: 'fixed_term', label: __( 'Fixed term', 'vulocart' ), hint: __( 'Access for a set number of days.', 'vulocart' ) },
			{ value: 'recurring', label: __( 'Recurring', 'vulocart' ), hint: __( 'Renews until cancelled.', 'vulocart' ) },
			{ value: 'lifetime', label: __( 'Lifetime', 'vulocart' ), hint: __( 'One payment, access forever.', 'vulocart' ), cards: { cancellation: false } },
		],
		fields: [
			{ key: 'membership_duration_days', label: __( 'Membership duration (days)', 'vulocart' ), kind: 'number', subtypes: [ 'fixed_term' ] },
		],
	},
	{
		value: 'booking',
		icon: 'calendar',
		nameLabel: __( 'Booking name', 'vulocart' ),
		label: __( 'Booking', 'vulocart' ),
		hint: __( 'A time slot, seat or ticket.', 'vulocart' ),
		cards: { ...NONE, cancellation: true },
		detailsTitle: __( 'Booking Details', 'vulocart' ),
		subtypes: [
			{ value: 'appointment', label: __( 'Appointment', 'vulocart' ), hint: __( 'One person books one slot.', 'vulocart' ) },
			{ value: 'class', label: __( 'Group class', 'vulocart' ), hint: __( 'Several people share a slot.', 'vulocart' ) },
			{ value: 'event', label: __( 'Event ticket', 'vulocart' ), hint: __( 'Entry to a dated event.', 'vulocart' ) },
		],
		fields: [
			{ key: 'slot_duration_minutes', label: __( 'Slot length (minutes)', 'vulocart' ), kind: 'number', subtypes: [ 'appointment', 'class' ] },
			{ key: 'max_attendees_per_slot', label: __( 'Seats per slot', 'vulocart' ), kind: 'number', subtypes: [ 'class' ] },
			{ key: 'event_date', label: __( 'Event date', 'vulocart' ), kind: 'date', subtypes: [ 'event' ] },
			{ key: 'venue', label: __( 'Venue', 'vulocart' ), kind: 'text', subtypes: [ 'event' ], hint: __( 'Address or online link.', 'vulocart' ) },
			{ key: 'capacity', label: __( 'Tickets available', 'vulocart' ), kind: 'number', subtypes: [ 'event' ] },
		],
	},
	{
		value: 'rental',
		icon: 'cart',
		nameLabel: __( 'Rental name', 'vulocart' ),
		label: __( 'Rental', 'vulocart' ),
		hint: __( 'Something customers use for a period and return.', 'vulocart' ),
		cards: { ...NONE, cancellation: true },
		detailsTitle: __( 'Rental Terms', 'vulocart' ),
		subtypes: [
			{
				value: 'equipment',
				label: __( 'Equipment', 'vulocart' ),
				hint: __( 'Gear that is shipped or collected.', 'vulocart' ),
				cards: { inventory: true, shipping: true, shippingPolicy: true },
			},
			{ value: 'space', label: __( 'Space or venue', 'vulocart' ), hint: __( 'Used on site, nothing ships.', 'vulocart' ) },
		],
		fields: [
			{ key: 'rental_period', label: __( 'Rental period', 'vulocart' ), kind: 'select', options: PERIODS },
			{ key: 'deposit_amount', label: __( 'Deposit amount', 'vulocart' ), kind: 'number' },
			{ key: 'late_fee_per_day', label: __( 'Late fee per day', 'vulocart' ), kind: 'number', subtypes: [ 'equipment' ] },
			{ key: 'capacity', label: __( 'Capacity (people)', 'vulocart' ), kind: 'number', subtypes: [ 'space' ] },
		],
	},
	{
		value: 'bundle',
		icon: 'category',
		nameLabel: __( 'Bundle name', 'vulocart' ),
		label: __( 'Bundle', 'vulocart' ),
		hint: __( 'Several products sold together.', 'vulocart' ),
		cards: { ...NONE, inventory: true, shipping: true, shippingPolicy: true },
		detailsTitle: __( 'Bundle Contents', 'vulocart' ),
		subtypes: [
			{ value: 'fixed', label: __( 'Fixed set', 'vulocart' ), hint: __( 'Everything is included.', 'vulocart' ) },
			{ value: 'mix_and_match', label: __( 'Mix & match', 'vulocart' ), hint: __( 'Customer picks some from a list.', 'vulocart' ) },
		],
		fields: [
			{ key: 'bundle_items', label: __( 'Bundle items', 'vulocart' ), kind: 'text', hint: __( 'Comma-separated product ids included in this bundle.', 'vulocart' ) },
			{ key: 'pick_count', label: __( 'Items the customer picks', 'vulocart' ), kind: 'number', subtypes: [ 'mix_and_match' ] },
		],
	},
	{
		value: 'donation',
		icon: 'price',
		nameLabel: __( 'Campaign name', 'vulocart' ),
		label: __( 'Donation', 'vulocart' ),
		hint: __( 'A contribution of any amount.', 'vulocart' ),
		cards: { ...NONE },
		detailsTitle: __( 'Donation Details', 'vulocart' ),
		subtypes: [
			{ value: 'general', label: __( 'General', 'vulocart' ), hint: __( 'An open, ongoing cause.', 'vulocart' ) },
			{ value: 'campaign', label: __( 'Campaign', 'vulocart' ), hint: __( 'A fundraiser with a goal.', 'vulocart' ) },
		],
		fields: [{ key: 'goal_amount', label: __( 'Fundraising goal', 'vulocart' ), kind: 'number', subtypes: [ 'campaign' ] }],
	},
	{
		value: 'gift_card',
		icon: 'gift-card',
		nameLabel: __( 'Gift card name', 'vulocart' ),
		label: __( 'Gift card', 'vulocart' ),
		hint: __( 'A balance someone redeems later.', 'vulocart' ),
		cards: { ...NONE },
		detailsTitle: __( 'Gift Card Details', 'vulocart' ),
		subtypes: [
			{ value: 'digital', label: __( 'Digital', 'vulocart' ), hint: __( 'Code sent by email.', 'vulocart' ) },
			{
				value: 'physical',
				label: __( 'Physical card', 'vulocart' ),
				hint: __( 'A printed card in the post.', 'vulocart' ),
				cards: { inventory: true, shipping: true, shippingPolicy: true },
			},
		],
		fields: [{ key: 'expiry_days', label: __( 'Expires after (days)', 'vulocart' ), kind: 'number', hint: __( 'Leave blank to never expire.', 'vulocart' ) }],
	},
	{
		value: 'license',
		icon: 'identity-verification',
		nameLabel: __( 'License name', 'vulocart' ),
		label: __( 'License', 'vulocart' ),
		hint: __( 'Older license products, kept as they are.', 'vulocart' ),
		cards: { ...NONE },
		subtypes: [{ value: 'standard', label: __( 'Standard', 'vulocart' ), hint: __( 'A license key.', 'vulocart' ) }],
		fields: [],
	},
];

export const PRODUCT_TYPE_OPTIONS = TYPE_PROFILES.map( ( profile ) => ( { label: profile.label, value: profile.value } ) );

export function profileFor( type: string ): TypeProfile {
	return TYPE_PROFILES.find( ( profile ) => profile.value === type ) ?? TYPE_PROFILES[ 0 ];
}

/** The subtype in effect: the saved one if it belongs to the type, else the type's first. */
export function subtypeFor( type: string, subtype: string ): Subtype {
	const profile = profileFor( type );

	return profile.subtypes.find( ( candidate ) => candidate.value === subtype ) ?? profile.subtypes[ 0 ];
}

export function cardsFor( type: string, subtype: string ): CardNeeds {
	return { ...profileFor( type ).cards, ...( subtypeFor( type, subtype ).cards ?? {} ) };
}

export function fieldsFor( type: string, subtype: string ): TypeDetailField[] {
	const active = subtypeFor( type, subtype ).value;

	return profileFor( type ).fields.filter( ( field ) => ! field.subtypes || field.subtypes.includes( active ) );
}
