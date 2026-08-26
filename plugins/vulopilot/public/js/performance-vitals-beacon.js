/**
 * Real Core Web Vitals RUM (Real User Monitoring) — measures this actual
 * page view's LCP/CLS/INP in the visitor's own browser via native
 * PerformanceObserver, plus real page load time and transfer size via the
 * Navigation/Resource Timing APIs, and reports them once, on page-hide, to
 * VuloPilot's own public beacon endpoint
 * (classes/RestAPI/Controllers/CoreWebVitalsBeaconRest.php). See
 * Services\CoreWebVitalsBeacon.php's own docblock for why this exists as
 * hand-written vanilla JS in public/js/ rather than a webpack entry (same
 * reasoning admin-menu-groups.js already documents — plain DOM/Web APIs
 * only, no JSX/TS, no admin bundle dependency).
 *
 * Sends no cookie, no visitor id, no IP, no URL — just five numbers,
 * aggregated site-wide rather than broken down per page. INP here is a
 * simplified, honest approximation (the
 * largest single interaction duration observed) rather than the full
 * official percentile-across-all-interactions algorithm, which needs more
 * bookkeeping than a v1 beacon warrants — still a real, measured number,
 * never fabricated. `transferBytes` sums real `transferSize` across every
 * resource this page view actually loaded (0 for a cross-origin resource
 * without a `Timing-Allow-Origin` response header — a real browser
 * security limit, not a bug) — an honest lower bound, never inflated.
 * `pageLoadMs` is left `null` (never a fabricated 0) if the visitor
 * navigated away before the `load` event finished.
 *
 * window.vulopilotCwvBeacon is localized by
 * Services\CoreWebVitalsBeacon::enqueue_beacon_script():
 * { endpoint: 'https://.../wp-json/vulopilot/v1/performance-vitals-beacon' }.
 */
( function () {
	'use strict';

	if ( ! window.vulopilotCwvBeacon || ! window.vulopilotCwvBeacon.endpoint ) {
		return;
	}

	if ( typeof PerformanceObserver === 'undefined' || typeof navigator.sendBeacon !== 'function' ) {
		return;
	}

	var lcpMs = null;
	var clsValue = null;
	var inpMs = null;

	try {
		new PerformanceObserver( function ( list ) {
			var entries = list.getEntries();
			var last = entries[ entries.length - 1 ];
			if ( last ) {
				lcpMs = Math.round( last.startTime );
			}
		} ).observe( { type: 'largest-contentful-paint', buffered: true } );
	} catch ( e ) {
		// Not supported in this browser — lcpMs stays null, honestly omitted.
	}

	try {
		clsValue = 0;
		new PerformanceObserver( function ( list ) {
			list.getEntries().forEach( function ( entry ) {
				if ( ! entry.hadRecentInput ) {
					clsValue += entry.value;
				}
			} );
		} ).observe( { type: 'layout-shift', buffered: true } );
	} catch ( e ) {
		clsValue = null;
	}

	try {
		new PerformanceObserver( function ( list ) {
			list.getEntries().forEach( function ( entry ) {
				var duration = Math.round( entry.duration );
				if ( null === inpMs || duration > inpMs ) {
					inpMs = duration;
				}
			} );
		} ).observe( { type: 'event', buffered: true, durationThreshold: 40 } );
	} catch ( e ) {
		// Not supported in this browser — inpMs stays null, honestly omitted.
	}

	/**
	 * Read once, at send time, straight from the browser's own Navigation/
	 * Resource Timing buffers — no PerformanceObserver needed, since both
	 * are already fully populated by the time a real visitor is navigating
	 * away. `loadEventEnd` is 0 (per spec) until the `load` event actually
	 * completes, so a visitor who leaves mid-load honestly reports no page
	 * load time rather than a fabricated 0.
	 */
	function collectLoadMetrics() {
		var pageLoadMs = null;
		var transferBytes = null;

		try {
			var navEntries = performance.getEntriesByType( 'navigation' );
			var nav = navEntries && navEntries[ 0 ];

			if ( nav ) {
				if ( nav.loadEventEnd > 0 ) {
					pageLoadMs = Math.round( nav.loadEventEnd );
				}

				transferBytes = Math.round( nav.transferSize || 0 );

				performance.getEntriesByType( 'resource' ).forEach( function ( entry ) {
					transferBytes += Math.round( entry.transferSize || 0 );
				} );
			}
		} catch ( e ) {
			// Navigation/Resource Timing not supported — both stay null, honestly omitted.
			pageLoadMs = null;
			transferBytes = null;
		}

		return { pageLoadMs: pageLoadMs, transferBytes: transferBytes };
	}

	var sent = false;

	function sendBeacon() {
		var loadMetrics = collectLoadMetrics();

		if (
			sent ||
			( null === lcpMs && null === clsValue && null === inpMs &&
				null === loadMetrics.pageLoadMs && null === loadMetrics.transferBytes )
		) {
			return;
		}

		sent = true;

		var payload = {
			lcp_ms: lcpMs,
			cls_thousandths: null !== clsValue ? Math.round( clsValue * 1000 ) : null,
			inp_ms: inpMs,
			page_load_ms: loadMetrics.pageLoadMs,
			transfer_bytes: loadMetrics.transferBytes,
		};

		var blob = new Blob( [ JSON.stringify( payload ) ], { type: 'application/json' } );
		navigator.sendBeacon( window.vulopilotCwvBeacon.endpoint, blob );
	}

	document.addEventListener( 'visibilitychange', function () {
		if ( 'hidden' === document.visibilityState ) {
			sendBeacon();
		}
	} );

	// Safari doesn't always fire visibilitychange on tab close — pagehide
	// catches that case too; sendBeacon()'s own `sent` guard makes a
	// second call from both firing harmless.
	window.addEventListener( 'pagehide', sendBeacon );
} )();
