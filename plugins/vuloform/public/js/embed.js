/**
 * VuloForm - embed loader.
 *
 * Paste this script and a `<div data-vuloform="FORM_ID">` into any page. It fetches the form from
 * the WordPress site this file is served from and inserts it. No cookies are sent, and only what a
 * visitor to the form's own page would receive is loaded.
 */
( function () {
	'use strict';

	var script = document.currentScript;

	if ( ! script || ! window.fetch ) {
		return;
	}

	// The REST base of the site that owns the form, passed in the script URL.
	var match = /[?&]site=([^&]+)/.exec( script.src );
	var api = match ? decodeURIComponent( match[ 1 ] ).replace( /\/+$/, '' ) : '';

	if ( ! /^https?:\/\//.test( api ) ) {
		return;
	}

	function loadOnce( tag, attribute, url, done ) {
		var existing = document.querySelector( tag + '[' + attribute + '="' + url + '"]' );

		if ( existing ) {
			if ( done ) {
				if ( window.vuloformInit ) {
					done();
				} else {
					existing.addEventListener( 'load', done );
				}
			}

			return;
		}

		var el = document.createElement( tag );

		if ( tag === 'link' ) {
			el.rel = 'stylesheet';
		}

		el[ attribute ] = url;

		if ( done ) {
			el.addEventListener( 'load', done );
		}

		document.head.appendChild( el );
	}

	function load( container ) {
		var id = parseInt( container.getAttribute( 'data-vuloform' ), 10 );

		if ( ! id || container.getAttribute( 'data-vuloform-loaded' ) ) {
			return;
		}

		container.setAttribute( 'data-vuloform-loaded', '1' );

		// Works for both pretty permalinks (…/wp-json) and plain ones (…/index.php?rest_route=).
		var url = api + '/vuloform/v1/public/forms/' + id + '/embed';

		fetch( url, { credentials: 'omit' } )
			.then( function ( response ) {
				if ( ! response.ok ) {
					throw new Error( 'unavailable' );
				}

				return response.json();
			} )
			.then( function ( data ) {
				loadOnce( 'link', 'href', data.style );
				container.innerHTML = data.html;

				loadOnce( 'script', 'src', data.script, function () {
					if ( window.vuloformInit ) {
						window.vuloformInit( container );
					}
				} );
			} )
			.catch( function () {
				container.textContent = container.getAttribute( 'data-vuloform-error' ) || 'This form is not available right now.';
			} );
	}

	function start() {
		Array.prototype.forEach.call( document.querySelectorAll( 'div[data-vuloform]' ), load );
	}

	if ( document.readyState === 'loading' ) {
		document.addEventListener( 'DOMContentLoaded', start );
	} else {
		start();
	}
} )();
