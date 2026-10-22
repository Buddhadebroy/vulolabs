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

/** Product page: send a review to the public reviews route; it appears once approved. */
( function () {
	'use strict';

	document.addEventListener( 'submit', function ( event ) {
		var form = event.target.closest && event.target.closest( '[data-vulocart-review]' );

		if ( ! form ) {
			return;
		}

		event.preventDefault();

		var data = window.vulocartFrontendData || {};
		var status = form.querySelector( '.vulocart-review-form__status' );
		var button = form.querySelector( 'button[type="submit"]' );
		var body = { product_id: Number( form.dataset.productId ) };

		Array.prototype.forEach.call( new FormData( form ).entries(), function ( pair ) {
			body[ pair[ 0 ] ] = pair[ 1 ];
		} );
		body.rating = Number( body.rating );

		button.disabled = true;
		status.textContent = '';

		fetch( data.apiUrl + '/' + data.restUrl + '/reviews', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify( body ),
		} )
			.then( function ( response ) {
				if ( ! response.ok ) {
					return response.json().then( function ( error ) {
						throw new Error( error && error.message ? error.message : '' );
					} );
				}

				form.reset();
				status.textContent = status.dataset.sent;
				status.classList.add( 'is-success' );
			} )
			.catch( function ( error ) {
				status.classList.remove( 'is-success' );
				status.textContent = error.message || status.dataset.error;
			} )
			.then( function () {
				button.disabled = false;
			} );
	} );
}() );

/** Shopper tools: recently viewed, share and compare. */
( function () {
	'use strict';

	var data = window.vulocartFrontendData || {};
	var RECENT = 'vulocart_recent';
	var COMPARE = 'vulocart_compare';

	function api( path, options ) {
		return fetch( data.apiUrl + '/' + data.restUrl + path, options ).then( function ( response ) {
			if ( ! response.ok ) {
				return response.json().then( function ( error ) {
					throw new Error( error && error.message ? error.message : '' );
				} );
			}

			return response.json();
		} );
	}

	function list( key ) {
		try {
			var value = JSON.parse( window.localStorage.getItem( key ) || '[]' );

			return Array.isArray( value ) ? value.map( Number ).filter( Boolean ) : [];
		} catch ( e ) {
			return [];
		}
	}

	function save( key, value ) {
		try {
			window.localStorage.setItem( key, JSON.stringify( value ) );
		} catch ( e ) {}
	}

	// Recently viewed: remember this product, then show the others.
	var page = document.querySelector( '.vulocart-product-details[data-product-id]' );

	if ( page ) {
		var id = Number( page.dataset.productId );

		save( RECENT, [ id ].concat( list( RECENT ).filter( function ( other ) { return other !== id; } ) ).slice( 0, 12 ) );
	}

	Array.prototype.forEach.call( document.querySelectorAll( '[data-vulocart-recent]' ), function ( block ) {
		var skip = Number( block.dataset.exclude );
		var ids = list( RECENT ).filter( function ( other ) { return other !== skip; } ).slice( 0, Number( block.dataset.count ) );

		if ( ! ids.length ) {
			return;
		}

		api( '/storefront/cards?ids=' + ids.join( ',' ) + '&columns=' + block.dataset.columns ).then( function ( result ) {
			if ( result.html ) {
				block.querySelector( '[data-cards]' ).innerHTML = result.html;
				block.hidden = false;
			}
		} ).catch( function () {} );
	} );

	document.addEventListener( 'click', function ( event ) {
		var target = event.target;

		// Share: copy the link, or open the device's share sheet.
		var share = target.closest && target.closest( '[data-vulocart-share]' );

		if ( share && target.closest( '[data-copy]' ) ) {
			var button = target.closest( '[data-copy]' );
			var text = button.textContent;

			( navigator.clipboard ? navigator.clipboard.writeText( share.dataset.url ) : Promise.reject() )
				.then( function () {
					button.textContent = button.dataset.done;
					window.setTimeout( function () { button.textContent = text; }, 2000 );
				} )
				.catch( function () {} );
		}

		if ( share && target.closest( '[data-native]' ) ) {
			navigator.share( { title: share.dataset.title, url: share.dataset.url } ).catch( function () {} );
		}
	} );

	Array.prototype.forEach.call( document.querySelectorAll( '[data-vulocart-share] [data-native]' ), function ( button ) {
		button.hidden = ! navigator.share;
	} );

	// Compare: up to four products, kept in the browser; a bar links to the Compare page.
	function bar() {
		var ids = list( COMPARE );
		var existing = document.querySelector( '.vulocart-compare-bar' );

		if ( ! data.compareUrl || ! ids.length || document.querySelector( '[data-vulocart-compare-page]' ) ) {
			if ( existing ) {
				existing.remove();
			}

			return;
		}

		if ( ! existing ) {
			existing = document.createElement( 'a' );
			existing.className = 'vulocart-compare-bar wp-element-button';
			document.body.appendChild( existing );
		}

		existing.href = data.compareUrl;
		existing.textContent = ( data.compareLabel || 'Compare' ) + ' (' + ids.length + ')';
	}

	function paint() {
		var ids = list( COMPARE );

		Array.prototype.forEach.call( document.querySelectorAll( '[data-vulocart-compare]' ), function ( box ) {
			box.checked = ids.indexOf( Number( box.dataset.vulocartCompare ) ) !== -1;
		} );
		bar();
	}

	document.addEventListener( 'change', function ( event ) {
		var box = event.target.closest && event.target.closest( '[data-vulocart-compare]' );

		if ( ! box ) {
			return;
		}

		var id = Number( box.dataset.vulocartCompare );
		var ids = list( COMPARE ).filter( function ( other ) { return other !== id; } );

		if ( box.checked ) {
			ids.push( id );
		}

		save( COMPARE, ids.slice( -4 ) );
		paint();
	} );

	function comparePage() {
		var root = document.querySelector( '[data-vulocart-compare-page]' );

		if ( ! root ) {
			return;
		}

		var ids = list( COMPARE );
		var empty = root.querySelector( '[data-empty]' );
		var table = root.querySelector( '[data-table]' );

		if ( ! ids.length ) {
			table.innerHTML = '';
			empty.hidden = false;

			return;
		}

		api( '/storefront/compare?ids=' + ids.join( ',' ) ).then( function ( result ) {
			table.innerHTML = result.html;
			empty.hidden = !! result.html;
		} ).catch( function () {} );
	}

	document.addEventListener( 'click', function ( event ) {
		var remove = event.target.closest && event.target.closest( '.vulocart-compare__remove' );

		if ( remove ) {
			var id = Number( remove.dataset.remove );

			save( COMPARE, list( COMPARE ).filter( function ( other ) { return other !== id; } ) );
			comparePage();
		}
	} );

	paint();
	comparePage();
}() );
