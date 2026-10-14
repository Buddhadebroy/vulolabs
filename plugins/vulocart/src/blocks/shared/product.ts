import { __ } from '@wordpress/i18n';

/**
 * Shared between `src/blocks/products/`'s listing and detail views -
 * the public-storefront-facing shape of `GET /products`/`GET /products/{id}`
 * (classes/RestAPI/Controllers/Products.php's `prepare_product_for_response()`).
 * `meta` is typed loosely (`Record<string, unknown>`) rather than
 * exhaustively, same tradeoff `ProductEdit.tsx` (the admin equivalent)
 * already accepts - the meta bag's real shape varies per product type
 * (`TYPE_FIELD_CONFIG`), and this file only needs a handful of common
 * keys out of it, not the full per-type field list.
 */
export interface MediaItem {
	id: number;
	url: string;
}

/** One price a product can be bought at, as the public API returns it (classes/RestAPI/Controllers/Products.php). */
export interface StorePrice {
	id: string;
	type: string;
	label: string;
	amount: number;
	sale_amount: number | null;
	interval: string;
	interval_count: number;
	payments: number | null;
	trial_days: number;
	is_default: boolean;
	active: boolean;
	/** What it charges now: the sale amount when that is lower. */
	display_amount: number;
	/** Whether the cart will accept it (active, and its type's plugin is on). */
	purchasable: boolean;
}

export interface ProductSummary {
	id: number;
	type: string;
	title: string;
	slug: string | null;
	sku: string | null;
	status: string;
	price: number | null;
	currency: string | null;
	prices?: StorePrice[];
	meta: {
		sale_price?: number | null;
		short_description?: string;
		full_description?: string;
		stock_management?: boolean;
		stock_status?: 'in_stock' | 'out_of_stock' | 'backorder';
		catalog_visibility?: 'shop_and_search' | 'shop_only' | 'search_only' | 'hidden';
		featured_image?: MediaItem | null;
		gallery?: MediaItem[];
		categories?: string[];
		tags?: string[];
		type_details?: Record< string, unknown >;
		specifications?: { key: string; value: string }[];
		faqs?: { question: string; answer: string }[];
	};
	created_at: string;
	updated_at: string;
}

/**
 * Whether a product should appear in the public listing grid -
 * `hidden`/`search_only` are excluded (this codebase has no search
 * feature yet for `search_only` to have anywhere else to surface), same
 * as WooCommerce's own catalog-visibility semantics: still directly
 * reachable via its own `?product={id}` link either way, just not
 * listed.
 */
export function isVisibleInListing( product: ProductSummary ): boolean {
	const visibility = product.meta?.catalog_visibility ?? 'shop_and_search';
	return 'hidden' !== visibility && 'search_only' !== visibility;
}

/** The prices a visitor can actually buy, default first. Empty for a product with none (or none purchasable). */
export function purchasablePrices( product: ProductSummary ): StorePrice[] {
	return ( product.prices ?? [] )
		.filter( ( price ) => price.purchasable )
		.sort( ( a, b ) => Number( b.is_default ) - Number( a.is_default ) );
}

export function formatAmount( amount: number, currency: string | null ): string {
	return `${ amount } ${ currency ?? '' }`.trim();
}

/**
 * The price shown on a card or heading: the default price's, or "From X" when several prices can be bought at
 * different amounts. Falls back to the plain price columns for a product the API returned no `prices` for.
 */
export function formatPrice( product: ProductSummary ): string | null {
	const buyable = purchasablePrices( product );

	if ( buyable.length > 0 ) {
		const lowest = Math.min( ...buyable.map( ( price ) => price.display_amount ) );
		const shown = formatAmount( buyable[ 0 ].display_amount, product.currency );

		return buyable.some( ( price ) => price.display_amount !== buyable[ 0 ].display_amount )
			? `${ __( 'From', 'vulocart' ) } ${ formatAmount( lowest, product.currency ) }`
			: shown;
	}

	const price = product.meta?.sale_price ?? product.price;

	if ( null === price || undefined === price ) {
		return null;
	}

	return formatAmount( price, product.currency );
}

/**
 * `booking_slot` -> `Booking slot` - used to render `meta.type_details`
 * entries on the detail page without needing to duplicate
 * ProductEdit.tsx's full `TYPE_FIELD_CONFIG` label list on the public
 * side too.
 */
export function humanizeKey( key: string ): string {
	const words = key.replace( /_/g, ' ' );
	return words.charAt( 0 ).toUpperCase() + words.slice( 1 );
}
