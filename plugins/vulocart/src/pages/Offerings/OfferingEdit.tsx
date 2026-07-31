/* global vulocartLocalizer */
import { useEffect, useMemo, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { CardComponent, FormGroupWrapperComponent, FormGroupComponent } from '@zyra/components';
import { TextInput, TextAreaInput, SelectInput, ButtonInput, MultiCheckboxInput, FileInput } from '@zyra/inputs';
import './offerings-page.scss';

/**
 * The 12 types Domain\Offering\OfferingType declares (classes/Domain/Offering/OfferingType.php)
 * — duplicated here rather than fetched, same tradeoff this file's
 * predecessor (OfferingsPage.tsx) already accepted. Powers "What kind of
 * offering is this?", and — via TYPE_FIELD_CONFIG/STOCK_TRACKED_TYPES/
 * SHIPPABLE_TYPES below — which fields/sections the rest of the form
 * shows. 11 of these 12 (all but `license`) are this plugin's admin-UX
 * brief's explicit offering-type list; `license` predates that brief and
 * is kept only for backward compatibility with any offering already using
 * it (naming-quality.md/backward-compatibility.md — not something to
 * silently drop), with no type-specific fields of its own.
 */
const OFFERING_TYPE_OPTIONS = [
	'physical',
	'digital',
	'subscription',
	'course',
	'service',
	'membership',
	'booking',
	'rental',
	'bundle',
	'donation',
	'gift_card',
	'license',
].map( ( type ) => ( { label: type, value: type } ) );

const OFFERING_STATUS_OPTIONS = [
	{ label: 'draft', value: 'draft' },
	{ label: 'published', value: 'published' },
	{ label: 'archived', value: 'archived' },
];

const STOCK_STATUS_OPTIONS = [
	{ label: __( 'In stock', 'vulocart' ), value: 'in_stock' },
	{ label: __( 'Out of stock', 'vulocart' ), value: 'out_of_stock' },
	{ label: __( 'On backorder', 'vulocart' ), value: 'backorder' },
];

const SHIPPING_CLASS_OPTIONS = [
	{ label: __( 'Standard', 'vulocart' ), value: 'standard' },
	{ label: __( 'Fragile', 'vulocart' ), value: 'fragile' },
	{ label: __( 'Oversized', 'vulocart' ), value: 'oversized' },
	{ label: __( 'Free shipping', 'vulocart' ), value: 'free_shipping' },
];

const CATALOG_VISIBILITY_OPTIONS = [
	{ label: __( 'Shop and search results', 'vulocart' ), value: 'shop_and_search' },
	{ label: __( 'Shop only', 'vulocart' ), value: 'shop_only' },
	{ label: __( 'Search results only', 'vulocart' ), value: 'search_only' },
	{ label: __( 'Hidden', 'vulocart' ), value: 'hidden' },
];

interface CategoryTerm {
	id: number;
	name: string;
	slug: string;
	parent_id: number | null;
}

/**
 * Real, DB-backed categories now (`GET /categories`,
 * classes/RestAPI/Controllers/Terms.php) — managed from the Offerings
 * menu's own "Categories" page (`src/pages/Terms/TermsPage.tsx`), no
 * longer a hardcoded list. Selections persist in `meta.categories` by
 * slug (Controllers/Offerings.php's `sanitize_offering_meta()`), unchanged;
 * `formatCategoryOptions()` re-derives the "— " child-indentation
 * presentation from each term's real `parent_id` instead of that being
 * hand-typed per option.
 *
 * @param terms Categories fetched from `GET /categories`.
 * @return { key: string; value: string; label: string }[]
 */
function formatCategoryOptions( terms: CategoryTerm[] ) {
	const byParent = new Map< number | null, CategoryTerm[] >();

	terms.forEach( ( term ) => {
		const siblings = byParent.get( term.parent_id ) ?? [];
		siblings.push( term );
		byParent.set( term.parent_id, siblings );
	} );

	const options: { key: string; value: string; label: string }[] = [];

	const appendChildren = ( parentId: number | null, depth: number ) => {
		( byParent.get( parentId ) ?? [] ).forEach( ( term ) => {
			options.push( {
				key: term.slug,
				value: term.slug,
				label: depth > 0 ? `${ '— '.repeat( depth ) }${ term.name }` : term.name,
			} );
			appendChildren( term.id, depth + 1 );
		} );
	};

	appendChildren( null, 0 );

	return options;
}

/**
 * Every type's delivery nature is now derived from `type` itself rather
 * than a separate manual picker (the old "How will this be delivered?"
 * 4-card section) — `type` already encodes physical vs. digital vs.
 * service, so asking the merchant to pick delivery *again* would just be
 * redundant. Still persisted to `meta.delivery_method`
 * (Controllers/Offerings.php's `sanitize_offering_meta()`) for any future
 * code (search/filtering) that wants a coarse delivery bucket without
 * inspecting all 11 `type` values.
 */
const TYPE_TO_DELIVERY_METHOD: Record< string, string > = {
	physical: 'physical',
	digital: 'downloadable',
	subscription: 'digital_service',
	course: 'digital_service',
	service: 'digital_service',
	membership: 'digital_service',
	booking: 'digital_service',
	rental: 'physical',
	bundle: 'other',
	donation: 'digital_service',
	gift_card: 'downloadable',
	license: 'downloadable',
};

/**
 * Types that get the "Stock & inventory"/"Shipping" cards at all — a
 * Course or Subscription has no physical stock or package to ship, so
 * showing those sections for them would be noise, not "dynamic" in any
 * useful sense.
 */
const STOCK_TRACKED_TYPES = new Set( [ 'physical', 'rental', 'bundle', 'gift_card' ] );
const SHIPPABLE_TYPES = new Set( [ 'physical', 'rental', 'bundle' ] );

interface TypeDetailField {
	key: string;
	label: string;
	kind: 'text' | 'number' | 'select' | 'checkbox';
	options?: { label: string; value: string }[];
	hint?: string;
}

/**
 * The real, per-type functionality this offering-type list needs — each
 * type gets its own small set of fields in a dynamically-shown "Type
 * Details" card, matching how WooCommerce's simple/variable/grouped/
 * external product types each expose different meta-box fields. Physical
 * has no entry here — its "type-specific" behavior is the always-present
 * Stock & Inventory/Shipping cards, gated by STOCK_TRACKED_TYPES/
 * SHIPPABLE_TYPES above instead of this map. `license` (the 12th
 * OfferingType constant, kept for backward compatibility — see
 * OFFERING_TYPE_OPTIONS' docblock) has no entry either, since this plugin's
 * admin-UX brief's 11-type list doesn't include it.
 */
const TYPE_FIELD_CONFIG: Record< string, TypeDetailField[] > = {
	digital: [
		{
			key: 'download_url',
			label: __( 'Download file URL', 'vulocart' ),
			kind: 'text',
			hint: __( 'Link the customer receives after purchase.', 'vulocart' ),
		},
		{
			key: 'download_limit',
			label: __( 'Download limit', 'vulocart' ),
			kind: 'number',
			hint: __( 'Leave blank for unlimited downloads.', 'vulocart' ),
		},
		{
			key: 'download_expiry_days',
			label: __( 'Link expires after (days)', 'vulocart' ),
			kind: 'number',
			hint: __( 'Leave blank to never expire.', 'vulocart' ),
		},
	],
	subscription: [
		{
			key: 'billing_interval',
			label: __( 'Billing interval', 'vulocart' ),
			kind: 'select',
			options: [
				{ label: __( 'Daily', 'vulocart' ), value: 'daily' },
				{ label: __( 'Weekly', 'vulocart' ), value: 'weekly' },
				{ label: __( 'Monthly', 'vulocart' ), value: 'monthly' },
				{ label: __( 'Yearly', 'vulocart' ), value: 'yearly' },
			],
		},
		{
			key: 'trial_period_days',
			label: __( 'Free trial (days)', 'vulocart' ),
			kind: 'number',
			hint: __( 'Leave blank for no trial.', 'vulocart' ),
		},
		{
			key: 'subscription_length_cycles',
			label: __( 'Subscription length (cycles)', 'vulocart' ),
			kind: 'number',
			hint: __( 'Leave blank for until cancelled.', 'vulocart' ),
		},
	],
	course: [
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
		{
			key: 'enrollment_limit',
			label: __( 'Enrollment limit', 'vulocart' ),
			kind: 'number',
			hint: __( 'Leave blank for unlimited.', 'vulocart' ),
		},
	],
	service: [
		{ key: 'duration_minutes', label: __( 'Service duration (minutes)', 'vulocart' ), kind: 'number' },
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
	membership: [
		{
			key: 'membership_duration_days',
			label: __( 'Membership duration (days)', 'vulocart' ),
			kind: 'number',
			hint: __( 'Leave blank for lifetime.', 'vulocart' ),
		},
		{
			key: 'renewal_type',
			label: __( 'Renewal', 'vulocart' ),
			kind: 'select',
			options: [
				{ label: __( 'Automatic', 'vulocart' ), value: 'auto' },
				{ label: __( 'Manual', 'vulocart' ), value: 'manual' },
			],
		},
	],
	booking: [
		{ key: 'slot_duration_minutes', label: __( 'Slot duration (minutes)', 'vulocart' ), kind: 'number' },
		{ key: 'max_attendees_per_slot', label: __( 'Max attendees per slot', 'vulocart' ), kind: 'number' },
	],
	rental: [
		{
			key: 'rental_period',
			label: __( 'Rental period', 'vulocart' ),
			kind: 'select',
			options: [
				{ label: __( 'Per hour', 'vulocart' ), value: 'hour' },
				{ label: __( 'Per day', 'vulocart' ), value: 'day' },
				{ label: __( 'Per week', 'vulocart' ), value: 'week' },
				{ label: __( 'Per month', 'vulocart' ), value: 'month' },
			],
		},
		{ key: 'deposit_amount', label: __( 'Deposit amount', 'vulocart' ), kind: 'number' },
		{ key: 'late_fee_per_day', label: __( 'Late fee per day', 'vulocart' ), kind: 'number' },
	],
	bundle: [
		{
			key: 'bundle_items',
			label: __( 'Bundle items', 'vulocart' ),
			kind: 'text',
			hint: __( 'Comma-separated offering ids included in this bundle.', 'vulocart' ),
		},
	],
	donation: [
		{
			key: 'suggested_amounts',
			label: __( 'Suggested amounts', 'vulocart' ),
			kind: 'text',
			hint: __( 'Comma-separated amounts, e.g. 10, 25, 50.', 'vulocart' ),
		},
		{ key: 'allow_custom_amount', label: __( 'Allow custom amount', 'vulocart' ), kind: 'checkbox' },
	],
	gift_card: [
		{
			key: 'denominations',
			label: __( 'Denominations', 'vulocart' ),
			kind: 'text',
			hint: __( 'Comma-separated amounts, e.g. 25, 50, 100.', 'vulocart' ),
		},
		{
			key: 'expiry_days',
			label: __( 'Expires after (days)', 'vulocart' ),
			kind: 'number',
			hint: __( 'Leave blank to never expire.', 'vulocart' ),
		},
	],
};

const TYPE_DETAILS_CARD_TITLE: Record< string, string > = {
	digital: __( 'Digital Delivery', 'vulocart' ),
	subscription: __( 'Subscription Details', 'vulocart' ),
	course: __( 'Course Details', 'vulocart' ),
	service: __( 'Service Details', 'vulocart' ),
	membership: __( 'Membership Details', 'vulocart' ),
	booking: __( 'Booking Details', 'vulocart' ),
	rental: __( 'Rental Details', 'vulocart' ),
	bundle: __( 'Bundle Details', 'vulocart' ),
	donation: __( 'Donation Details', 'vulocart' ),
	gift_card: __( 'Gift Card Details', 'vulocart' ),
};

interface MediaItem {
	id: number;
	url: string;
}

interface OfferingFormState {
	type: string;
	title: string;
	sku: string;
	price: string;
	currency: string;
	status: string;
	shortDescription: string;
	fullDescription: string;
	salePrice: string;
	stockManagement: boolean;
	stockStatus: string;
	weight: string;
	length: string;
	width: string;
	height: string;
	shippingClass: string;
	shippingPolicy: string;
	refundPolicy: string;
	cancellationPolicy: string;
	relatedOfferings: string;
	addonOfferings: string;
	featured: boolean;
	catalogVisibility: string;
	categories: string[];
	tags: string[];
	brand: string;
	collections: string[];
	featuredImage: MediaItem | null;
	gallery: MediaItem[];
	typeDetails: Record< string, string | boolean >;
}

const EMPTY_FORM: OfferingFormState = {
	type: 'physical',
	title: '',
	sku: '',
	price: '',
	currency: 'USD',
	status: 'draft',
	shortDescription: '',
	fullDescription: '',
	salePrice: '',
	stockManagement: false,
	stockStatus: 'in_stock',
	weight: '',
	length: '',
	width: '',
	height: '',
	shippingClass: '',
	shippingPolicy: '',
	refundPolicy: '',
	cancellationPolicy: '',
	relatedOfferings: '',
	addonOfferings: '',
	featured: false,
	catalogVisibility: 'shop_and_search',
	categories: [],
	tags: [],
	brand: '',
	collections: [],
	featuredImage: null,
	gallery: [],
	typeDetails: {},
};

interface OfferingEditProps {
	id: number | null;
}

/**
 * A dedicated full page for creating/editing one offering. Real,
 * bookmarkable URL (`admin.php?page=vulocart-offerings&action=edit&id=123`),
 * not a modal — same navigation model as this session's earlier Offerings/
 * Orders split (see Offerings.tsx's docblock).
 *
 * Deliberately kept to as few cards as the content allows, rather than one
 * card per WooCommerce/Shopify meta-box: left is a single "Offering Setup"
 * card (type + recommended checklist); center is "Offering Details" (name/
 * description/pricing/attributes), an optional per-type "Type Details"
 * card, an optional combined "Inventory & Shipping" card, and "Policies &
 * Related Offerings"; right is "Publishing", a combined "Organization"
 * card (category, tags, brand, collections — all real DB-backed taxonomy
 * terms, see Domain\Term\Taxonomy), and "Upload image". Subsections within a card
 * use a plain `<h4>` (`.vulocart-subsection-title`) rather than a new
 * `CardComponent`, so grouping related fields doesn't cost another box.
 *
 * Fields beyond title/type/sku/price/currency/status (Domain\Offering\Offering's
 * real columns) are stored in the Offering's existing generic `meta` JSON
 * column — no schema migration needed, same "extensible, type-specific
 * attributes" role `meta` already has for Cart/Order.
 *
 * The form is genuinely dynamic per offering type (this plugin's admin-UX
 * brief's 11-type list — Physical/Digital/Subscription/Course/Service/
 * Membership/Booking/Rental/Bundle/Donation/Gift Card): "Inventory &
 * Shipping" only renders for types that actually track stock or ship a
 * package (STOCK_TRACKED_TYPES/SHIPPABLE_TYPES below, each gating its own
 * subsection independently), and every non-physical type gets its own
 * "Type Details" card driven by TYPE_FIELD_CONFIG — e.g. a Subscription
 * shows billing interval/trial period, a Course shows lesson count/skill
 * level, a Gift Card shows denominations/expiry. Delivery nature (physical/
 * downloadable/digital_service/other) is derived straight from `type`
 * (TYPE_TO_DELIVERY_METHOD) rather than a separate manual picker.
 *
 * One thing is deliberately NOT built as a fully real feature here:
 * "Related offerings"/"Offer as an add-on" (stored as simple comma-separated id
 * lists in meta, since there's no offering-picker/search component yet —
 * real storage, simplified input). "Attributes & Variations" *is* real —
 * `vulocart_offering_variants_section` (a narrower cousin of
 * `vulocart_offering_edit_sections`, replacing this specific subsection's
 * content in place rather than appending elsewhere) lets vulocart-pro's
 * Variants module render a real matrix editor there; the inert
 * "not supported yet" button/notice below is only what free-tier users
 * without that module active still see.
 *
 * `vulocart_offering_edit_sections` — a `@wordpress/hooks` filter applied
 * at the end of the center column, alongside this page's own cards
 * ("Offering Details", "Policies & Related Offerings", ...) — so a Pro
 * module's card renders as one more meta box in the same grid, not a
 * separate block bolted on elsewhere. Same "Pro extends Free via filters"
 * pattern `vulocart_offering_row_actions` already establishes on
 * OfferingsList.tsx, just for the edit page instead of the list. Only
 * fires once the offering has a real id (`isEditMode`) — there's nothing
 * for a Pro section to attach to before the offering itself has been
 * saved once.
 * `vulocart-pro`'s Passport module is the first (only) registrant today.
 */
export function OfferingEdit( { id }: OfferingEditProps ) {
	const isEditMode = null !== id;

	const [ formData, setFormData ] = useState< OfferingFormState >( EMPTY_FORM );
	const [ isLoadingInitial, setIsLoadingInitial ] = useState( isEditMode );
	const [ notFound, setNotFound ] = useState( false );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ savedNotice, setSavedNotice ] = useState( false );
	const [ createdAt, setCreatedAt ] = useState< string | null >( null );
	const [ showVariantsNotice, setShowVariantsNotice ] = useState( false );
	const [ categoryOptions, setCategoryOptions ] = useState< { key: string; value: string; label: string }[] >( [] );
	const [ tagOptions, setTagOptions ] = useState< { key: string; value: string; label: string }[] >( [] );
	const [ brandOptions, setBrandOptions ] = useState< { label: string; value: string }[] >( [] );
	const [ collectionOptions, setCollectionOptions ] = useState< { key: string; value: string; label: string }[] >( [] );

	const update = ( patch: Partial< OfferingFormState > ) =>
		setFormData( ( prev ) => ( { ...prev, ...patch } ) );

	useEffect( () => {
		axios
			.get< CategoryTerm[] >( getApiLink( vulocartLocalizer, 'categories' ), {
				headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
			} )
			.then( ( response ) => setCategoryOptions( formatCategoryOptions( response.data ) ) );

		// Tags/Collections are flat (Domain\Term\Taxonomy's own docblock —
		// hierarchy only applies to Category), so formatCategoryOptions()
		// degenerates correctly here too: every term has parent_id null,
		// so it's just a flat, unindented option list.
		axios
			.get< CategoryTerm[] >( getApiLink( vulocartLocalizer, 'tags' ), {
				headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
			} )
			.then( ( response ) => setTagOptions( formatCategoryOptions( response.data ) ) );

		axios
			.get< CategoryTerm[] >( getApiLink( vulocartLocalizer, 'collections' ), {
				headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
			} )
			.then( ( response ) => setCollectionOptions( formatCategoryOptions( response.data ) ) );

		axios
			.get< CategoryTerm[] >( getApiLink( vulocartLocalizer, 'brands' ), {
				headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
			} )
			.then( ( response ) =>
				setBrandOptions( response.data.map( ( term ) => ( { label: term.name, value: term.slug } ) ) )
			);
	}, [] );

	useEffect( () => {
		if ( ! isEditMode ) {
			return;
		}

		axios
			.get( getApiLink( vulocartLocalizer, `offerings/${ id }` ), {
				headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
			} )
			.then( ( response ) => {
				const offering = response.data;
				const meta = offering.meta || {};

				setFormData( {
					type: offering.type || 'physical',
					title: offering.title || '',
					sku: offering.sku || '',
					price: offering.price !== null && offering.price !== undefined ? String( offering.price ) : '',
					currency: offering.currency || 'USD',
					status: offering.status || 'draft',
					shortDescription: meta.short_description || '',
					fullDescription: meta.full_description || '',
					salePrice: meta.sale_price !== null && meta.sale_price !== undefined ? String( meta.sale_price ) : '',
					stockManagement: !! meta.stock_management,
					stockStatus: meta.stock_status || 'in_stock',
					weight: meta.weight || '',
					length: meta.length || '',
					width: meta.width || '',
					height: meta.height || '',
					shippingClass: meta.shipping_class || '',
					shippingPolicy: meta.shipping_policy || '',
					refundPolicy: meta.refund_policy || '',
					cancellationPolicy: meta.cancellation_policy || '',
					relatedOfferings: meta.related_offerings || '',
					addonOfferings: meta.addon_offerings || '',
					featured: !! meta.featured,
					catalogVisibility: meta.catalog_visibility || 'shop_and_search',
					categories: Array.isArray( meta.categories ) ? meta.categories : [],
					tags: Array.isArray( meta.tags ) ? meta.tags : [],
					brand: meta.brand || '',
					collections: Array.isArray( meta.collections ) ? meta.collections : [],
					featuredImage: meta.featured_image || null,
					gallery: Array.isArray( meta.gallery ) ? meta.gallery : [],
					typeDetails:
						meta.type_details && 'object' === typeof meta.type_details ? meta.type_details : {},
				} );
				setCreatedAt( offering.created_at );
				setIsLoadingInitial( false );
			} )
			.catch( () => {
				setNotFound( true );
				setIsLoadingInitial( false );
			} );
		// eslint-disable-next-line react-hooks/exhaustive-deps -- id is fixed for this page's lifetime (a new id means a new page load, not a re-render).
	}, [] );

	const recommendedChecklist = useMemo( () => {
		const items = [
			{
				key: 'title',
				label: __( 'Offering Name', 'vulocart' ),
				desc: __( 'A clear, descriptive title that helps customers find your offering', 'vulocart' ),
				done: !! formData.title,
			},
			{
				key: 'price',
				label: __( 'Price', 'vulocart' ),
				desc: __( 'Set competitive prices including any sale or discount options', 'vulocart' ),
				done: !! formData.price,
			},
		];

		// Stock only makes sense for types STOCK_TRACKED_TYPES actually
		// tracks — the checklist (and its X/N denominator) reflects that,
		// same "dynamic per type" principle the form fields themselves follow.
		if ( STOCK_TRACKED_TYPES.has( formData.type ) ) {
			items.push( {
				key: 'stock',
				label: __( 'Stock', 'vulocart' ),
				desc: __( 'Track your available quantity and let customers know what is in stock', 'vulocart' ),
				done: formData.stockManagement,
			} );
		}

		items.push(
			{
				key: 'images',
				label: __( 'Offering Images', 'vulocart' ),
				desc: __( 'High-quality photos showing your offering from multiple angles', 'vulocart' ),
				done: !! formData.featuredImage,
			},
			{
				key: 'category',
				label: __( 'Category', 'vulocart' ),
				desc: __( 'Organize your offering to help customers browse your store', 'vulocart' ),
				done: formData.categories.length > 0,
			},
			{
				key: 'policies',
				label: __( 'Policies', 'vulocart' ),
				desc: __( 'Being upfront about shipping, returns, and cancellations builds trust', 'vulocart' ),
				done: !! ( formData.shippingPolicy || formData.refundPolicy || formData.cancellationPolicy ),
			}
		);

		return items;
	}, [ formData ] );

	const doneCount = recommendedChecklist.filter( ( item ) => item.done ).length;

	/**
	 * `vulocart_offering_variants_section` — a narrower filter than
	 * `vulocart_offering_edit_sections` (which only ever appends at the
	 * end of the center column): this one replaces the "Attributes &
	 * Variations" subsection's own inert button/notice in place, so a Pro
	 * module like vulocart-pro's Variants can render a real matrix editor
	 * exactly where that notice used to live rather than as a
	 * disconnected extra card. Null (no registrant, or add-mode with no
	 * id yet) falls back to the existing inert notice — same
	 * "no Pro module means render nothing" default every filter in this
	 * file already has.
	 */
	const variantsSection =
		null !== id ? applyFilters( 'vulocart_offering_variants_section', null, { id, type: formData.type } ) : null;

	const buildMetaPayload = () => ( {
		short_description: formData.shortDescription || undefined,
		full_description: formData.fullDescription || undefined,
		sale_price: formData.salePrice ? Number( formData.salePrice ) : null,
		stock_management: formData.stockManagement,
		stock_status: formData.stockStatus,
		delivery_method: TYPE_TO_DELIVERY_METHOD[ formData.type ] || 'other',
		weight: formData.weight || undefined,
		length: formData.length || undefined,
		width: formData.width || undefined,
		height: formData.height || undefined,
		shipping_class: formData.shippingClass || undefined,
		shipping_policy: formData.shippingPolicy || undefined,
		refund_policy: formData.refundPolicy || undefined,
		cancellation_policy: formData.cancellationPolicy || undefined,
		related_offerings: formData.relatedOfferings || undefined,
		addon_offerings: formData.addonOfferings || undefined,
		featured: formData.featured,
		catalog_visibility: formData.catalogVisibility,
		categories: formData.categories,
		tags: formData.tags,
		brand: formData.brand || null,
		collections: formData.collections,
		featured_image: formData.featuredImage,
		gallery: formData.gallery,
		type_details: formData.typeDetails,
	} );

	const handleSave = () => {
		if ( ! formData.title ) {
			return;
		}

		setIsSaving( true );
		setSavedNotice( false );

		const payload = {
			type: formData.type,
			title: formData.title,
			status: formData.status,
			sku: formData.sku || undefined,
			price: formData.price ? Number( formData.price ) : undefined,
			currency: formData.price ? formData.currency : undefined,
			meta: buildMetaPayload(),
		};

		const request = isEditMode
			? axios.patch( getApiLink( vulocartLocalizer, `offerings/${ id }` ), payload, {
					headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
			  } )
			: axios.post( getApiLink( vulocartLocalizer, 'offerings' ), payload, {
					headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
			  } );

		request
			.then( ( response ) => {
				if ( isEditMode ) {
					setIsSaving( false );
					setSavedNotice( true );
				} else {
					window.location.href = `admin.php?page=vulocart-offerings&action=edit&id=${ response.data.id }`;
				}
			} )
			.catch( () => {
				setIsSaving( false );
			} );
	};

	const updateTypeDetail = ( key: string, value: string | boolean ) =>
		update( { typeDetails: { ...formData.typeDetails, [ key ]: value } } );

	/**
	 * Renders one TYPE_FIELD_CONFIG entry as the right zyra input for its
	 * `kind` — a single small switch rather than one-off JSX per type, so
	 * adding a 12th type's fields later is a config entry, not new markup.
	 */
	const renderTypeDetailField = ( field: TypeDetailField ) => {
		const rawValue = formData.typeDetails[ field.key ];

		if ( 'checkbox' === field.kind ) {
			return (
				<MultiCheckboxInput
					value={ rawValue ? [ 'on' ] : [] }
					look="toggle"
					modules={ [] }
					options={ [ { key: 'on', value: 'on' } ] }
					onChange={ ( val ) => updateTypeDetail( field.key, val.includes( 'on' ) ) }
				/>
			);
		}

		if ( 'select' === field.kind ) {
			return (
				<SelectInput
					name={ field.key }
					type="single-select"
					options={ field.options || [] }
					value={ ( rawValue as string ) || '' }
					onChange={ ( value ) => updateTypeDetail( field.key, value as string ) }
				/>
			);
		}

		return (
			<TextInput
				type={ 'number' === field.kind ? 'number' : 'text' }
				name={ field.key }
				value={ ( rawValue as string ) ?? '' }
				onChange={ ( value ) => updateTypeDetail( field.key, String( value ) ) }
			/>
		);
	};

	if ( isLoadingInitial ) {
		return <p className="vulocart-offering-loading">{ __( 'Loading…', 'vulocart' ) }</p>;
	}

	if ( notFound ) {
		return (
			<div className="vulocart-offering-edit-page">
				<a className="vulocart-back-link" href="admin.php?page=vulocart-offerings">
					{ __( '← Back to Offerings', 'vulocart' ) }
				</a>
				<p>{ __( 'No offering exists with this id.', 'vulocart' ) }</p>
			</div>
		);
	}

	return (
		<div className="vulocart-offering-edit-page">
			<div className="vulocart-offering-edit-topbar">
				<div>
					<a className="vulocart-back-link" href="admin.php?page=vulocart-offerings">
						{ __( '← Back to Offerings', 'vulocart' ) }
					</a>
					<h1 className="vulocart-edit-page-title">
						{ isEditMode ? __( 'Edit Offering', 'vulocart' ) : __( 'Add Offering', 'vulocart' ) }
					</h1>
					<p className="vulocart-offering-edit-subtitle">
						{ __( 'Enter your offering details - name, price, stock, and image & publish.', 'vulocart' ) }
					</p>
				</div>

				<ButtonInput
					buttons={ [
						{
							icon: 'save',
							text: isSaving
								? __( 'Saving…', 'vulocart' )
								: isEditMode
								? __( 'Update', 'vulocart' )
								: __( 'Save', 'vulocart' ),
							onClick: handleSave,
							disabled: isSaving || ! formData.title,
						},
					] }
				/>
			</div>

			{
				/**
				 * `vulocart_offering_add_prefill` — only in add mode
				 * (`!isEditMode`): there's no offering id yet for
				 * `vulocart_offering_edit_sections` to attach to (that
				 * filter's own docblock explains why it's edit-mode-only),
				 * but a Pro module like vulocart-pro's Offering Templates
				 * still needs a hook to prefill `formData` before the
				 * first save. Hands the registrant `type` (so it can only
				 * offer templates matching the chosen offering type) and
				 * `applyPrefill` — a direct pass-through to this
				 * component's own `update()` — rather than a `data`/`onPick`
				 * pair, so a template only ever changes fields it actually
				 * has a value for.
				 */
				! isEditMode &&
					applyFilters( 'vulocart_offering_add_prefill', null, {
						type: formData.type,
						applyPrefill: update,
					} )
			}

			{ savedNotice && (
				<div className="vulocart-saved-notice">{ __( 'Offering updated.', 'vulocart' ) }</div>
			) }

			<div className="vulocart-offering-edit-grid">
				{ /* Left column */ }
				<div className="vulocart-offering-edit-col vulocart-offering-edit-col--left">
					<CardComponent
						title={ __( 'Offering Setup', 'vulocart' ) }
						desc={ __( 'Choose the type that best describes what you are selling.', 'vulocart' ) }
					>
						<SelectInput
							name="type"
							type="single-select"
							options={ OFFERING_TYPE_OPTIONS }
							value={ formData.type }
							onChange={ ( value ) => update( { type: value as string } ) }
						/>

						<h4 className="vulocart-subsection-title">
							{ `${ __( 'Recommended', 'vulocart' ) } ${ doneCount }/${ recommendedChecklist.length }` }
						</h4>
						<ul className="vulocart-recommended-checklist">
							{ recommendedChecklist.map( ( item ) => (
								<li key={ item.key } className={ item.done ? 'is-done' : '' }>
									<i className={ `adminfont-${ item.done ? 'check' : 'radio' }` } />
									<div>
										<strong>{ item.label }</strong>
										<p>{ item.desc }</p>
									</div>
								</li>
							) ) }
						</ul>
					</CardComponent>
				</div>

				{ /* Center column */ }
				<div className="vulocart-offering-edit-col vulocart-offering-edit-col--center">
					<CardComponent
						title={ __( 'Offering Details', 'vulocart' ) }
						desc={ __( 'Tell customers what you are selling and what it costs.', 'vulocart' ) }
					>
						<FormGroupWrapperComponent>
							<FormGroupComponent label={ __( 'Offering name', 'vulocart' ) } htmlFor="vulocart-offering-title">
								<TextInput
									name="title"
									value={ formData.title }
									onChange={ ( value ) => update( { title: value as string } ) }
								/>
							</FormGroupComponent>

							<FormGroupComponent
								label={ __( 'Short description - One-line summary', 'vulocart' ) }
								htmlFor="vulocart-offering-short-desc"
							>
								<TextAreaInput
									name="shortDescription"
									rowNumber={ 2 }
									value={ formData.shortDescription }
									onChange={ ( value ) => update( { shortDescription: value } ) }
								/>
							</FormGroupComponent>

							<FormGroupComponent label={ __( 'Full description', 'vulocart' ) } htmlFor="vulocart-offering-full-desc">
								<TextAreaInput
									name="fullDescription"
									rowNumber={ 4 }
									value={ formData.fullDescription }
									onChange={ ( value ) => update( { fullDescription: value } ) }
								/>
							</FormGroupComponent>
						</FormGroupWrapperComponent>

						<div className="vulocart-two-col-fields">
							<FormGroupComponent label={ __( 'Regular price', 'vulocart' ) } htmlFor="vulocart-offering-price">
								<TextInput
									type="number"
									name="price"
									value={ formData.price }
									onChange={ ( value ) => update( { price: String( value ) } ) }
								/>
							</FormGroupComponent>
							<FormGroupComponent label={ __( 'Sale price', 'vulocart' ) } htmlFor="vulocart-offering-sale-price">
								<TextInput
									type="number"
									name="salePrice"
									value={ formData.salePrice }
									onChange={ ( value ) => update( { salePrice: String( value ) } ) }
								/>
							</FormGroupComponent>
						</div>

						<h4 className="vulocart-subsection-title">{ __( 'Attributes & Variations', 'vulocart' ) }</h4>
						{ variantsSection || (
							<>
								<ButtonInput
									buttons={ [
										{
											icon: 'plus',
											text: __( 'Add variants Like size or color', 'vulocart' ),
											onClick: () => setShowVariantsNotice( true ),
										},
									] }
								/>
								{ showVariantsNotice && (
									<p className="vulocart-field-hint vulocart-variants-notice">
										{ __(
											'Offering variants are not supported yet — this is planned for a future update.',
											'vulocart'
										) }
									</p>
								) }
							</>
						) }
					</CardComponent>

					{ TYPE_FIELD_CONFIG[ formData.type ] && TYPE_FIELD_CONFIG[ formData.type ].length > 0 && (
						<CardComponent
							title={ TYPE_DETAILS_CARD_TITLE[ formData.type ] || __( 'Type Details', 'vulocart' ) }
							desc={ __( 'Fields specific to this offering type.', 'vulocart' ) }
						>
							<FormGroupWrapperComponent>
								{ TYPE_FIELD_CONFIG[ formData.type ].map( ( field ) => (
									<FormGroupComponent
										key={ field.key }
										label={ field.label }
										htmlFor={ `vulocart-offering-${ field.key }` }
									>
										{ renderTypeDetailField( field ) }
										{ field.hint && <p className="vulocart-field-hint">{ field.hint }</p> }
									</FormGroupComponent>
								) ) }
							</FormGroupWrapperComponent>
						</CardComponent>
					) }

					{ ( STOCK_TRACKED_TYPES.has( formData.type ) || SHIPPABLE_TYPES.has( formData.type ) ) && (
						<CardComponent
							title={ __( 'Inventory & Shipping', 'vulocart' ) }
							action={
								STOCK_TRACKED_TYPES.has( formData.type ) ? (
									<div className="vulocart-stock-toggle">
										{ __( 'Stock management', 'vulocart' ) }
										<MultiCheckboxInput
											value={ formData.stockManagement ? [ 'on' ] : [] }
											look="toggle"
											modules={ [] }
											options={ [ { key: 'on', value: 'on' } ] }
											onChange={ ( val ) => update( { stockManagement: val.includes( 'on' ) } ) }
										/>
									</div>
								) : undefined
							}
						>
							{ STOCK_TRACKED_TYPES.has( formData.type ) && (
								<div className="vulocart-two-col-fields">
									<FormGroupComponent label={ __( 'SKU', 'vulocart' ) } htmlFor="vulocart-offering-sku">
										<TextInput
											name="sku"
											value={ formData.sku }
											onChange={ ( value ) => update( { sku: value as string } ) }
										/>
									</FormGroupComponent>
									<FormGroupComponent label={ __( 'Stock Status', 'vulocart' ) } htmlFor="vulocart-offering-stock-status">
										<SelectInput
											name="stockStatus"
											type="single-select"
											options={ STOCK_STATUS_OPTIONS }
											value={ formData.stockStatus }
											onChange={ ( value ) => update( { stockStatus: value as string } ) }
										/>
									</FormGroupComponent>
								</div>
							) }

							{ SHIPPABLE_TYPES.has( formData.type ) && (
								<>
									<h4 className="vulocart-subsection-title">{ __( 'Package dimensions & weight', 'vulocart' ) }</h4>
									<div className="vulocart-two-col-fields">
										<FormGroupComponent label={ __( 'Weight (kg)', 'vulocart' ) } htmlFor="vulocart-offering-weight">
											<TextInput
												name="weight"
												value={ formData.weight }
												onChange={ ( value ) => update( { weight: value as string } ) }
											/>
										</FormGroupComponent>
										<FormGroupComponent
											label={ __( 'Shipping classes', 'vulocart' ) }
											htmlFor="vulocart-offering-shipping-class"
										>
											<SelectInput
												name="shippingClass"
												type="single-select"
												options={ SHIPPING_CLASS_OPTIONS }
												value={ formData.shippingClass }
												onChange={ ( value ) => update( { shippingClass: value as string } ) }
											/>
										</FormGroupComponent>
									</div>

									<div className="vulocart-three-col-fields">
										<FormGroupComponent label={ __( 'Length (in)', 'vulocart' ) } htmlFor="vulocart-offering-length">
											<TextInput
												name="length"
												value={ formData.length }
												onChange={ ( value ) => update( { length: value as string } ) }
											/>
										</FormGroupComponent>
										<FormGroupComponent label={ __( 'Width (in)', 'vulocart' ) } htmlFor="vulocart-offering-width">
											<TextInput
												name="width"
												value={ formData.width }
												onChange={ ( value ) => update( { width: value as string } ) }
											/>
										</FormGroupComponent>
										<FormGroupComponent label={ __( 'Height (in)', 'vulocart' ) } htmlFor="vulocart-offering-height">
											<TextInput
												name="height"
												value={ formData.height }
												onChange={ ( value ) => update( { height: value as string } ) }
											/>
										</FormGroupComponent>
									</div>
								</>
							) }
						</CardComponent>
					) }

					<CardComponent
						title={ __( 'Policies & Related Offerings', 'vulocart' ) }
						desc={ __( 'Set expectations up front and help customers discover more of what you sell.', 'vulocart' ) }
					>
						<FormGroupWrapperComponent>
							<FormGroupComponent
								label={ __( 'Shipping policy - How will you ship it and how long will it take?', 'vulocart' ) }
								htmlFor="vulocart-offering-shipping-policy"
							>
								<TextAreaInput
									name="shippingPolicy"
									rowNumber={ 2 }
									value={ formData.shippingPolicy }
									onChange={ ( value ) => update( { shippingPolicy: value } ) }
								/>
							</FormGroupComponent>

							<FormGroupComponent
								label={ __( 'Refund policy - Can customers return or exchange it?', 'vulocart' ) }
								htmlFor="vulocart-offering-refund-policy"
							>
								<TextAreaInput
									name="refundPolicy"
									rowNumber={ 2 }
									value={ formData.refundPolicy }
									onChange={ ( value ) => update( { refundPolicy: value } ) }
								/>
							</FormGroupComponent>

							<FormGroupComponent
								label={ __( 'Cancellation policy - Can they cancel their order after placing it?', 'vulocart' ) }
								htmlFor="vulocart-offering-cancellation-policy"
							>
								<TextAreaInput
									name="cancellationPolicy"
									rowNumber={ 2 }
									value={ formData.cancellationPolicy }
									onChange={ ( value ) => update( { cancellationPolicy: value } ) }
								/>
							</FormGroupComponent>
						</FormGroupWrapperComponent>

						<div className="vulocart-two-col-fields">
							<FormGroupComponent
								label={ __( 'Recommend alongside this offering', 'vulocart' ) }
								htmlFor="vulocart-offering-related"
							>
								<TextInput
									name="relatedOfferings"
									value={ formData.relatedOfferings }
									onChange={ ( value ) => update( { relatedOfferings: value as string } ) }
								/>
								<p className="vulocart-field-hint">
									{ __( '"You might also like". Comma-separated offering ids.', 'vulocart' ) }
								</p>
							</FormGroupComponent>
							<FormGroupComponent
								label={ __( 'Offer as an add-on at checkout', 'vulocart' ) }
								htmlFor="vulocart-offering-addon"
							>
								<TextInput
									name="addonOfferings"
									value={ formData.addonOfferings }
									onChange={ ( value ) => update( { addonOfferings: value as string } ) }
								/>
								<p className="vulocart-field-hint">
									{ __( 'Suggested at cart. Comma-separated offering ids.', 'vulocart' ) }
								</p>
							</FormGroupComponent>
						</div>
					</CardComponent>

					{ null !== id && applyFilters( 'vulocart_offering_edit_sections', null, { id, type: formData.type } ) }
				</div>

				{ /* Right column */ }
				<div className="vulocart-offering-edit-col vulocart-offering-edit-col--right">
					<CardComponent
						title={ __( 'Publishing', 'vulocart' ) }
						action={
							<button
								type="button"
								className={ `vulocart-featured-star${ formData.featured ? ' is-featured' : '' }` }
								aria-label={ __( 'Featured offering', 'vulocart' ) }
								onClick={ () => update( { featured: ! formData.featured } ) }
							>
								<i className={ `adminfont-${ formData.featured ? 'star' : 'star-o' }` } />
							</button>
						}
					>
						<div className="vulocart-publishing-row">
							<span>{ __( 'Catalog Visibility', 'vulocart' ) }</span>
							<SelectInput
								name="catalogVisibility"
								type="single-select"
								options={ CATALOG_VISIBILITY_OPTIONS }
								value={ formData.catalogVisibility }
								onChange={ ( value ) => update( { catalogVisibility: value as string } ) }
							/>
						</div>
						<div className="vulocart-publishing-row">
							<span>{ __( 'Offering Status', 'vulocart' ) }</span>
							<SelectInput
								name="status"
								type="single-select"
								options={ OFFERING_STATUS_OPTIONS }
								value={ formData.status }
								onChange={ ( value ) => update( { status: value as string } ) }
							/>
						</div>
						{ createdAt && (
							<div className="vulocart-publishing-row">
								<span>{ __( 'Cataloged at', 'vulocart' ) }</span>
								<span>{ createdAt }</span>
							</div>
						) }
					</CardComponent>

					<CardComponent
						title={ __( 'Organization', 'vulocart' ) }
						desc={ __( 'Where this offering appears in your store, and how it\'s tagged.', 'vulocart' ) }
					>
						<h4 className="vulocart-subsection-title">{ __( 'Category', 'vulocart' ) }</h4>
						{ categoryOptions.length === 0 ? (
							<p className="vulocart-empty-categories-notice">
								{ __( 'No categories yet — add some from Offerings → Categories.', 'vulocart' ) }
							</p>
						) : (
							<MultiCheckboxInput
								value={ formData.categories }
								modules={ [] }
								options={ categoryOptions }
								inputInnerWrapperClass="vulocart-category-checklist"
								onChange={ ( values ) => update( { categories: values } ) }
							/>
						) }

						<h4 className="vulocart-subsection-title">{ __( 'Tags', 'vulocart' ) }</h4>
						{ tagOptions.length === 0 ? (
							<p className="vulocart-empty-categories-notice">
								{ __( 'No tags yet — add some from Offerings → Tags.', 'vulocart' ) }
							</p>
						) : (
							<MultiCheckboxInput
								value={ formData.tags }
								modules={ [] }
								options={ tagOptions }
								inputInnerWrapperClass="vulocart-category-checklist"
								onChange={ ( values ) => update( { tags: values } ) }
							/>
						) }

						<h4 className="vulocart-subsection-title">{ __( 'Brand', 'vulocart' ) }</h4>
						<SelectInput
							name="brand"
							type="single-select"
							options={ [ { label: __( 'None', 'vulocart' ), value: '' }, ...brandOptions ] }
							value={ formData.brand }
							onChange={ ( value ) => update( { brand: value as string } ) }
						/>

						<h4 className="vulocart-subsection-title">{ __( 'Collections', 'vulocart' ) }</h4>
						{ collectionOptions.length === 0 ? (
							<p className="vulocart-empty-categories-notice">
								{ __( 'No collections yet — add some from Offerings → Collections.', 'vulocart' ) }
							</p>
						) : (
							<MultiCheckboxInput
								value={ formData.collections }
								modules={ [] }
								options={ collectionOptions }
								inputInnerWrapperClass="vulocart-category-checklist"
								onChange={ ( values ) => update( { collections: values } ) }
							/>
						) }
					</CardComponent>

					<CardComponent title={ __( 'Upload image', 'vulocart' ) }>
						<h4 className="vulocart-subsection-title">{ __( 'Featured Image', 'vulocart' ) }</h4>
						<FileInput
							name="featuredImage"
							accept=".jpg,.jpeg,.png,.gif,.webp"
							imageSrc={ formData.featuredImage?.url || '' }
							imageWidth={ 120 }
							imageHeight={ 120 }
							openUploader={ __( 'Select Featured Image', 'vulocart' ) }
							onChange={ ( value ) => {
								const file = Array.isArray( value ) ? value[ 0 ] : value;
								update( { featuredImage: file && file.url ? { id: file.id || 0, url: file.url } : null } );
							} }
						/>

						<h4 className="vulocart-subsection-title">{ __( 'Offering gallery', 'vulocart' ) }</h4>
						<FileInput
							name="gallery"
							multiple
							accept=".jpg,.jpeg,.png,.gif,.webp"
							imageSrc={ formData.gallery.map( ( item ) => item.url ) }
							imageWidth={ 90 }
							imageHeight={ 90 }
							openUploader={ __( 'Add Gallery Image', 'vulocart' ) }
							onChange={ ( value ) => {
								const files = Array.isArray( value ) ? value : [ value ];
								update( {
									gallery: files
										.filter( ( file ) => file && file.url )
										.map( ( file ) => ( { id: file.id || 0, url: file.url } ) ),
								} );
							} }
						/>
					</CardComponent>
				</div>
			</div>
		</div>
	);
}

export default OfferingEdit;
