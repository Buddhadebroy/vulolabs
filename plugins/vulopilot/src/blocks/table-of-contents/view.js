/**
 * Frontend-only enhancement for `vulopilot/table-of-contents` - smooth scroll with a sticky-header
 * offset (neither is a real native `<a href="#...">` capability), plus `aria-expanded` syncing on
 * a collapsible instance's own `<summary>` (native `<details>`/`<summary>` already has correct
 * keyboard/disclosure semantics for free, but doesn't expose `aria-expanded` on its own). Runs once
 * per real `.vulopilot-toc` instance on the page - `data-smooth-scroll`/`data-scroll-offset` come
 * from that instance's own attributes (TableOfContentsRenderer.php's own `render()`), so two ToC
 * blocks on the same page can carry independent settings.
 */
( function () {
	var prefersReducedMotion =
		window.matchMedia &&
		window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;

	function scrollToTarget( target, offset ) {
		var top =
			target.getBoundingClientRect().top + window.pageYOffset - offset;

		window.scrollTo( {
			top: top,
			behavior: prefersReducedMotion ? 'auto' : 'smooth',
		} );
	}

	function initToc( toc ) {
		var smoothScroll = 'false' !== toc.getAttribute( 'data-smooth-scroll' );
		var offset = parseInt( toc.getAttribute( 'data-scroll-offset' ), 10 ) || 0;

		toc.querySelectorAll( '.vulopilot-toc-list a[href^="#"]' ).forEach(
			function ( link ) {
				link.addEventListener( 'click', function ( event ) {
					var id = link.getAttribute( 'href' ).slice( 1 );
					var target = id ? document.getElementById( id ) : null;

					if ( ! target ) {
						return;
					}

					event.preventDefault();

					if ( smoothScroll ) {
						scrollToTarget( target, offset );
					} else {
						target.scrollIntoView();
						window.scrollBy( 0, -offset );
					}

					// A target heading is usually not itself focusable -
					// moving focus there keeps keyboard/screen-reader
					// navigation in sync with where the page just scrolled,
					// without changing the URL hash (no extra history entry).
					if ( ! target.hasAttribute( 'tabindex' ) ) {
						target.setAttribute( 'tabindex', '-1' );
					}
					target.focus( { preventScroll: true } );
				} );
			}
		);

		var details = toc.querySelector( '.vulopilot-toc-details' );
		var summary = toc.querySelector( '.vulopilot-toc-title' );

		if ( details && summary && 'SUMMARY' === summary.tagName ) {
			var syncExpanded = function () {
				summary.setAttribute( 'aria-expanded', details.open ? 'true' : 'false' );
			};

			syncExpanded();
			details.addEventListener( 'toggle', syncExpanded );
		}
	}

	document
		.querySelectorAll( '.vulopilot-toc' )
		.forEach( initToc );
} )();
