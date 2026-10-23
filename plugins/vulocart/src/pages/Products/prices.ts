import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';

/**
 * A product's prices as the editor holds them: every number a string (it is a form), `is_default` on exactly one.
 * Saved as `meta.prices` (see classes/Application/PriceCatalog.php for the stored shape and the PHP side of the
 * price-type registry).
 */
export interface EditablePrice {
	id: string;
	type: string;
	label: string;
	amount: string;
	sale_amount: string;
	interval: string;
	interval_count: string;
	payments: string;
	trial_days: string;
	is_default: boolean;
	active: boolean;
}

export interface PriceTypeField {
	key: 'interval' | 'interval_count' | 'payments' | 'trial_days';
	label: string;
	kind: 'number' | 'select';
	options?: { label: string; value: string }[];
	hint?: string;
}

/**
 * One kind of price. Free ships `one_time`; a plugin adds more through the `vulocart_product_price_types` filter,
 * e.g. vulocart-pro's Subscriptions adds `subscription` and `payment_plan`. `fields` are the inputs the type needs
 * beyond name/amount/sale; `defaults` seed a new price of that type.
 */
export interface PriceTypeDef {
	value: string;
	label: string;
	description: string;
	/** A CSS modifier for the type tag in a price row: `is-one-time`, `is-subscription`, ... */
	tone: string;
	fields: PriceTypeField[];
	defaults: Partial< EditablePrice >;
}

export const INTERVAL_OPTIONS = [
	{ label: __( 'Day', 'vulocart' ), value: 'day' },
	{ label: __( 'Week', 'vulocart' ), value: 'week' },
	{ label: __( 'Month', 'vulocart' ), value: 'month' },
	{ label: __( 'Year', 'vulocart' ), value: 'year' },
];

const ONE_TIME: PriceTypeDef = {
	value: 'one_time',
	label: __( 'One-time', 'vulocart' ),
	description: __( 'Customers pay once.', 'vulocart' ),
	tone: 'is-one-time',
	fields: [],
	defaults: { interval: '', interval_count: '1', payments: '', trial_days: '0' },
};

/** Every price type available right now - Free's own, plus whatever plugins registered. */
export function getPriceTypes(): PriceTypeDef[] {
	return applyFilters( 'vulocart_product_price_types', [ ONE_TIME ] ) as PriceTypeDef[];
}

/** Generates a random local id for a new price row. */
export function newPriceId(): string {
	return `price_${ Math.random().toString( 36 ).slice( 2, 10 ) }`;
}

/** Creates an empty price row of the given type, with optional overrides. */
export function newPrice( type: PriceTypeDef, overrides: Partial< EditablePrice > = {} ): EditablePrice {
	return {
		id: newPriceId(),
		type: type.value,
		label: '',
		amount: '',
		sale_amount: '',
		interval: '',
		interval_count: '1',
		payments: '',
		trial_days: '0',
		is_default: false,
		active: true,
		...type.defaults,
		...overrides,
	};
}

type RawPrice = Partial< Record< keyof EditablePrice, unknown > >;

/** A stored value as text, using the fallback when it is missing. */
const text = ( value: unknown, fallback = '' ): string => ( null === value || undefined === value ? fallback : String( value ) );

/** A stored flag as a boolean. Templates round-trip booleans through text, so `''`/`'0'` mean false; missing means `fallback`. */
const flag = ( value: unknown, fallback: boolean ): boolean => {
	if ( undefined === value || null === value ) {
		return fallback;
	}

	return ! ( false === value || '' === value || '0' === value || 0 === value || 'false' === value );
};

/** Reads `meta.prices` (or, for a product that has none, its single price/sale price) into editable form. */
export function toEditablePrices( raw: unknown, fallbackAmount: unknown, fallbackSale: unknown ): EditablePrice[] {
	if ( Array.isArray( raw ) && raw.length > 0 ) {
		const list = raw.map( ( entry: RawPrice ) => ( {
			id: text( entry.id, newPriceId() ),
			type: text( entry.type, 'one_time' ),
			label: text( entry.label ),
			amount: text( entry.amount ),
			sale_amount: text( entry.sale_amount ),
			interval: text( entry.interval ),
			interval_count: text( entry.interval_count, '1' ),
			payments: text( entry.payments ),
			trial_days: text( entry.trial_days, '0' ),
			is_default: flag( entry.is_default, false ),
			active: flag( entry.active, true ),
		} ) );

		return list.some( ( price ) => price.is_default ) ? list : list.map( ( price, index ) => ( { ...price, is_default: 0 === index } ) );
	}

	return [ newPrice( ONE_TIME, { id: 'default', amount: text( fallbackAmount ), sale_amount: text( fallbackSale ), is_default: true } ) ];
}

/** The price a bare "price" field stands for - the default one. */
export function defaultPrice( prices: EditablePrice[] ): EditablePrice {
	return prices.find( ( price ) => price.is_default && price.active ) ?? prices.find( ( price ) => price.active ) ?? prices[ 0 ];
}

/** What gets sent to the API: numbers as numbers, empty sale/payments as null. */
export function toPayloadPrice( price: EditablePrice ) {
	return {
		id: price.id,
		type: price.type,
		label: price.label,
		amount: Number( price.amount ) || 0,
		sale_amount: price.sale_amount ? Number( price.sale_amount ) : null,
		interval: price.interval,
		interval_count: Number( price.interval_count ) || 1,
		payments: price.payments ? Number( price.payments ) : null,
		trial_days: Number( price.trial_days ) || 0,
		is_default: price.is_default,
		active: price.active,
	};
}

/** A problem with one price, in words - or '' when it is fine. */
export function priceProblem( price: EditablePrice, type: PriceTypeDef | undefined ): string {
	const amount = Number( price.amount );
	const sale = Number( price.sale_amount );

	if ( price.sale_amount && amount > 0 && sale >= amount ) {
		return __( 'The sale price must be lower than the regular price.', 'vulocart' );
	}

	if ( type?.fields.some( ( field ) => 'interval' === field.key ) && ! price.interval ) {
		return __( 'Choose how often this price is billed.', 'vulocart' );
	}

	if ( type?.fields.some( ( field ) => 'payments' === field.key ) && ! ( Number( price.payments ) > 0 ) ) {
		return __( 'Enter how many payments make up this plan.', 'vulocart' );
	}

	return '';
}
