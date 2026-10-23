/**
 * VuloCart storefront - the Cart block and the Cart Link (mini cart) block.
 *
 * The cart belongs to a token the shopper's browser holds, so it is drawn here from the public cart API rather than
 * on the server. Plain JavaScript like view.js: no framework, no build step. Every user-facing string goes through
 * wp.i18n, and every value is set with textContent / attributes (never innerHTML), so product titles can't inject markup.
 */
( function () {
	'use strict';

	var i18n = window.wp && window.wp.i18n ? window.wp.i18n : { __: function ( s ) { return s; }, _n: function ( a, b, n ) { return 1 === n ? a : b; }, sprintf: function ( f ) { return f; } };
	var __ = i18n.__;
	var _n = i18n._n;
	var sprintf = i18n.sprintf;
	var TOKEN_KEY = 'vulocart_cart_token';

	function config() {
		return window.vulocartFrontendData || {};
	}

	function storedToken() {
		try {
			return window.localStorage.getItem( TOKEN_KEY ) || '';
		} catch ( e ) {
			return '';
		}
	}

	function token() {
		var existing = storedToken();

		if ( existing ) {
			return existing;
		}

		var fresh = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : 'vulocart-' + Date.now() + '-' + Math.random().toString( 16 ).slice( 2 );

		try {
			window.localStorage.setItem( TOKEN_KEY, fresh );
		} catch ( e ) {
			// No storage: the cart just won't persist.
		}

		return fresh;
	}

	function api( path, options ) {
		var data = config();
		var init = options || {};

		init.headers = Object.assign( { 'Content-Type': 'application/json', 'X-Cart-Token': token() }, init.headers || {} );

		return fetch( data.apiUrl + '/' + data.restUrl + path, init ).then( function ( response ) {
			if ( ! response.ok ) {
				throw new Error( 'HTTP ' + response.status );
			}

			return response.json();
		} );
	}

	function money( amount, currency ) {
		try {
			return new Intl.NumberFormat( document.documentElement.lang || undefined, { style: 'currency', currency: currency || 'USD' } ).format( amount );
		} catch ( e ) {
			return amount + ' ' + ( currency || '' );
		}
	}

	/** Tiny DOM builder: h( 'a', { href }, child, 'text', ... ). */
	function h( tag, props ) {
		var node = document.createElement( tag );

		Object.keys( props || {} ).forEach( function ( key ) {
			var value = props[ key ];

			if ( null === value || undefined === value || false === value ) {
				return;
			}

			if ( 'className' === key ) {
				node.className = value;
			} else if ( 'text' === key ) {
				node.textContent = value;
			} else if ( 0 === key.indexOf( 'on' ) ) {
				node.addEventListener( key.slice( 2 ).toLowerCase(), value );
			} else {
				node.setAttribute( key, true === value ? '' : value );
			}
		} );

		Array.prototype.slice.call( arguments, 2 ).forEach( function add( child ) {
			if ( Array.isArray( child ) ) {
				child.forEach( add );
			} else if ( null !== child && undefined !== child && false !== child ) {
				node.appendChild( 'string' === typeof child ? document.createTextNode( child ) : child );
			}
		} );

		return node;
	}

	function icon( paths, size ) {
		var ns = 'http://www.w3.org/2000/svg';
		var svg = document.createElementNS( ns, 'svg' );

		svg.setAttribute( 'viewBox', '0 0 24 24' );
		svg.setAttribute( 'width', size || 20 );
		svg.setAttribute( 'height', size || 20 );
		svg.setAttribute( 'fill', 'none' );
		svg.setAttribute( 'stroke', 'currentColor' );
		svg.setAttribute( 'stroke-width', '1.75' );
		svg.setAttribute( 'stroke-linecap', 'round' );
		svg.setAttribute( 'stroke-linejoin', 'round' );
		svg.setAttribute( 'aria-hidden', 'true' );
		paths.forEach( function ( d ) {
			var path = document.createElementNS( ns, 'path' );

			path.setAttribute( 'd', d );
			svg.appendChild( path );
		} );

		return svg;
	}

	var BAG = [ 'M6 7h12l-1 13H7L6 7Z', 'M9 10V6a3 3 0 0 1 6 0v4' ];

	function intervalText( interval, count ) {
		var n = Math.max( 1, Number( count ) || 1 );
		var map = {
			day: [ __( 'every day', 'vulocart' ), __( 'every %d days', 'vulocart' ) ],
			week: [ __( 'every week', 'vulocart' ), __( 'every %d weeks', 'vulocart' ) ],
			month: [ __( 'every month', 'vulocart' ), __( 'every %d months', 'vulocart' ) ],
			year: [ __( 'every year', 'vulocart' ), __( 'every %d years', 'vulocart' ) ],
		};

		if ( ! map[ interval ] ) {
			return '';
		}

		return 1 === n ? map[ interval ][ 0 ] : sprintf( map[ interval ][ 1 ], n );
	}

	/** "Pack of 2 · every month (4 payments)" - what was chosen beyond the product itself. */
	function priceNote( price ) {
		if ( ! price ) {
			return '';
		}

		var every = intervalText( price.interval, price.interval_count );
		var payments = Number( price.payments ) || 0;

		if ( every && payments > 0 ) {
			every = sprintf( _n( '%1$s (%2$d payment)', '%1$s (%2$d payments)', payments, 'vulocart' ), every, payments );
		}

		return [ price.label, every ].filter( Boolean ).join( ' · ' );
	}

	/* ---------------------------------------------------------------- Cart block */

	function initCart( root ) {
		var data = config();
		var state = { cart: null, shipping: null, error: false, busy: false, focus: '' };
		var timers = {};
		var live = h( 'div', { className: 'screen-reader-text', role: 'status', 'aria-live': 'polite' } );

		root.appendChild( live );

		function announce( message ) {
			live.textContent = '';
			window.setTimeout( function () {
				live.textContent = message;
			}, 50 );
		}

		function emit() {
			window.dispatchEvent( new CustomEvent( 'vulocart:cart-updated', { detail: state.cart } ) );
		}

		function load() {
			return api( '/cart' )
				.then( function ( cart ) {
					state.cart = cart;
					state.error = false;
				} )
				.catch( function () {
					state.error = true;
				} )
				.then( function () {
					if ( state.cart && state.cart.items.length && null === state.shipping ) {
						return api( '/shipping/methods' )
							.then( function ( methods ) {
								state.shipping = methods.length
									? methods.reduce( function ( cheapest, method ) {
											return method.cost < cheapest.cost ? method : cheapest;
									  } )
									: false;
							} )
							.catch( function () {
								state.shipping = false;
							} );
					}
				} )
				.then( render );
		}

		function mutate( request, message ) {
			state.busy = true;
			root.classList.add( 'is-busy' );

			return request
				.then( function ( cart ) {
					state.cart = cart;
					state.error = false;
					emit();
					announce( message );
				} )
				.catch( function () {
					announce( __( 'Could not update your cart. Please try again.', 'vulocart' ) );
					return load();
				} )
				.then( function () {
					state.busy = false;
					root.classList.remove( 'is-busy' );
					render();
				} );
		}

		function setQuantity( item, quantity ) {
			state.focus = 'qty-' + item.id;

			if ( quantity <= 0 ) {
				return remove( item );
			}

			return mutate( api( '/cart/items/' + item.id, { method: 'PUT', body: JSON.stringify( { quantity: Math.min( 99, quantity ) } ) } ), sprintf( __( 'Quantity updated to %d.', 'vulocart' ), quantity ) );
		}

		function remove( item ) {
			state.focus = 'continue';

			return mutate( api( '/cart/items/' + item.id, { method: 'DELETE' } ), sprintf( __( '%s removed from your cart.', 'vulocart' ), item.title || '' ) );
		}

		function itemRow( item ) {
			var currency = item.currency || state.cart.currency;
			var note = priceNote( item.price );
			var title = item.title || __( 'Product', 'vulocart' );
			var link = data.shopUrl || root.dataset.shopUrl;
			var href = link ? link + ( link.indexOf( '?' ) > -1 ? '&' : '?' ) + 'product=' + item.product_id : '';
			var input = h( 'input', {
				type: 'number',
				min: 1,
				max: 99,
				value: item.quantity,
				inputmode: 'numeric',
				'aria-label': sprintf( __( 'Quantity of %s', 'vulocart' ), title ),
				'data-key': 'qty-' + item.id,
				onChange: function () {
					setQuantity( item, parseInt( input.value, 10 ) || 1 );
				},
			} );

			return h(
				'li',
				{ className: 'vulocart-cart-item' },
				h( 'a', { className: 'vulocart-cart-item__image', href: href || null, tabindex: '-1', 'aria-hidden': 'true' }, item.image ? h( 'img', { src: item.image, alt: '', loading: 'lazy' } ) : icon( [ 'M3 5h18v14H3z', 'M3 15l5-5 4 4 3-3 6 6' ], 28 ) ),
				h(
					'div',
					{ className: 'vulocart-cart-item__info' },
					href ? h( 'a', { className: 'vulocart-cart-item__title', href: href, text: title } ) : h( 'span', { className: 'vulocart-cart-item__title', text: title } ),
					note ? h( 'span', { className: 'vulocart-cart-item__note', text: note } ) : null,
					h( 'span', { className: 'vulocart-cart-item__unit', text: sprintf( __( '%s each', 'vulocart' ), money( item.unit_price, currency ) ) } ),
					h( 'button', { type: 'button', className: 'vulocart-cart-item__remove', 'data-key': 'remove-' + item.id, 'aria-label': sprintf( __( 'Remove %s', 'vulocart' ), title ), text: __( 'Remove', 'vulocart' ), onClick: function () { remove( item ); } } )
				),
				h(
					'div',
					{ className: 'vulocart-qty', role: 'group', 'aria-label': __( 'Quantity', 'vulocart' ) },
					h( 'button', { type: 'button', 'aria-label': __( 'Decrease quantity', 'vulocart' ), text: '−', onClick: function () { setQuantity( item, item.quantity - 1 ); } } ),
					input,
					h( 'button', { type: 'button', 'aria-label': __( 'Increase quantity', 'vulocart' ), text: '+', onClick: function () { setQuantity( item, item.quantity + 1 ); } } )
				),
				h( 'strong', { className: 'vulocart-cart-item__total', text: money( item.subtotal, currency ) } )
			);
		}

		function summary() {
			var cart = state.cart;
			var currency = cart.totals.currency || cart.currency;
			var rows = h( 'dl', { className: 'vulocart-cart-summary__rows' } );
			var estimate = state.shipping ? Number( state.shipping.cost ) : null;

			function row( label, value, className ) {
				rows.appendChild( h( 'div', { className: className || null }, h( 'dt', { text: label } ), h( 'dd', { text: value } ) ) );
			}

			row( __( 'Subtotal', 'vulocart' ), money( cart.totals.subtotal, currency ) );
			row( __( 'Shipping', 'vulocart' ), null !== estimate ? ( 0 === estimate ? __( 'Free', 'vulocart' ) : money( estimate, currency ) ) : __( 'Calculated at checkout', 'vulocart' ) );
			row( null !== estimate ? __( 'Estimated total', 'vulocart' ) : __( 'Total', 'vulocart' ), money( Number( cart.totals.total ) + ( estimate || 0 ), currency ), 'is-total' );

			var checkoutUrl = root.dataset.checkoutUrl;

			return h(
				'aside',
				{ className: 'vulocart-cart-summary', 'aria-label': __( 'Order summary', 'vulocart' ) },
				h( 'h2', { text: __( 'Order summary', 'vulocart' ) } ),
				rows,
				h( 'p', { className: 'vulocart-cart-summary__note', text: __( 'Taxes and any discounts are applied at checkout.', 'vulocart' ) } ),
				checkoutUrl ? h( 'a', { className: 'wp-element-button vulocart-cart-summary__checkout', href: checkoutUrl, text: __( 'Proceed to checkout', 'vulocart' ), onClick: function ( event ) {
						// A popup, drawer, hosted page or one-click checkout, when the store uses one.
						if ( window.vulocartStorefront && 'page' !== ( data.checkoutDelivery || 'page' ) ) {
							event.preventDefault();
							window.vulocartStorefront.launch( checkoutUrl );
						}
					} } ) : h( 'p', { className: 'vulocart-notice', text: __( 'Checkout is not set up yet.', 'vulocart' ) } ),
				root.dataset.shopUrl ? h( 'a', { className: 'vulocart-cart-summary__continue', 'data-key': 'continue', href: root.dataset.shopUrl, text: __( 'Continue shopping', 'vulocart' ) } ) : null
			);
		}

		function empty() {
			return h(
				'div',
				{ className: 'vulocart-cart__empty' },
				h( 'span', { className: 'vulocart-cart__empty-icon' }, icon( BAG, 36 ) ),
				h( 'h2', { text: __( 'Your cart is empty', 'vulocart' ) } ),
				h( 'p', { text: __( 'Looks like you haven\'t added anything yet.', 'vulocart' ) } ),
				root.dataset.shopUrl ? h( 'a', { className: 'wp-element-button', 'data-key': 'continue', href: root.dataset.shopUrl, text: __( 'Browse the shop', 'vulocart' ) } ) : null
			);
		}

		function render() {
			var cart = state.cart;
			var content;

			if ( state.error && ! cart ) {
				content = h( 'div', { className: 'vulocart-cart__empty' }, h( 'h2', { text: __( 'We couldn\'t load your cart', 'vulocart' ) } ), h( 'button', { type: 'button', className: 'wp-element-button', text: __( 'Try again', 'vulocart' ), onClick: load } ) );
			} else if ( ! cart || 0 === cart.items.length ) {
				content = empty();
			} else {
				var count = cart.items.reduce( function ( sum, item ) {
					return sum + item.quantity;
				}, 0 );

				content = h(
					'div',
					{ className: 'vulocart-cart__layout' },
					h(
						'section',
						{ className: 'vulocart-cart__items', 'aria-label': __( 'Cart items', 'vulocart' ) },
						h( 'p', { className: 'vulocart-cart__count', text: sprintf( _n( '%d item', '%d items', count, 'vulocart' ), count ) } ),
						h( 'ul', { className: 'vulocart-cart__list' }, cart.items.map( itemRow ) )
					),
					summary()
				);
			}

			while ( root.firstChild && root.firstChild !== live ) {
				root.removeChild( root.firstChild );
			}

			root.insertBefore( content, live );

			if ( state.focus ) {
				var target = root.querySelector( '[data-key="' + state.focus + '"]' );

				if ( target ) {
					target.focus();
				}

				state.focus = '';
			}
		}

		// The cart changed elsewhere (an order was placed in a checkout popup, another tab added something).
		window.addEventListener( 'vulocart:cart-updated', function ( event ) {
			if ( event.detail !== state.cart && ! state.busy ) {
				load();
			}
		} );
		window.addEventListener( 'storage', function ( event ) {
			if ( event.key === TOKEN_KEY ) {
				load();
			}
		} );

		root.classList.add( 'is-ready' );
		load().then( emit );
	}

	/* ----------------------------------------------------------------- Cart link */

	function initLinks() {
		var links = document.querySelectorAll( '[data-vulocart-cart-count]' );

		if ( ! links.length ) {
			return;
		}

		function paint( count ) {
			Array.prototype.forEach.call( links, function ( badge ) {
				badge.textContent = count > 99 ? '99+' : String( count );
				badge.hidden = count < 1;
				badge.parentNode.setAttribute( 'aria-label', count ? sprintf( _n( 'View cart, %d item', 'View cart, %d items', count, 'vulocart' ), count ) : __( 'View cart', 'vulocart' ) );
			} );
		}

		function refresh() {
			// Don't create a token (and a cart row) just because someone loaded a page.
			if ( ! storedToken() ) {
				return paint( 0 );
			}

			api( '/cart' )
				.then( function ( cart ) {
					paint( cart.item_count || 0 );
				} )
				.catch( function () {} );
		}

		window.addEventListener( 'vulocart:cart-updated', function ( event ) {
			var cart = event.detail;

			if ( cart && 'number' === typeof cart.item_count ) {
				paint( cart.item_count );
			} else {
				refresh();
			}
		} );
		window.addEventListener( 'storage', function ( event ) {
			if ( event.key === TOKEN_KEY ) {
				refresh();
			}
		} );
		refresh();
	}

	function boot() {
		Array.prototype.forEach.call( document.querySelectorAll( '.vulocart-cart' ), initCart );
		initLinks();
	}

	if ( 'loading' === document.readyState ) {
		document.addEventListener( 'DOMContentLoaded', boot );
	} else {
		boot();
	}
}() );
