/**
 * VuloCart storefront - progressive enhancement for the shop blocks.
 *
 * The blocks work without this file (filters submit with Enter, product links are plain links); it adds
 * auto-submitting filters and the in-place "Add to cart" button. Plain JavaScript on purpose: no build step, no
 * framework, a few hundred bytes of work on a page that is otherwise server-rendered.
 */
( function () {
	'use strict';

	var TOKEN_KEY = 'vulocart_cart_token'; // Shared with the checkout block, so both see the same cart.

	function cartToken() {
		try {
			var existing = window.localStorage.getItem( TOKEN_KEY );

			if ( existing ) {
				return existing;
			}

			var token =
				window.crypto && window.crypto.randomUUID
					? window.crypto.randomUUID()
					: 'vulocart-' + Date.now() + '-' + Math.random().toString( 16 ).slice( 2 );

			window.localStorage.setItem( TOKEN_KEY, token );

			return token;
		} catch ( e ) {
			return 'vulocart-' + Date.now();
		}
	}

	function config() {
		return window.vulocartFrontendData || {};
	}

	function addToCart( button, afterAdd ) {
		var data = config();
		var label = button.textContent;

		button.classList.add( 'is-loading' );
		button.setAttribute( 'aria-busy', 'true' );

		var body = { product_id: Number( button.dataset.productId ), quantity: 1 };
		var purchase = button.closest( '.vulocart-purchase' );

		if ( button.dataset.priceId ) {
			body.price_id = button.dataset.priceId;
		}

		// On a product page the shopper's price option and quantity win.
		if ( purchase ) {
			var chosen = purchase.querySelector( 'input[name="vc_price"]:checked' );
			var qty = purchase.querySelector( 'input[name="vc_qty"]' );

			if ( chosen ) {
				body.price_id = chosen.value;
			}

			if ( qty ) {
				body.quantity = Math.max( 1, Math.min( 99, parseInt( qty.value, 10 ) || 1 ) );
			}
		}

		fetch( data.apiUrl + '/' + data.restUrl + '/cart/items', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'X-Cart-Token': cartToken() },
			body: JSON.stringify( body ),
		} )
			.then( function ( response ) {
				if ( ! response.ok ) {
					throw new Error( 'cart' );
				}

				return response.json();
			} )
			.then( function ( cart ) {
				button.classList.remove( 'is-loading' );
				window.dispatchEvent( new CustomEvent( 'vulocart:cart-updated', { detail: cart } ) );

				// "Buy now": straight on to checkout, in whichever style the store uses.
				if ( afterAdd ) {
					afterAdd();

					return;
				}

				button.classList.add( 'is-added' );
				button.textContent = '✓ ' + button.dataset.addedLabel;
				showCheckoutLink( button );

				window.setTimeout( function () {
					button.classList.remove( 'is-added' );
					button.textContent = label;
				}, 2200 );
			} )
			.catch( function () {
				button.classList.remove( 'is-loading' );
				button.textContent = label;
				var card = button.closest( '.vulocart-product' );

				if ( card ) {
					window.location.href = card.querySelector( 'a[href]' ).href;
				}
			} )
			.then( function () {
				button.removeAttribute( 'aria-busy' );
			} );
	}

	/** A "Checkout" link under the button once something is in the cart (announced politely). */
	function showCheckoutLink( button ) {
		var data = config();
		var holder = button.closest( '.vulocart-add' );

		var target = data.cartPageUrl || data.checkoutPageUrl;

		if ( ! target || ! holder || holder.querySelector( '.vulocart-add__next' ) ) {
			return;
		}

		var note = document.createElement( 'span' );
		var link = document.createElement( 'a' );

		note.className = 'vulocart-add__next';
		note.setAttribute( 'role', 'status' );
		link.href = target;
		link.textContent = ( window.wp && window.wp.i18n ? window.wp.i18n.__( 'View cart →', 'vulocart' ) : 'View cart →' );
		note.appendChild( link );
		holder.appendChild( note );
	}

	document.addEventListener( 'click', function ( event ) {
		var buyNow = event.target.closest && event.target.closest( '[data-vulocart-buy-now]' );

		if ( buyNow ) {
			event.preventDefault();
			addToCart( buyNow, function () {
				buyNow.textContent = buyNow.dataset.label || buyNow.textContent;
				window.vulocartStorefront.launch( config().checkoutPageUrl );
			} );

			return;
		}

		var button = event.target.closest && event.target.closest( '[data-vulocart-add]' );

		if ( button ) {
			event.preventDefault();
			addToCart( button );
		}
	} );

	document.addEventListener( 'change', function ( event ) {
		var select = event.target;

		if ( select.matches && select.matches( '[data-vulocart-autosubmit]' ) && select.form ) {
			// A new filter starts again from page one; empty values are dropped so the URL stays clean.
			Array.prototype.forEach.call( select.form.elements, function ( field ) {
				if ( field.name && '' === field.value ) {
					field.disabled = true;
				}
			} );
			select.form.submit();
		}
	} );
}() );

/** A product photo that fails to load (deleted file, bad URL) falls back to the placeholder instead of a broken icon. */
( function () {
	'use strict';

	var placeholder =
		'<span class="vulocart-product-image__placeholder" aria-hidden="true"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="1.6"/><path d="m21 15-4.5-4.5L8 19"/></svg></span>';

	function swap( img ) {
		var link = img.parentNode;

		if ( link && img.closest && img.closest( '.vulocart-product-image' ) ) {
			link.innerHTML = placeholder;
		}
	}

	document.addEventListener( 'error', function ( event ) {
		if ( event.target && 'IMG' === event.target.tagName ) {
			swap( event.target );
		}
	}, true );

	Array.prototype.forEach.call( document.querySelectorAll( '.vulocart-product-image img' ), function ( img ) {
		if ( img.complete && 0 === img.naturalWidth ) {
			swap( img );
		}
	} );
}() );

/** Product page: quantity stepper and gallery thumbnails. */
( function () {
	'use strict';

	document.addEventListener( 'click', function ( event ) {
		var step = event.target.closest && event.target.closest( '[data-vulocart-qty]' );

		if ( step ) {
			var input = step.parentNode.querySelector( 'input[name="vc_qty"]' );
			var next = ( parseInt( input.value, 10 ) || 1 ) + Number( step.dataset.vulocartQty );

			input.value = Math.max( parseInt( input.min, 10 ) || 1, Math.min( parseInt( input.max, 10 ) || 99, next ) );

			return;
		}

		var thumb = event.target.closest && event.target.closest( '[data-vulocart-thumb]' );

		if ( thumb ) {
			var gallery = thumb.closest( '.vulocart-gallery' );
			var main = gallery.querySelector( '[data-vulocart-gallery-main]' );

			event.preventDefault();
			main.removeAttribute( 'srcset' );
			main.removeAttribute( 'sizes' );
			main.src = thumb.dataset.src;
			Array.prototype.forEach.call( gallery.querySelectorAll( '[data-vulocart-thumb]' ), function ( other ) {
				other.classList.toggle( 'is-active', other === thumb );
				other.toggleAttribute( 'aria-current', other === thumb );
			} );
		}
	} );
}() );
