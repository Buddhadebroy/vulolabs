/* global vulocartLocalizer */
import { useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { formatWpDateTime } from '../../services/formatWpDate';
import { PriceList } from './PriceList';
import { ContentBlock, FaqEditor, SeoFields, SpecsEditor, TranslationsEditor } from './ContentFields';
import type { FaqRow, SpecRow, Translation } from './ContentFields';
import { TermPicker } from './TermPicker';
import type { TermOption } from './TermPicker';
import { defaultPrice, getPriceTypes, newPriceId, toEditablePrices, toPayloadPrice, priceProblem } from './prices';
import type { EditablePrice } from './prices';
import type { ReactNode } from 'react';
import axios from 'axios';
import { getApiLink } from '@zyra/core';
import { showErrorToast, errorMessageOf } from '../../lib/rest-errors';
import { CardComponent, FormGroupWrapperComponent, FormGroupComponent } from '@zyra/components';
import { TextInput, TextAreaInput, SelectInput, ButtonInput, MultiCheckboxInput, FileInput } from '@zyra/inputs';
import { EmbedCodeSection } from './EmbedCodeSection';
import { HeaderPicker } from './HeaderPicker';
import { TypeChooser } from './TypeChooser';
import { PRODUCT_TYPE_OPTIONS, TYPE_PROFILES, cardsFor, fieldsFor, profileFor, subtypeFor, type TypeDetailField } from './typeProfiles';
import './products-page.scss';

const PRODUCT_STATUS_OPTIONS = [
	{ label: __( 'Draft', 'vulocart' ), value: 'draft' },
	{ label: __( 'Published', 'vulocart' ), value: 'published' },
	{ label: __( 'Archived', 'vulocart' ), value: 'archived' },
];

/** Keeps a typed value numeric: digits only (`integer`) or digits with a single decimal point. Never negative. */
function sanitizeNumber( value: unknown, integer = false ): string {
	const cleaned = String( value ?? '' ).replace( integer ? /[^0-9]/g : /[^0-9.]/g, '' );

	if ( integer ) {
		return cleaned;
	}

	const [ whole, ...rest ] = cleaned.split( '.' );

	return rest.length ? `${ whole }.${ rest.join( '' ) }` : whole;
}

const STOCK_STATUS_OPTIONS = [
	{ label: __( 'In stock', 'vulocart' ), value: 'in_stock' },
	{ label: __( 'Out of stock', 'vulocart' ), value: 'out_of_stock' },
	{ label: __( 'Available on backorder', 'vulocart' ), value: 'backorder' },
];

const SHIPPING_CLASS_OPTIONS = [
	{ label: __( 'Standard', 'vulocart' ), value: 'standard' },
	{ label: __( 'Fragile', 'vulocart' ), value: 'fragile' },
	{ label: __( 'Oversized', 'vulocart' ), value: 'oversized' },
	{ label: __( 'Free shipping', 'vulocart' ), value: 'free_shipping' },
];

const CURRENCY_OPTIONS = [ 'USD', 'EUR', 'GBP', 'INR', 'AUD', 'CAD', 'JPY', 'CNY', 'CHF', 'SGD', 'AED', 'BRL', 'MXN', 'ZAR', 'SEK', 'NOK', 'DKK', 'NZD' ].map(
	( code ) => ( { label: code, value: code } )
);

interface CategoryTerm {
	id: number;
	name: string;
	slug: string;
	parent_id: number | null;
}

/**
 * Real, DB-backed categories now (`GET /categories`,
 * classes/RestAPI/Controllers/Terms.php) - managed from the Products
 * menu's own "Categories" page (`src/pages/Terms/TermsPage.tsx`), no
 * longer a hardcoded list. Selections persist in `meta.categories` by
 * slug (Controllers/Products.php's `sanitize_product_meta()`), unchanged;
 * `formatCategoryOptions()` re-derives the "- " child-indentation
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

	const options: { key: string; value: string; label: string; id: number; depth: number }[] = [];

	const appendChildren = ( parentId: number | null, depth: number ) => {
		( byParent.get( parentId ) ?? [] ).forEach( ( term ) => {
			options.push( {
				key: term.slug,
				value: term.slug,
				id: term.id,
				depth,
				label: depth > 0 ? `${ '- '.repeat( depth ) }${ term.name }` : term.name,
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
 * 4-card section) - `type` already encodes physical vs. digital vs.
 * service, so asking the merchant to pick delivery *again* would just be
 * redundant. Still persisted to `meta.delivery_method`
 * (Controllers/Products.php's `sanitize_product_meta()`) for any future
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
 * Types whose amounts are a list the customer picks from. They are not separate fields: each amount is one price in
 * the Pricing card, so the storefront's price picker shows them with no extra code.
 */
const PRICE_LIST_HINTS: Record< string, string > = {
	gift_card: __( 'Add one price per denomination - for example $25, $50 and $100.', 'vulocart' ),
	donation: __( 'Add one price per suggested amount - for example $10, $25 and $50.', 'vulocart' ),
	membership: __( 'For a recurring membership, add a Subscription price (Pro). The access length below applies to every price.', 'vulocart' ),
	rental: __( 'Add one price per rental period if the rate differs - for example per day and per week.', 'vulocart' ),
};

interface MediaItem {
	id: number;
	url: string;
}

interface ProductFormState {
	type: string;
	subtype: string;
	title: string;
	sku: string;
	price: string;
	currency: string;
	status: string;
	shortDescription: string;
	fullDescription: string;
	salePrice: string;
	prices: EditablePrice[];
	stockManagement: boolean;
	stockQuantity: string;
	stockStatus: string;
	weight: string;
	length: string;
	width: string;
	height: string;
	shippingClass: string;
	shippingPolicy: string;
	refundPolicy: string;
	cancellationPolicy: string;
	relatedProducts: string;
	addonProducts: string;
	featured: boolean;
	catalogVisibility: string;
	categories: string[];
	tags: string[];
	brand: string;
	collections: string[];
	featuredImage: MediaItem | null;
	gallery: MediaItem[];
	typeDetails: Record< string, string | boolean >;
	seoTitle: string;
	seoDescription: string;
	specifications: SpecRow[];
	faqs: FaqRow[];
	translations: Record< string, Translation >;
	/** Kept as stored and sent back unchanged (written by AI; no editor field of its own). */
	pricingSuggestion: Record< string, unknown > | null;
	inventoryPrediction: Record< string, unknown > | null;
}

const EMPTY_FORM: ProductFormState = {
	subtype: '',
	type: 'physical',
	title: '',
	sku: '',
	price: '',
	currency: 'USD',
	status: 'draft',
	shortDescription: '',
	fullDescription: '',
	salePrice: '',
	prices: toEditablePrices( null, '', '' ),
	stockManagement: false,
	stockQuantity: '',
	stockStatus: 'in_stock',
	weight: '',
	length: '',
	width: '',
	height: '',
	shippingClass: '',
	shippingPolicy: '',
	refundPolicy: '',
	cancellationPolicy: '',
	relatedProducts: '',
	addonProducts: '',
	featured: false,
	catalogVisibility: 'shop_and_search',
	categories: [],
	tags: [],
	brand: '',
	collections: [],
	featuredImage: null,
	gallery: [],
	typeDetails: {},
	seoTitle: '',
	seoDescription: '',
	specifications: [],
	faqs: [],
	translations: {},
	pricingSuggestion: null,
	inventoryPrediction: null,
};

interface ProductEditProps {
	id: number | null;
}

/**
 * A dedicated full page for creating/editing one product. Real,
 * bookmarkable URL (`admin.php?page=vulocart-products&action=edit&id=123`),
 * not a modal - same navigation model as this session's earlier Products/
 * Orders split (see Products.tsx's docblock).
 *
 * Deliberately kept to as few cards as the content allows, rather than one
 * card per WooCommerce/Shopify meta-box: left is a single "Product Setup"
 * card (type + recommended checklist); center is "Product Details" (name/
 * description/pricing/attributes), an optional per-type "Type Details"
 * card, an optional combined "Inventory & Shipping" card, and "Policies &
 * Related Products"; right is "Publishing", a combined "Organization"
 * card (category, tags, brand, collections - all real DB-backed taxonomy
 * terms, see Domain\Term\Taxonomy), and "Upload image". Subsections within a card
 * use a plain `<h4>` (`.vulocart-subsection-title`) rather than a new
 * `CardComponent`, so grouping related fields doesn't cost another box.
 *
 * Fields beyond title/type/sku/price/currency/status (Domain\Product\Product's
 * real columns) are stored in the Product's existing generic `meta` JSON
 * column - no schema change needed, same "extensible, type-specific
 * attributes" role `meta` already has for Cart/Order.
 *
 * The form is genuinely dynamic per product type (this plugin's admin-UX
 * brief's 11-type list - Physical/Digital/Subscription/Course/Service/
 * Membership/Booking/Rental/Bundle/Donation/Gift Card): "Inventory &
 * Shipping" only renders for types that actually track stock or ship a
 * package (STOCK_TRACKED_TYPES/SHIPPABLE_TYPES below, each gating its own
 * subsection independently), and every non-physical type gets its own
 * "Type Details" card driven by TYPE_FIELD_CONFIG - e.g. a Subscription
 * shows billing interval/trial period, a Course shows lesson count/skill
 * level, a Gift Card shows denominations/expiry. Delivery nature (physical/
 * downloadable/digital_service/other) is derived straight from `type`
 * (TYPE_TO_DELIVERY_METHOD) rather than a separate manual picker.
 *
 * One thing is deliberately NOT built as a fully real feature here:
 * "Related products"/"Offer as an add-on" (stored as simple comma-separated id
 * lists in meta, since there's no product-picker/search component yet -
 * real storage, simplified input). "Attributes & Variations" *is* real -
 * `vulocart_product_variants_section` (a narrower cousin of
 * `vulocart_product_edit_sections`, replacing this specific subsection's
 * content in place rather than appending elsewhere) lets vulocart-pro's
 * Variants module render a real matrix editor there; the inert
 * "not supported yet" button/notice below is only what free-tier users
 * without that module active still see.
 *
 * `vulocart_product_edit_sections` - a `@wordpress/hooks` filter applied
 * at the end of the center column, alongside this page's own cards
 * ("Product Details", "Policies & Related Products", ...) - so a Pro
 * module's card renders as one more meta box in the same grid, not a
 * separate block bolted on elsewhere. Same "Pro extends Free via filters"
 * pattern `vulocart_product_row_actions` already establishes on
 * ProductsList.tsx, just for the edit page instead of the list. Only
 * fires once the product has a real id (`isEditMode`) - there's nothing
 * for a Pro section to attach to before the product itself has been
 * saved once.
 * `vulocart-pro`'s Passport module is the first (only) registrant today.
 */
export function ProductEdit( { id }: ProductEditProps ) {
	const isEditMode = null !== id;

	const [ formData, setFormData ] = useState< ProductFormState >( EMPTY_FORM );
	const [ isLoadingInitial, setIsLoadingInitial ] = useState( isEditMode );

	// A new product starts on the "What are you selling?" screen unless the address already names a type (?type=service).
	const [ typeChosen, setTypeChosen ] = useState( () => {
		if ( isEditMode ) {
			return true;
		}

		const wanted = new URLSearchParams( window.location.search ).get( 'type' );

		return !! wanted && TYPE_PROFILES.some( ( entry ) => entry.value === wanted );
	} );
	const [ notFound, setNotFound ] = useState( false );
	const [ isSaving, setIsSaving ] = useState( false );
	const [ savedNotice, setSavedNotice ] = useState( false );
	const [ showProgress, setShowProgress ] = useState( false );
	/** Problems found by the last Save click, by field. Re-checked on every edit until they are all fixed. */
	const [ fieldErrors, setFieldErrors ] = useState< Record< string, { message: string; target: string } > >( {} );

	// What the form looked like when it was last loaded or saved - anything different is an unsaved change.
	const savedSnapshot = useRef< string | null >( null );

	useEffect( () => {
		if ( ! isLoadingInitial && null === savedSnapshot.current ) {
			savedSnapshot.current = JSON.stringify( formData );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- only the moment loading finishes matters here.
	}, [ isLoadingInitial ] );

	const isDirty = null !== savedSnapshot.current && JSON.stringify( formData ) !== savedSnapshot.current;

	useEffect( () => {
		if ( ! isDirty ) {
			return undefined;
		}

		const warn = ( event: BeforeUnloadEvent ) => {
			event.preventDefault();
			event.returnValue = '';
		};

		window.addEventListener( 'beforeunload', warn );

		return () => window.removeEventListener( 'beforeunload', warn );
	}, [ isDirty ] );
	const progressRef = useRef< HTMLDivElement >( null );
	const [ showStatusMenu, setShowStatusMenu ] = useState( false );
	const statusRef = useRef< HTMLDivElement >( null );
	const [ showMoreMenu, setShowMoreMenu ] = useState( false );
	const moreRef = useRef< HTMLDivElement >( null );

	useEffect( () => {
		if ( ! showMoreMenu ) {
			return undefined;
		}

		const onPointerDown = ( event: MouseEvent ) => {
			if ( moreRef.current && ! moreRef.current.contains( event.target as Node ) ) {
				setShowMoreMenu( false );
			}
		};
		const onKeyDown = ( event: KeyboardEvent ) => {
			if ( 'Escape' === event.key ) {
				setShowMoreMenu( false );
			}
		};

		document.addEventListener( 'mousedown', onPointerDown );
		document.addEventListener( 'keydown', onKeyDown );

		return () => {
			document.removeEventListener( 'mousedown', onPointerDown );
			document.removeEventListener( 'keydown', onKeyDown );
		};
	}, [ showMoreMenu ] );

	useEffect( () => {
		if ( ! showStatusMenu ) {
			return undefined;
		}

		const onPointerDown = ( event: MouseEvent ) => {
			if ( statusRef.current && ! statusRef.current.contains( event.target as Node ) ) {
				setShowStatusMenu( false );
			}
		};
		const onKeyDown = ( event: KeyboardEvent ) => {
			if ( 'Escape' === event.key ) {
				setShowStatusMenu( false );
			}
		};

		document.addEventListener( 'mousedown', onPointerDown );
		document.addEventListener( 'keydown', onKeyDown );

		return () => {
			document.removeEventListener( 'mousedown', onPointerDown );
			document.removeEventListener( 'keydown', onKeyDown );
		};
	}, [ showStatusMenu ] );

	useEffect( () => {
		if ( ! showProgress ) {
			return undefined;
		}

		const onPointerDown = ( event: MouseEvent ) => {
			if ( progressRef.current && ! progressRef.current.contains( event.target as Node ) ) {
				setShowProgress( false );
			}
		};
		const onKeyDown = ( event: KeyboardEvent ) => {
			if ( 'Escape' === event.key ) {
				setShowProgress( false );
			}
		};

		document.addEventListener( 'mousedown', onPointerDown );
		document.addEventListener( 'keydown', onKeyDown );

		return () => {
			document.removeEventListener( 'mousedown', onPointerDown );
			document.removeEventListener( 'keydown', onKeyDown );
		};
	}, [ showProgress ] );
	const [ publishedAt, setPublishedAt ] = useState< string | null >( null );
	const [ showVariantsNotice, setShowVariantsNotice ] = useState( false );
	const [ categoryOptions, setCategoryOptions ] = useState< { key: string; value: string; label: string; id?: number; depth?: number }[] >( [] );
	const [ tagOptions, setTagOptions ] = useState< { key: string; value: string; label: string }[] >( [] );
	const [ brandOptions, setBrandOptions ] = useState< { label: string; value: string }[] >( [] );
	const [ collectionOptions, setCollectionOptions ] = useState< { key: string; value: string; label: string }[] >( [] );

	const update = ( patch: Partial< ProductFormState > ) =>
		setFormData( ( prev ) => ( { ...prev, ...patch } ) );

	/**
	 * Edits the price list. The single `price` / `salePrice` the rest of this page reads (preview, checklist,
	 * the `price` column on save) are always the default price's, so they are rewritten with every change.
	 */
	const setPrices = ( prices: EditablePrice[] ) => {
		const main = defaultPrice( prices );

		update( { prices, price: main.amount, salePrice: main.sale_amount } );
	};

	/**
	 * Applies a saved template (or any prefill) to the new-product form. The price list is the source of truth, so a
	 * template's `prices` replace it (with fresh ids), and a bare `price` / `salePrice` from an older template is
	 * written into the default price - either way the Pricing card shows it straight away.
	 */
	/** What the chosen type and subtype need on screen - see typeProfiles.ts. */
	const profile = profileFor( formData.type );
	const subtype = subtypeFor( formData.type, formData.subtype );
	const cards = cardsFor( formData.type, formData.subtype );
	const typeFields = fieldsFor( formData.type, formData.subtype );

	// `...&action=add&type=booking` opens the editor with that type already chosen.
	useEffect( () => {
		const wanted = new URLSearchParams( window.location.search ).get( 'type' );

		if ( ! isEditMode && wanted && TYPE_PROFILES.some( ( entry ) => entry.value === wanted ) ) {
			update( { type: wanted, subtype: profileFor( wanted ).subtypes[ 0 ].value } );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- runs once, on mount.
	}, [] );

	const applyPrefill = ( patch: Record< string, unknown > ) => {
		const { prices, price, salePrice, ...rest } = patch;

		setFormData( ( prev ) => {
			let nextPrices = prev.prices;

			if ( Array.isArray( prices ) && prices.length > 0 ) {
				nextPrices = toEditablePrices(
					prices.map( ( entry ) => ( { ...( entry as Record< string, unknown > ), id: newPriceId() } ) ),
					null,
					null
				);
			} else if ( undefined !== price || undefined !== salePrice ) {
				const current = defaultPrice( prev.prices );

				nextPrices = prev.prices.map( ( entry ) =>
					entry.id === current.id
						? {
								...entry,
								...( undefined !== price ? { amount: String( price ?? '' ) } : {} ),
								...( undefined !== salePrice ? { sale_amount: String( salePrice ?? '' ) } : {} ),
						  }
						: entry
				);
			}

			const main = defaultPrice( nextPrices );

			return { ...prev, ...( rest as Partial< ProductFormState > ), prices: nextPrices, price: main.amount, salePrice: main.sale_amount };
		} );
	};

	/**
	 * Creates a term from the picker (`POST /{route}` with just a name) and hands back its option, adding it to the
	 * list the picker draws from. A failure shows a toast and resolves null so the picker simply stays as it was.
	 */
	const createTerm = ( route: string, add: ( option: TermOption ) => void ) => ( name: string ): Promise< TermOption | null > =>
		axios
			.post< CategoryTerm >( getApiLink( vulocartLocalizer, route ), { name }, { headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } } )
			.then( ( response ) => {
				const option = { value: response.data.slug, label: response.data.name };

				add( option );

				return option;
			} )
			.catch( ( error ) => {
				showErrorToast( errorMessageOf( error ) );

				return null;
			} );

	/** Creates a category (optionally under a parent) and reloads the tree so it appears in the right place. */
	const createCategory = ( name: string, parentId?: number ): Promise< TermOption | null > =>
		axios
			.post< CategoryTerm >(
				getApiLink( vulocartLocalizer, 'categories' ),
				{ name, ...( parentId ? { parent_id: parentId } : {} ) },
				{ headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } }
			)
			.then( ( created ) =>
				axios
					.get< CategoryTerm[] >( getApiLink( vulocartLocalizer, 'categories' ), { headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } } )
					.then( ( response ) => {
						setCategoryOptions( formatCategoryOptions( response.data ) );

						return { value: created.data.slug, label: created.data.name };
					} )
			)
			.catch( ( error ) => {
				showErrorToast( errorMessageOf( error ) );

				return null;
			} );

	useEffect( () => {
		axios
			.get< CategoryTerm[] >( getApiLink( vulocartLocalizer, 'categories' ), {
				headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
			} )
			.then( ( response ) => setCategoryOptions( formatCategoryOptions( response.data ) ) );

		// Tags/Collections are flat (Domain\Term\Taxonomy's own docblock -
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
			.get( getApiLink( vulocartLocalizer, `products/${ id }` ), {
				headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
			} )
			.then( ( response ) => {
				const product = response.data;
				const meta = product.meta || {};

				setFormData( {
					type: product.type || 'physical',
					// Products saved before subtypes existed keep the options card they may already be using.
					subtype: meta.subtype || ( 'physical' === product.type ? 'variable' : '' ),
					subtype: meta.subtype || '',
					title: product.title || '',
					sku: product.sku || '',
					price: product.price !== null && product.price !== undefined ? String( product.price ) : '',
					currency: product.currency || 'USD',
					status: product.status || 'draft',
					shortDescription: meta.short_description || '',
					fullDescription: meta.full_description || '',
					salePrice: meta.sale_price !== null && meta.sale_price !== undefined ? String( meta.sale_price ) : '',
					prices: toEditablePrices( meta.prices, product.price, meta.sale_price ),
					stockManagement: !! meta.stock_management,
					stockQuantity: meta.stock_quantity !== null && meta.stock_quantity !== undefined ? String( meta.stock_quantity ) : '',
					stockStatus: meta.stock_status || 'in_stock',
					weight: meta.weight || '',
					length: meta.length || '',
					width: meta.width || '',
					height: meta.height || '',
					shippingClass: meta.shipping_class || '',
					shippingPolicy: meta.shipping_policy || '',
					refundPolicy: meta.refund_policy || '',
					cancellationPolicy: meta.cancellation_policy || '',
					relatedProducts: meta.related_products || '',
					addonProducts: meta.addon_products || '',
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
					seoTitle: meta.seo_title || '',
					seoDescription: meta.seo_description || '',
					specifications: Array.isArray( meta.specifications ) ? meta.specifications : [],
					faqs: Array.isArray( meta.faqs ) ? meta.faqs : [],
					translations: meta.translations && 'object' === typeof meta.translations && ! Array.isArray( meta.translations ) ? meta.translations : {},
					pricingSuggestion: meta.pricing_suggestion && 'object' === typeof meta.pricing_suggestion ? meta.pricing_suggestion : null,
					inventoryPrediction: meta.inventory_prediction && 'object' === typeof meta.inventory_prediction ? meta.inventory_prediction : null,
				} );
				setPublishedAt( product.published_at || null );
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
				label: __( 'Product Name', 'vulocart' ),
				desc: __( 'A clear, descriptive title that helps customers find your product', 'vulocart' ),
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
		// tracks - the checklist (and its X/N denominator) reflects that,
		// same "dynamic per type" principle the form fields themselves follow.
		if ( cards.inventory ) {
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
				label: __( 'Product Images', 'vulocart' ),
				desc: __( 'High-quality photos showing your product from multiple angles', 'vulocart' ),
				done: !! formData.featuredImage,
			},
			{
				key: 'category',
				label: __( 'Category', 'vulocart' ),
				desc: __( 'Organize your product to help customers browse your store', 'vulocart' ),
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
	const progressPercent = recommendedChecklist.length ? Math.round( ( doneCount / recommendedChecklist.length ) * 100 ) : 0;

	/**
	 * `vulocart_product_variants_section` - a narrower filter than
	 * `vulocart_product_edit_sections` (which only ever appends at the
	 * end of the center column): this one replaces the "Attributes &
	 * Variations" subsection's own inert button/notice in place, so a Pro
	 * module like vulocart-pro's Variants can render a real matrix editor
	 * exactly where that notice used to live rather than as a
	 * disconnected extra card. Null (no registrant, or add-mode with no
	 * id yet) falls back to the existing inert notice - same
	 * "no Pro module means render nothing" default every filter in this
	 * file already has.
	 */
	const variantsSection =
		null !== id ? applyFilters( 'vulocart_product_variants_section', null, { id, type: formData.type } ) : null;

	const previewPrice = formData.price ? Number( formData.price ) : 0;
	const previewSale = formData.salePrice ? Number( formData.salePrice ) : 0;
	const previewDiscount =
		previewPrice > 0 && previewSale > 0 && previewSale < previewPrice ? Math.round( ( 1 - previewSale / previewPrice ) * 100 ) : 0;

	const currencySymbol = ( () => {
		try {
			return (
				new Intl.NumberFormat( undefined, { style: 'currency', currency: formData.currency || 'USD' } )
					.formatToParts( 0 )
					.find( ( part ) => 'currency' === part.type )?.value ?? formData.currency
			);
		} catch {
			return formData.currency;
		}
	} )();

	const formatMoney = ( amount: number ): string => {
		try {
			return new Intl.NumberFormat( undefined, { style: 'currency', currency: formData.currency || 'USD' } ).format( amount );
		} catch {
			return `${ amount.toFixed( 2 ) } ${ formData.currency }`;
		}
	};

	/**
	 * `vulocart_product_ai_button` - where an AI assistant plugs into the page. Called once per place a button can sit
	 * (`field` says which: `description`, `seo`, `specifications`, `faqs`, `translation`, `pricing`, `inventory`, or
	 * `menu` for the top bar) with the product's id, a snapshot of the form, and `apply( patch )`, which merges a
	 * suggestion into the form. Nothing is ever written to the database from here: a suggestion lands in the form like
	 * a typed edit, and is saved with Update. Free ships no AI; with nothing registered the slot draws nothing, and it
	 * is only offered for a product that already exists.
	 */
	const aiForm = {
		title: formData.title,
		type: formData.type,
		shortDescription: formData.shortDescription,
		fullDescription: formData.fullDescription,
		price: formData.price,
		salePrice: formData.salePrice,
		currency: formData.currency,
		stockManagement: formData.stockManagement,
		stockQuantity: formData.stockQuantity,
		seoTitle: formData.seoTitle,
		seoDescription: formData.seoDescription,
		specifications: formData.specifications,
		faqs: formData.faqs,
		translations: formData.translations,
		gallery: formData.gallery,
		featuredImage: formData.featuredImage,
	};

	const renderAi = ( field: string ) =>
		applyFilters( 'vulocart_product_ai_button', null, { field, id: id ?? 0, form: aiForm, apply: applyPrefill } );

	/** The AI slot wrapped for sitting beside a field, or nothing when no assistant is registered. */
	const aiSlot = ( field: string ) => {
		const node = renderAi( field );

		return node ? <span className="vulocart-ai-slot">{ node as ReactNode }</span> : null;
	};

	/**
	 * `vulocart_product_more_actions` - entries for the top bar's "..." menu: `{ key, label, icon?, onClick }`. Things
	 * that act on this product but don't belong on the page itself (vulocart-pro's "Save as template"). The menu is
	 * only drawn when something registered an entry, and only for a product that already exists.
	 */
	const moreActions = (
		isEditMode ? applyFilters( 'vulocart_product_more_actions', [], { id, type: formData.type } ) : []
	) as { key: string; label: string; icon?: string; onClick: () => void }[];

	/**
	 * Edit-mode-only slots inside the Pricing and Inventory & Shipping cards, so a Pro module's pricing
	 * rules / per-warehouse stock sit in the card they belong to instead of a second card of the same name.
	 */
	const pricingSection =
		null !== id ? applyFilters( 'vulocart_product_pricing_section', null, {
				id,
				type: formData.type,
				categories: formData.categories,
				currency: formData.currency,
			} ) : null;
	const inventorySection =
		null !== id ? applyFilters( 'vulocart_product_inventory_section', null, { id, type: formData.type } ) : null;

	/** Quick-start options above a new product (AI draft, saved presets) - nothing is drawn when none are registered. */
	const startOptions = ! isEditMode
		? applyFilters( 'vulocart_product_add_prefill', null, { type: formData.type, applyPrefill } )
		: null;

	const buildMetaPayload = () => ( {
		short_description: formData.shortDescription || undefined,
		full_description: formData.fullDescription || undefined,
		sale_price: formData.salePrice ? Number( formData.salePrice ) : null,
		prices: formData.prices.map( toPayloadPrice ),
		subtype: subtype.value,
		stock_management: cards.inventory && formData.stockManagement,
		stock_quantity: cards.inventory && formData.stockManagement && '' !== formData.stockQuantity ? Number( formData.stockQuantity ) : null,
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
		related_products: formData.relatedProducts || undefined,
		addon_products: formData.addonProducts || undefined,
		featured: formData.featured,
		catalog_visibility: formData.catalogVisibility,
		categories: formData.categories,
		tags: formData.tags,
		brand: formData.brand || null,
		collections: formData.collections,
		featured_image: formData.featuredImage,
		gallery: formData.gallery,
		type_details: formData.typeDetails,
		seo_title: formData.seoTitle || undefined,
		seo_description: formData.seoDescription || undefined,
		specifications: formData.specifications.filter( ( row ) => row.key.trim() ),
		faqs: formData.faqs.filter( ( row ) => row.question.trim() ),
		translations: formData.translations,
		pricing_suggestion: formData.pricingSuggestion ?? undefined,
		inventory_prediction: formData.inventoryPrediction ?? undefined,
	} );

	/** What must be fixed before this product can be saved (or published). */
	const findProblems = (): Record< string, { message: string; target: string } > => {
		const problems: Record< string, { message: string; target: string } > = {};

		if ( ! formData.title.trim() ) {
			problems.title = { message: __( 'Give this product a name.', 'vulocart' ), target: 'vulocart-product-title' };
		}

		if ( 'published' === formData.status && '' === String( formData.price ).trim() ) {
			problems.price = {
				message: __( 'Add a price before publishing - enter 0 if it is free.', 'vulocart' ),
				target: 'vulocart-pricing-card',
			};
		}

		if ( cards.inventory && formData.stockManagement && '' === formData.stockQuantity ) {
			problems.stockQuantity = {
				message: __( 'Enter how many units you have, or turn off Track stock.', 'vulocart' ),
				target: 'vulocart-product-stock-quantity',
			};
		}

		return problems;
	};

	// Once the user has tried to save, keep the messages in step with what they are fixing.
	useEffect( () => {
		if ( Object.keys( fieldErrors ).length ) {
			setFieldErrors( findProblems() );
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- re-check on form edits only.
	}, [ formData ] );

	const handleSave = () => {
		const problems = findProblems();

		setFieldErrors( problems );

		const first = Object.values( problems )[ 0 ];

		if ( first ) {
			const node = document.getElementById( first.target );

			node?.scrollIntoView( { behavior: 'smooth', block: 'center' } );
			window.setTimeout( () => node?.focus?.( { preventScroll: true } ), 250 );
			showErrorToast( first.message );

			return;
		}

		const types = getPriceTypes();
		const priceIssue = formData.prices
			.map( ( price ) => priceProblem( price, types.find( ( type ) => type.value === price.type ) ) )
			.find( Boolean );

		if ( priceIssue ) {
			showErrorToast( priceIssue );
			return;
		}

		setIsSaving( true );
		setSavedNotice( false );

		const payload = {
			type: formData.type,
			title: formData.title,
			status: formData.status,
			sku: formData.sku || undefined,
			price: formData.price ? Number( formData.price ) : isEditMode ? 0 : undefined,
			currency: formData.price ? formData.currency : undefined,
			meta: buildMetaPayload(),
		};

		const request = isEditMode
			? axios.patch( getApiLink( vulocartLocalizer, `products/${ id }` ), payload, {
					headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
			  } )
			: axios.post( getApiLink( vulocartLocalizer, 'products' ), payload, {
					headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
			  } );

		request
			.then( ( response ) => {
				savedSnapshot.current = JSON.stringify( formData );

				if ( isEditMode ) {
					setIsSaving( false );
					setSavedNotice( true );
				} else {
					window.location.href = `admin.php?page=vulocart-products&action=edit&id=${ response.data.id }`;
				}
			} )
			.catch( ( error ) => {
				setIsSaving( false );
				showErrorToast( errorMessageOf( error ) );
			} );
	};

	const updateTypeDetail = ( key: string, value: string | boolean ) =>
		update( { typeDetails: { ...formData.typeDetails, [ key ]: value } } );

	/**
	 * Renders one TYPE_FIELD_CONFIG entry as the right zyra input for its
	 * `kind` - a single small switch rather than one-off JSX per type, so
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
				type={ 'number' === field.kind ? 'number' : 'date' === field.kind ? 'date' : 'text' }
				name={ field.key }
				value={ ( rawValue as string ) ?? '' }
				onChange={ ( value ) => updateTypeDetail( field.key, String( value ) ) }
			/>
		);
	};

	if ( ! typeChosen ) {
		return (
			<TypeChooser
				onChoose={ ( type ) => {
					update( { type, subtype: profileFor( type ).subtypes[ 0 ].value } );
					setTypeChosen( true );
				} }
				onSkip={ () => setTypeChosen( true ) }
			/>
		);
	}

	if ( isLoadingInitial ) {
		return <p className="vulocart-product-loading">{ __( 'Loading…', 'vulocart' ) }</p>;
	}

	if ( notFound ) {
		return (
			<div className="vulocart-product-edit-page">
				<a className="vulocart-back-link" href="admin.php?page=vulocart-products">
					{ __( '← Back to Products', 'vulocart' ) }
				</a>
				<p>{ __( 'No product exists with this id.', 'vulocart' ) }</p>
			</div>
		);
	}

	return (
		<div className="vulocart-product-edit-page">
			<div className="vulocart-product-edit-topbar">
				<div>
					<nav className="vulocart-breadcrumbs" aria-label={ __( 'Breadcrumb', 'vulocart' ) }>
						<a href="admin.php?page=vulocart-products">{ __( 'Products', 'vulocart' ) }</a>
						<i className="adminfont-pagination-next-arrow" aria-hidden="true" />
						<span aria-current="page">{ isEditMode ? __( 'Edit Product', 'vulocart' ) : __( 'Add Product', 'vulocart' ) }</span>
					</nav>
					<h1 className="vulocart-edit-page-title">
						{ isEditMode
							? formData.title || __( 'Untitled product', 'vulocart' )
							: sprintf( /* translators: %s: product type, e.g. Service. */ __( 'Add %s', 'vulocart' ), profile.label ) }
					</h1>
					<div className="vulocart-title-meta">
						<span className="vulocart-pill is-type" title={ profile.hint }>
							<i className={ `adminfont-${ profile.icon }` } aria-hidden="true" />
							{ profile.label }
						</span>
						{ profile.subtypes.length > 1 && (
							<span className="vulocart-pill is-kind" title={ subtype.hint }>
								{ subtype.label }
							</span>
						) }
						{ isEditMode && formData.sku ? (
							<span className="vulocart-pill is-sku" title={ __( 'SKU', 'vulocart' ) }>
								<small>{ __( 'SKU', 'vulocart' ) }</small>
								{ formData.sku }
							</span>
						) : null }
					</div>
					{ ! isEditMode && <p className="vulocart-product-edit-subtitle">{ subtype.hint }</p> }
				</div>

				<div className="vulocart-topbar-actions">
					<div className="vulocart-topbar-status" ref={ statusRef }>
						<div className="vulocart-status-row">
							<span className={ `vulocart-status-tag is-${ formData.status }` }>
								<i aria-hidden="true" />
								{ PRODUCT_STATUS_OPTIONS.find( ( option ) => option.value === formData.status )?.label ?? formData.status }
							</span>
							<button
								type="button"
								className="vulocart-status-edit"
								aria-haspopup="menu"
								aria-expanded={ showStatusMenu }
								aria-label={ __( 'Change status', 'vulocart' ) }
								title={ __( 'Change status', 'vulocart' ) }
								onClick={ () => setShowStatusMenu( ! showStatusMenu ) }
							>
								<i className="adminfont-edit" aria-hidden="true" />
							</button>
						</div>
						{ publishedAt && 'published' === formData.status && (
							<span className="vulocart-topbar-published">
								<i className="adminfont-calendar" aria-hidden="true" />
								{ __( 'Published on', 'vulocart' ) } { formatWpDateTime( publishedAt ) }
							</span>
						) }
						{ showStatusMenu && (
							<ul className="vulocart-status-menu" role="menu">
								{ PRODUCT_STATUS_OPTIONS.map( ( option ) => (
									<li key={ option.value }>
										<button
											type="button"
											role="menuitemradio"
											aria-checked={ option.value === formData.status }
											className={ option.value === formData.status ? 'is-active' : '' }
											onClick={ () => {
												update( { status: option.value } );
												setShowStatusMenu( false );
											} }
										>
											<span className={ `vulocart-status-tag is-${ option.value }` }>
												<i aria-hidden="true" />
												{ option.label }
											</span>
											{ option.value === formData.status && <i className="adminfont-check" aria-hidden="true" /> }
										</button>
									</li>
								) ) }
							</ul>
						) }
					</div>
					{ isDirty && (
						<span className="vulocart-unsaved" role="status">
							<i aria-hidden="true" />
							{ __( 'Unsaved changes', 'vulocart' ) }
						</span>
					) }
					<div className="vulocart-progress-anchor" ref={ progressRef }>
					<button
						type="button"
						className={ `vulocart-progress-pill${ showProgress ? ' is-open' : '' }${ doneCount === recommendedChecklist.length ? ' is-complete' : '' }` }
						aria-expanded={ showProgress }
						aria-controls="vulocart-setup-progress"
						onClick={ () => setShowProgress( ! showProgress ) }
					>
						<span className="vulocart-progress-ring" style={ { [ '--progress' as string ]: `${ progressPercent }%` } } aria-hidden="true" />
						<span>
							{ __( 'Setup progress', 'vulocart' ) } · { doneCount }/{ recommendedChecklist.length }
						</span>
						<i className="adminfont-keyboard-arrow-down" aria-hidden="true" />
					</button>
					{ showProgress && (
						<section id="vulocart-setup-progress" className="vulocart-progress-popover" role="dialog" aria-label={ __( 'Setup progress', 'vulocart' ) }>
							<header>
								<span className="vulocart-progress-ring is-large" style={ { [ '--progress' as string ]: `${ progressPercent }%` } } aria-hidden="true">
									<b>{ progressPercent }%</b>
								</span>
								<div>
									<strong>
										{ doneCount === recommendedChecklist.length
											? __( 'Ready to publish', 'vulocart' )
											: __( 'Almost there', 'vulocart' ) }
									</strong>
									<span>
										{ doneCount }/{ recommendedChecklist.length } { __( 'steps complete', 'vulocart' ) }
									</span>
								</div>
								<button type="button" className="vulocart-progress-close" aria-label={ __( 'Close', 'vulocart' ) } onClick={ () => setShowProgress( false ) }>
									<i className="adminfont-close" aria-hidden="true" />
								</button>
							</header>
							<ul className="vulocart-recommended-checklist">
								{ recommendedChecklist.map( ( item ) => (
									<li key={ item.key } className={ item.done ? 'is-done' : '' } title={ item.desc }>
										<i className={ `adminfont-${ item.done ? 'check' : 'radio' }` } />
										<div>
											<span>{ item.label }</span>
											<small>{ item.desc }</small>
										</div>
									</li>
								) ) }
							</ul>
						</section>
					) }
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
							disabled: isSaving,
						},
					] }
				/>
				{ renderAi( 'menu' ) }
				{ moreActions.length > 0 && (
					<div className="vulocart-more" ref={ moreRef }>
						<button
							type="button"
							className="vulocart-more-button"
							aria-haspopup="menu"
							aria-expanded={ showMoreMenu }
							aria-label={ __( 'More actions', 'vulocart' ) }
							onClick={ () => setShowMoreMenu( ! showMoreMenu ) }
						>
							<i className="adminfont-more-vertical" aria-hidden="true" />
						</button>
						{ showMoreMenu && (
							<ul className="vulocart-status-menu vulocart-more-menu" role="menu">
								{ moreActions.map( ( action ) => (
									<li key={ action.key }>
										<button
											type="button"
											role="menuitem"
											onClick={ () => {
												setShowMoreMenu( false );
												action.onClick();
											} }
										>
											{ action.icon && <i className={ `adminfont-${ action.icon }` } aria-hidden="true" /> }
											<span>{ action.label }</span>
										</button>
									</li>
								) ) }
							</ul>
						) }
					</div>
				) }
				</div>
			</div>

			{
				/**
				 * `vulocart_product_add_prefill` - only in add mode
				 * (`!isEditMode`): there's no product id yet for
				 * `vulocart_product_edit_sections` to attach to (that
				 * filter's own docblock explains why it's edit-mode-only),
				 * but a Pro module like vulocart-pro's Product Templates
				 * still needs a hook to prefill `formData` before the
				 * first save. Hands the registrant `type` (so it can only
				 * offer templates matching the chosen product type) and
				 * `applyPrefill` - a direct pass-through to this
				 * component's own `update()` - rather than a `data`/`onPick`
				 * pair, so a template only ever changes fields it actually
				 * has a value for.
				 */
				startOptions && (
					<div className="vulocart-start-bar" role="region" aria-label={ __( 'Quick start', 'vulocart' ) }>
						{ startOptions as ReactNode }
					</div>
				)
			}

			{ savedNotice && (
				<div className="vulocart-saved-notice">{ __( 'Product updated.', 'vulocart' ) }</div>
			) }

			<div className="vulocart-product-edit-grid">
				{ /* Main column */ }
				<div className="vulocart-product-edit-col vulocart-product-edit-col--center">
					<CardComponent
						titleIcon="catalog"
						title={
							<span className="vulocart-title-with-star">
								{ __( 'Product Details', 'vulocart' ) }
								<button
									type="button"
									className={ `vulocart-star${ formData.featured ? ' is-on' : '' }` }
									aria-pressed={ formData.featured }
									aria-label={ formData.featured ? __( 'Featured - click to remove', 'vulocart' ) : __( 'Feature this product', 'vulocart' ) }
									title={ formData.featured ? __( 'Featured', 'vulocart' ) : __( 'Feature this product', 'vulocart' ) }
									onClick={ () => update( { featured: ! formData.featured } ) }
								>
									<i className="adminfont-star" aria-hidden="true" />
									<span>{ formData.featured ? __( 'Featured', 'vulocart' ) : __( 'Feature this', 'vulocart' ) }</span>
								</button>
							</span>
						}
						desc={ __( 'Tell customers what you are selling.', 'vulocart' ) }
						action={
						<div className="vulocart-details-actions vulocart-topbar-controls">
							<HeaderPicker
								caption={ __( 'Type', 'vulocart' ) }
								ariaLabel={ __( 'Product type', 'vulocart' ) }
								options={ TYPE_PROFILES.filter( ( entry ) => entry.value === formData.type || ! ( vulocartLocalizer.disabled_product_types ?? [] ).includes( entry.value ) ).map( ( entry ) => ( { value: entry.value, label: entry.label, hint: entry.hint } ) ) }
								value={ formData.type }
								onSelect={ ( value ) => update( { type: value, subtype: profileFor( value ).subtypes[ 0 ].value } ) }
							/>
							{ profile.subtypes.length > 1 && (
								<HeaderPicker
									caption={ __( 'Kind', 'vulocart' ) }
									ariaLabel={ __( 'Product subtype', 'vulocart' ) }
									options={ profile.subtypes }
									value={ subtype.value }
									onSelect={ ( value ) => update( { subtype: value } ) }
								/>
							) }
						</div>
						}
					>
						<FormGroupWrapperComponent>
							<FormGroupComponent label={ profile.nameLabel } htmlFor="vulocart-product-title">
								<TextInput
									id="vulocart-product-title"
									name="title"
									inputClass={ fieldErrors.title ? 'has-error' : '' }
									value={ formData.title }
									onChange={ ( value ) => update( { title: value as string } ) }
								/>
								{ fieldErrors.title && <p className="vulocart-field-error" role="alert">{ fieldErrors.title.message }</p> }
							</FormGroupComponent>

							<div className="vulocart-ai-anchor">
								{ aiSlot( 'description' ) }
								<FormGroupComponent
									label={ __( 'Short description - One-line summary', 'vulocart' ) }
									htmlFor="vulocart-product-short-desc"
								>
									<TextAreaInput
										name="shortDescription"
										rowNumber={ 2 }
										value={ formData.shortDescription }
										onChange={ ( value ) => update( { shortDescription: value } ) }
									/>
								</FormGroupComponent>
							</div>

							<FormGroupComponent label={ __( 'Full description', 'vulocart' ) } htmlFor="vulocart-product-full-desc">
								<TextAreaInput
									name="fullDescription"
									rowNumber={ 4 }
									value={ formData.fullDescription }
									onChange={ ( value ) => update( { fullDescription: value } ) }
								/>
							</FormGroupComponent>
						</FormGroupWrapperComponent>
					</CardComponent>

					<CardComponent
						titleIcon="payment"
						title={ __( 'Pricing', 'vulocart' ) }
						desc={ __( 'What customers pay. Add more prices for plans, tiers or bundles.', 'vulocart' ) }
						action={
							<div className="vulocart-card-actions">
								{ aiSlot( 'pricing' ) }
							<div className="vulocart-currency-pill">
								<span>{ __( 'Currency', 'vulocart' ) }</span>
								<SelectInput
									name="currency"
									type="single-select"
									options={ CURRENCY_OPTIONS }
									value={ formData.currency }
									onChange={ ( value ) => update( { currency: value as string } ) }
								/>
							</div>
							</div>
						}
					>
						<div id="vulocart-pricing-card" tabIndex={ -1 } />
						{ fieldErrors.price && <p className="vulocart-field-error" role="alert">{ fieldErrors.price.message }</p> }
						<PriceList prices={ formData.prices } onChange={ setPrices } symbol={ currencySymbol } money={ formatMoney } />
						{ PRICE_LIST_HINTS[ formData.type ] && <p className="vulocart-price-type-hint">{ PRICE_LIST_HINTS[ formData.type ] }</p> }

						{ pricingSection }
					</CardComponent>

					{ cards.variants && (
					<CardComponent titleIcon="variable" title={ __( 'Attributes & Variations', 'vulocart' ) }>
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
											'Product variants are not supported yet - this is planned for a future update.',
											'vulocart'
										) }
									</p>
								) }
							</>
						) }
					</CardComponent>
					) }

					{ typeFields.length > 0 && (
						<CardComponent
							titleIcon="feature"
							title={ profile.detailsTitle || __( 'Type Details', 'vulocart' ) }
							desc={ subtype.hint }
						>
							<FormGroupWrapperComponent>
								{ typeFields.map( ( field ) => (
									<FormGroupComponent
										key={ field.key }
										label={ field.label }
										htmlFor={ `vulocart-product-${ field.key }` }
									>
										{ renderTypeDetailField( field ) }
										{ field.hint && <p className="vulocart-field-hint">{ field.hint }</p> }
									</FormGroupComponent>
								) ) }
							</FormGroupWrapperComponent>
						</CardComponent>
					) }

					{ cards.inventory && (
						<CardComponent
							titleIcon="store-inventory"
							title={ __( 'Inventory', 'vulocart' ) }
							desc={ __( 'How much you have, and whether customers can buy it.', 'vulocart' ) }
							action={
								<div className="vulocart-card-actions">
									{ aiSlot( 'inventory' ) }
									<label className="vulocart-switch-row vulocart-stock-toggle" htmlFor="vulocart-stock-switch">
										<span>{ __( 'Track stock', 'vulocart' ) }</span>
										<button
											type="button"
											role="switch"
											id="vulocart-stock-switch"
											aria-checked={ formData.stockManagement }
											className={ `vulocart-switch${ formData.stockManagement ? ' is-on' : '' }` }
											onClick={ () => update( { stockManagement: ! formData.stockManagement } ) }
										>
											<span aria-hidden="true" />
										</button>
									</label>
								</div>
							}
						>
							{ ( () => {
								const units = '' === formData.stockQuantity ? null : Number( formData.stockQuantity );
								const tracked = formData.stockManagement && null !== units;
								const level =
									'out_of_stock' === formData.stockStatus || ( tracked && units <= 0 )
										? 'out'
										: 'on_backorder' === formData.stockStatus
										? 'backorder'
										: tracked && units <= 5
										? 'low'
										: 'in';
								const labels: Record< string, string > = {
									in: __( 'In stock', 'vulocart' ),
									low: __( 'Running low', 'vulocart' ),
									out: __( 'Out of stock', 'vulocart' ),
									backorder: __( 'On backorder', 'vulocart' ),
								};

								return (
									<div className={ `vulocart-stat-strip is-${ level }` }>
										<div className="vulocart-stat">
											<span className="vulocart-stat-label">{ __( 'Status', 'vulocart' ) }</span>
											<span className="vulocart-stat-value">
												<i className="vulocart-stat-dot" aria-hidden="true" />
												{ labels[ level ] }
											</span>
										</div>
										<div className="vulocart-stat">
											<span className="vulocart-stat-label">{ __( 'Units on hand', 'vulocart' ) }</span>
											<span className="vulocart-stat-value">
												{ formData.stockManagement ? ( null === units ? '—' : units ) : __( 'Not tracked', 'vulocart' ) }
											</span>
										</div>
									</div>
								);
							} )() }

							<div className="vulocart-two-col-fields">
								<FormGroupComponent label={ __( 'SKU', 'vulocart' ) } htmlFor="vulocart-product-sku">
									<TextInput
										id="vulocart-product-sku"
										name="sku"
										value={ formData.sku }
										onChange={ ( value ) => update( { sku: String( value ) } ) }
									/>
								</FormGroupComponent>
								<FormGroupComponent label={ __( 'Availability', 'vulocart' ) } htmlFor="vulocart-product-stock-status">
									<SelectInput
										name="stockStatus"
										type="single-select"
										options={ STOCK_STATUS_OPTIONS }
										value={ formData.stockStatus }
										onChange={ ( value ) => update( { stockStatus: value as string } ) }
									/>
								</FormGroupComponent>
							</div>

							{ formData.stockManagement && (
								<div className="vulocart-two-col-fields">
									<FormGroupComponent label={ __( 'Units in stock', 'vulocart' ) } htmlFor="vulocart-product-stock-quantity">
										<TextInput
											id="vulocart-product-stock-quantity"
											name="stockQuantity"
											type="number"
											minNumber={ 0 }
											inputClass={ fieldErrors.stockQuantity ? 'has-error' : '' }
											postText={ __( 'units', 'vulocart' ) }
											value={ formData.stockQuantity }
											onChange={ ( value ) => update( { stockQuantity: sanitizeNumber( value, true ) } ) }
										/>
										{ fieldErrors.stockQuantity && <p className="vulocart-field-error" role="alert">{ fieldErrors.stockQuantity.message }</p> }
									</FormGroupComponent>
								</div>
							) }

							{ formData.stockManagement && '' !== formData.stockQuantity && 0 === Number( formData.stockQuantity ) && 'out_of_stock' !== formData.stockStatus && (
								<p className="vulocart-field-warning" role="status">
									{ __( 'Units in stock is 0 but this is not marked out of stock - customers may order something you cannot ship.', 'vulocart' ) }
								</p>
							) }

							{ inventorySection }
						</CardComponent>
					) }

					{ cards.shipping && (
						<CardComponent
							titleIcon="shipping"
							title={ __( 'Shipping', 'vulocart' ) }
							desc={ __( 'What the package weighs and measures, so checkout can price delivery.', 'vulocart' ) }
							action={
								'' !== formData.weight || '' !== formData.length || '' !== formData.width || '' !== formData.height ? (
									<span className="vulocart-package-chip">
										<i className="adminfont-package" aria-hidden="true" />
										{ [
											'' !== formData.weight ? `${ formData.weight } kg` : '',
											'' !== formData.length || '' !== formData.width || '' !== formData.height
												? `${ formData.length || '0' } × ${ formData.width || '0' } × ${ formData.height || '0' } in`
												: '',
										]
											.filter( Boolean )
											.join( ' · ' ) }
									</span>
								) : null
							}
						>
							{ '' === formData.weight && (
								<p className="vulocart-field-hint">{ __( 'Add a weight so shipping rates can be calculated at checkout.', 'vulocart' ) }</p>
							) }

							<div className="vulocart-two-col-fields">
								<FormGroupComponent label={ __( 'Weight', 'vulocart' ) } htmlFor="vulocart-product-weight">
									<TextInput
										id="vulocart-product-weight"
										name="weight"
										placeholder="0"
										postText="kg"
										value={ formData.weight }
										onChange={ ( value ) => update( { weight: sanitizeNumber( value ) } ) }
									/>
								</FormGroupComponent>
								<FormGroupComponent label={ __( 'Shipping class', 'vulocart' ) } htmlFor="vulocart-product-shipping-class">
									<SelectInput
										name="shippingClass"
										type="single-select"
										options={ SHIPPING_CLASS_OPTIONS }
										value={ formData.shippingClass }
										onChange={ ( value ) => update( { shippingClass: value as string } ) }
									/>
								</FormGroupComponent>
							</div>

							<h4 className="vulocart-subsection-title">{ __( 'Package size', 'vulocart' ) }</h4>
							<div className="vulocart-three-col-fields">
								{ ( [
									[ 'length', __( 'Length', 'vulocart' ) ],
									[ 'width', __( 'Width', 'vulocart' ) ],
									[ 'height', __( 'Height', 'vulocart' ) ],
								] as const ).map( ( [ key, label ] ) => (
									<FormGroupComponent key={ key } label={ label } htmlFor={ `vulocart-product-${ key }` }>
										<TextInput
											id={ `vulocart-product-${ key }` }
											name={ key }
											placeholder="0"
											postText="in"
											value={ formData[ key ] }
											onChange={ ( value ) => update( { [ key ]: sanitizeNumber( value ) } ) }
										/>
									</FormGroupComponent>
								) ) }
							</div>
						</CardComponent>
					) }

					<CardComponent
						titleIcon="legal-compliance"
						title={ __( 'Policies & Related Products', 'vulocart' ) }
						desc={ __( 'Set expectations up front and help customers discover more of what you sell.', 'vulocart' ) }
					>
						<FormGroupWrapperComponent>
							{ cards.shippingPolicy && (
							<FormGroupComponent
								label={ __( 'Shipping policy - How will you ship it and how long will it take?', 'vulocart' ) }
								htmlFor="vulocart-product-shipping-policy"
							>
								<TextAreaInput
									name="shippingPolicy"
									rowNumber={ 2 }
									value={ formData.shippingPolicy }
									onChange={ ( value ) => update( { shippingPolicy: value } ) }
								/>
							</FormGroupComponent>
							) }

							<FormGroupComponent
								label={ __( 'Refund policy - Can customers return or exchange it?', 'vulocart' ) }
								htmlFor="vulocart-product-refund-policy"
							>
								<TextAreaInput
									name="refundPolicy"
									rowNumber={ 2 }
									value={ formData.refundPolicy }
									onChange={ ( value ) => update( { refundPolicy: value } ) }
								/>
							</FormGroupComponent>

							{ cards.cancellation && (
							<FormGroupComponent
								label={ __( 'Cancellation policy - Can they cancel their order after placing it?', 'vulocart' ) }
								htmlFor="vulocart-product-cancellation-policy"
							>
								<TextAreaInput
									name="cancellationPolicy"
									rowNumber={ 2 }
									value={ formData.cancellationPolicy }
									onChange={ ( value ) => update( { cancellationPolicy: value } ) }
								/>
							</FormGroupComponent>
							) }
						</FormGroupWrapperComponent>

						<div className="vulocart-two-col-fields">
							<FormGroupComponent
								label={ __( 'Recommend alongside this product', 'vulocart' ) }
								htmlFor="vulocart-product-related"
							>
								<TextInput
									name="relatedProducts"
									value={ formData.relatedProducts }
									onChange={ ( value ) => update( { relatedProducts: value as string } ) }
								/>
								<p className="vulocart-field-hint">
									{ __( '"You might also like". Comma-separated product ids.', 'vulocart' ) }
								</p>
							</FormGroupComponent>
							<FormGroupComponent
								label={ __( 'Offer as an add-on at checkout', 'vulocart' ) }
								htmlFor="vulocart-product-addon"
							>
								<TextInput
									name="addonProducts"
									value={ formData.addonProducts }
									onChange={ ( value ) => update( { addonProducts: value as string } ) }
								/>
								<p className="vulocart-field-hint">
									{ __( 'Suggested at cart. Comma-separated product ids.', 'vulocart' ) }
								</p>
							</FormGroupComponent>
						</div>
					</CardComponent>

					<CardComponent
						titleIcon="catalog"
						title={ __( 'Search & content', 'vulocart' ) }
						desc={ __( 'How this listing appears in search, plus the specifications, questions and translations that go with it.', 'vulocart' ) }
					>
						<ContentBlock title={ __( 'Search listing', 'vulocart' ) } action={ aiSlot( 'seo' ) }>
							<SeoFields
								title={ formData.seoTitle }
								description={ formData.seoDescription }
								fallbackTitle={ formData.title }
								onChange={ ( patch ) => update( patch ) }
							/>
						</ContentBlock>

						{ cards.specs && (
						<ContentBlock title={ __( 'Specifications', 'vulocart' ) } hint={ __( 'Shown as a table on the product page.', 'vulocart' ) } action={ aiSlot( 'specifications' ) } addLabel={ __( 'Add specification', 'vulocart' ) } onAdd={ () => update( { specifications: [ ...formData.specifications, { key: '', value: '' } ] } ) }>
							<SpecsEditor rows={ formData.specifications } onChange={ ( rows ) => update( { specifications: rows } ) } />
						</ContentBlock>
						) }

						<ContentBlock title={ __( 'Frequently asked questions', 'vulocart' ) } hint={ __( 'Shown on the product page.', 'vulocart' ) } action={ aiSlot( 'faqs' ) } addLabel={ __( 'Add question', 'vulocart' ) } onAdd={ () => update( { faqs: [ ...formData.faqs, { question: '', answer: '' } ] } ) }>
							<FaqEditor rows={ formData.faqs } onChange={ ( rows ) => update( { faqs: rows } ) } />
						</ContentBlock>

						<ContentBlock title={ __( 'Translations', 'vulocart' ) } action={ aiSlot( 'translation' ) }>
							<TranslationsEditor translations={ formData.translations } onChange={ ( translations ) => update( { translations } ) } />
						</ContentBlock>
					</CardComponent>

					{ null !== id && (
						<div className="vulocart-edit-extra-sections">
							<EmbedCodeSection productId={ id } />
							{ applyFilters( 'vulocart_product_edit_sections', null, { id, type: formData.type, subtype: subtype.value, shippable: cards.shipping } ) }
						</div>
					) }

					{ /* Same cards on a new product; the ones that need a saved product are shown locked. */ }
					{ null === id && (
						<div className="vulocart-edit-extra-sections">
							{ [
								{
									key: 'embed',
									title: __( 'Embed code', 'vulocart' ),
									desc: __( 'Sell this product anywhere - a landing page, a Next.js app, plain HTML - with the VuloCart SDK.', 'vulocart' ),
									icon: 'code',
								},
								...( applyFilters( 'vulocart_product_pending_sections', [], { type: formData.type, subtype: subtype.value, shippable: cards.shipping } ) as { key: string; title: string; desc: string; icon?: string }[] ),
							].map( ( section ) => (
								<CardComponent key={ section.key } titleIcon={ section.icon } title={ section.title } desc={ section.desc }>
									<p className="vulocart-field-hint vulocart-locked-note">
										<i className="adminfont-lock" aria-hidden="true" /> { __( 'Available once you create the product.', 'vulocart' ) }
									</p>
								</CardComponent>
							) ) }
						</div>
					) }
				</div>

				{ /* Side column */ }
				<div className="vulocart-product-edit-col vulocart-product-edit-col--right">
					<aside className="vulocart-preview" aria-label={ __( 'Storefront preview', 'vulocart' ) }>
						<div className="vulocart-preview-media">
							{ formData.featuredImage?.url ? (
								<img src={ formData.featuredImage.url } alt="" />
							) : (
								<div className="vulocart-preview-placeholder" aria-hidden="true">
									<i className="adminfont-image" />
								</div>
							) }
							<div className="vulocart-preview-badges">
								<span className="vulocart-preview-badge">{ formData.type.replace( '_', ' ' ) }</span>
								{ formData.featured && (
									<span className="vulocart-preview-badge is-featured">
										<i className="adminfont-star" aria-hidden="true" /> { __( 'Featured', 'vulocart' ) }
									</span>
								) }
							</div>
							{ previewDiscount > 0 && <span className="vulocart-preview-discount">-{ previewDiscount }%</span> }
						</div>
						<div className="vulocart-preview-body">
							<h3>{ formData.title || __( 'Untitled product', 'vulocart' ) }</h3>
							<p>{ formData.shortDescription || __( 'Your short description appears here.', 'vulocart' ) }</p>
							<div className="vulocart-preview-price">
								{ previewPrice ? (
									previewSale && previewDiscount > 0 ? (
										<>
											<strong>{ formatMoney( previewSale ) }</strong>
											<s>{ formatMoney( previewPrice ) }</s>
										</>
									) : (
										<strong>{ formatMoney( previewPrice ) }</strong>
									)
								) : (
									<span>{ __( 'No price yet', 'vulocart' ) }</span>
								) }
							</div>
							{ cards.inventory && (
								<span className={ `vulocart-preview-stock is-${ formData.stockStatus }` }>
									<i aria-hidden="true" />
									{ STOCK_STATUS_OPTIONS.find( ( option ) => option.value === formData.stockStatus )?.label }
								</span>
							) }
						</div>
						<footer>
							<i className="adminfont-eye" aria-hidden="true" /> { __( 'Live preview - updates as you type', 'vulocart' ) }
						</footer>
					</aside>

					<CardComponent titleIcon="image" title={ __( 'Images', 'vulocart' ) }>
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

						<h4 className="vulocart-subsection-title">{ __( 'Product gallery', 'vulocart' ) }</h4>
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

					<CardComponent
						titleIcon="category"
						title={ __( 'Catalog & Sourcing', 'vulocart' ) }
						desc={ __( 'Where this product appears in your store, how it\'s tagged, and who supplies it.', 'vulocart' ) }
					>
						<TermPicker
							label={ __( 'Category', 'vulocart' ) }
							noun={ __( 'category', 'vulocart' ) }
							plural={ __( 'categories', 'vulocart' ) }
							options={ categoryOptions }
							value={ formData.categories }
							onChange={ ( values ) => update( { categories: values } ) }
							onCreate={ createCategory }
						/>

						<TermPicker
							label={ __( 'Tags', 'vulocart' ) }
							noun={ __( 'tag', 'vulocart' ) }
							plural={ __( 'tags', 'vulocart' ) }
							options={ tagOptions }
							value={ formData.tags }
							onChange={ ( values ) => update( { tags: values } ) }
							onCreate={ createTerm( 'tags', ( option ) => setTagOptions( ( current ) => [ ...current, { key: option.value, ...option } ] ) ) }
						/>

						<TermPicker
							single
							label={ __( 'Brand', 'vulocart' ) }
							noun={ __( 'brand', 'vulocart' ) }
							plural={ __( 'brands', 'vulocart' ) }
							options={ brandOptions }
							value={ formData.brand ? [ formData.brand ] : [] }
							onChange={ ( values ) => update( { brand: values[ 0 ] ?? '' } ) }
							onCreate={ createTerm( 'brands', ( option ) => setBrandOptions( ( current ) => [ ...current, option ] ) ) }
						/>

						<TermPicker
							label={ __( 'Collections', 'vulocart' ) }
							noun={ __( 'collection', 'vulocart' ) }
							plural={ __( 'collections', 'vulocart' ) }
							options={ collectionOptions }
							value={ formData.collections }
							onChange={ ( values ) => update( { collections: values } ) }
							onCreate={ createTerm( 'collections', ( option ) => setCollectionOptions( ( current ) => [ ...current, { key: option.value, ...option } ] ) ) }
						/>

						{ applyFilters( 'vulocart_product_organization_fields', null, { id, TermPicker } ) }
					</CardComponent>
				</div>
			</div>
		</div>
	);
}

export default ProductEdit;
