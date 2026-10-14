import { __, _n, sprintf } from '@wordpress/i18n';

/**
 * The price shape the REST API returns for a product's `meta.prices` and for a cart/order line's `price`. Shared
 * between the admin editor and the storefront blocks so "every month (4 payments)" reads the same everywhere.
 */
export interface PriceLike {
	type: string;
	interval?: string;
	interval_count?: number | string | null;
	payments?: number | string | null;
	trial_days?: number | string | null;
}

/** "every month", "every 3 weeks"; empty when there is no interval (a one-time price). */
export function intervalText( interval?: string, count?: number | string | null ): string {
	const n = Math.max( 1, Number( count ) || 1 );

	switch ( interval ) {
		case 'day':
			return sprintf( /* translators: %d: number of days. */ _n( 'every day', 'every %d days', n, 'vulocart' ), n );
		case 'week':
			return sprintf( /* translators: %d: number of weeks. */ _n( 'every week', 'every %d weeks', n, 'vulocart' ), n );
		case 'month':
			return sprintf( /* translators: %d: number of months. */ _n( 'every month', 'every %d months', n, 'vulocart' ), n );
		case 'year':
			return sprintf( /* translators: %d: number of years. */ _n( 'every year', 'every %d years', n, 'vulocart' ), n );
		default:
			return '';
	}
}

/**
 * The "how often" half of a price line: nothing for one-time, "every month" for a subscription, "every month
 * (4 payments)" for a payment plan. Unknown types fall back on whatever interval/payments they carry.
 */
export function billingText( price: PriceLike ): string {
	const every = intervalText( price.interval, price.interval_count );
	const payments = Number( price.payments ) || 0;

	if ( ! every ) {
		return '';
	}

	return payments > 0
		? sprintf( /* translators: 1: "every month", 2: number of payments. */ _n( '%1$s (%2$d payment)', '%1$s (%2$d payments)', payments, 'vulocart' ), every, payments )
		: every;
}

/** "Standard" when a price has no name - used wherever a price needs a heading. */
export function priceName( label?: string ): string {
	return label && label.trim() ? label : __( 'Standard', 'vulocart' );
}
