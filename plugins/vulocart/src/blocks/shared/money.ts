/**
 * Formats an amount for display with the browser's own currency rules ($1,234.50, €1.234,50, ¥1,235) - one
 * formatter for every storefront surface, so a price reads the same in the cart, the checkout and the receipt.
 * Falls back to "amount CODE" for a currency code the browser doesn't know.
 */
export function formatMoney( amount: number, currency: string | null | undefined ): string {
	const value = Number( amount ) || 0;

	try {
		return new Intl.NumberFormat( document.documentElement.lang || undefined, { style: 'currency', currency: currency || 'USD' } ).format( value );
	} catch {
		return `${ value } ${ currency ?? '' }`.trim();
	}
}
