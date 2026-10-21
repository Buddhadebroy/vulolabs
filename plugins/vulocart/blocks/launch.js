/**
 * VuloCart storefront - where "Proceed to checkout" and "Buy now" lead.
 *
 * `vulocartFrontendData.checkoutDelivery` says how this store checks out: the Checkout page (`page`), or one of
 * vulocart-pro's styles - a popup, a side drawer, a hosted page, one-click. The cart, the shop's "Buy now" buttons
 * and any custom button call `window.vulocartStorefront.launch()`, so every entry point behaves the same. Pro's
 * storefront script registers the popup / drawer / one-click openers on `window.vulocartCheckoutLauncher`; if one is
 * missing (Pro switched off, script blocked) the shopper simply lands on the Checkout page.
 */
( function () {
	'use strict';

	var TOKEN_KEY = 'vulocart_cart_token';

	function config() {
		return window.vulocartFrontendData || {};
	}

	function token() {
		try {
			return window.localStorage.getItem( TOKEN_KEY ) || '';
		} catch ( e ) {
			return '';
		}
	}

	window.vulocartStorefront = window.vulocartStorefront || {};

	/**
	 * @param {string} fallbackUrl The Checkout page, used when no special style applies or its opener is unavailable.
	 */
	window.vulocartStorefront.launch = function ( fallbackUrl ) {
		var data = config();
		var delivery = data.checkoutDelivery || 'page';
		var launcher = window.vulocartCheckoutLauncher || {};

		if ( 'hosted' === delivery && data.homeUrl && token() ) {
			window.location.href = data.homeUrl.replace( /\/$/, '' ) + '/checkout/hosted/' + encodeURIComponent( token() ) + '/';

			return;
		}

		if ( 'page' !== delivery && 'function' === typeof launcher[ delivery ] ) {
			launcher[ delivery ]();

			return;
		}

		if ( fallbackUrl ) {
			window.location.href = fallbackUrl;
		}
	};
}() );
