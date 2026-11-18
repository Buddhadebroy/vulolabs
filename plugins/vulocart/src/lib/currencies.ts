import { __ } from '@wordpress/i18n';

/**
 * The currencies a store or product can be priced in: Settings → General's store currency and the product
 * editor's currency picker both read this list, so they always offer the same codes.
 */
export const CURRENCIES: { code: string; name: string }[] = [
	{ code: 'USD', name: __( 'US dollar', 'vulocart' ) },
	{ code: 'EUR', name: __( 'Euro', 'vulocart' ) },
	{ code: 'GBP', name: __( 'British pound', 'vulocart' ) },
	{ code: 'INR', name: __( 'Indian rupee', 'vulocart' ) },
	{ code: 'AUD', name: __( 'Australian dollar', 'vulocart' ) },
	{ code: 'CAD', name: __( 'Canadian dollar', 'vulocart' ) },
	{ code: 'JPY', name: __( 'Japanese yen', 'vulocart' ) },
	{ code: 'CNY', name: __( 'Chinese yuan', 'vulocart' ) },
	{ code: 'CHF', name: __( 'Swiss franc', 'vulocart' ) },
	{ code: 'SGD', name: __( 'Singapore dollar', 'vulocart' ) },
	{ code: 'HKD', name: __( 'Hong Kong dollar', 'vulocart' ) },
	{ code: 'NZD', name: __( 'New Zealand dollar', 'vulocart' ) },
	{ code: 'AED', name: __( 'UAE dirham', 'vulocart' ) },
	{ code: 'SAR', name: __( 'Saudi riyal', 'vulocart' ) },
	{ code: 'BRL', name: __( 'Brazilian real', 'vulocart' ) },
	{ code: 'MXN', name: __( 'Mexican peso', 'vulocart' ) },
	{ code: 'ZAR', name: __( 'South African rand', 'vulocart' ) },
	{ code: 'SEK', name: __( 'Swedish krona', 'vulocart' ) },
	{ code: 'NOK', name: __( 'Norwegian krone', 'vulocart' ) },
	{ code: 'DKK', name: __( 'Danish krone', 'vulocart' ) },
	{ code: 'PLN', name: __( 'Polish zloty', 'vulocart' ) },
	{ code: 'TRY', name: __( 'Turkish lira', 'vulocart' ) },
	{ code: 'KRW', name: __( 'South Korean won', 'vulocart' ) },
	{ code: 'IDR', name: __( 'Indonesian rupiah', 'vulocart' ) },
	{ code: 'MYR', name: __( 'Malaysian ringgit', 'vulocart' ) },
	{ code: 'PHP', name: __( 'Philippine peso', 'vulocart' ) },
	{ code: 'THB', name: __( 'Thai baht', 'vulocart' ) },
	{ code: 'NGN', name: __( 'Nigerian naira', 'vulocart' ) },
];

/** The currency's sign in the admin's language ("$", "€", "₹"), or the code itself when it has no sign of its own. */
export function currencySymbol( code: string ): string {
	try {
		const part = new Intl.NumberFormat( document.documentElement.lang || 'en', { style: 'currency', currency: code, currencyDisplay: 'narrowSymbol' } )
			.formatToParts( 0 )
			.find( ( piece ) => 'currency' === piece.type );

		return part?.value || code;
	} catch {
		return code;
	}
}

/** "$ USD - US dollar"; a currency whose sign is just its code shows it once ("CHF - Swiss franc"). */
export function currencyLabel( code: string, name: string ): string {
	const symbol = currencySymbol( code );

	return symbol === code ? `${ code } - ${ name }` : `${ symbol } ${ code } - ${ name }`;
}
