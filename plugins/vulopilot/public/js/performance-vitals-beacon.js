/**
 * Core Web Vitals RUM: measures this page view's LCP/CLS/INP in the visitor's browser via
 * PerformanceObserver, plus load time and transfer size via Navigation/Resource Timing, and reports
 * them once on page-hide to the public beacon endpoint (CoreWebVitalsBeaconRest.php). Hand-written
 * vanilla JS in public/js/ rather than a webpack entry, like admin-menu-groups.js (see
 * Services\CoreWebVitalsBeacon.php).
 *
 * Sends no cookie, visitor id, IP or URL - just five numbers, aggregated site-wide. INP is a
 * simplified approximation (the largest single interaction duration), not the official percentile
 * algorithm. `transferBytes` sums `transferSize` over loaded resources (0 for cross-origin ones
 * without `Timing-Allow-Origin`), so it's a lower bound. `pageLoadMs` is `null` (never 0) if the
 * visitor left before the `load` event finished.
 *
 * window.vulopilotCwvBeacon is localized by Services\CoreWebVitalsBeacon::enqueue_beacon_script():
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
	} catch {
		// Not supported in this browser - lcpMs stays null, honestly omitted.
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
	} catch {
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
	} catch {
		// Not supported in this browser - inpMs stays null, honestly omitted.
	}

	/**
	 * Read once at send time from the Navigation/Resource Timing buffers, which are populated by the time
	 * a visitor navigates away. `loadEventEnd` is 0 until `load` completes, so a visitor who leaves
	 * mid-load reports no load time rather than 0.
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
		} catch {
			// Navigation/Resource Timing not supported - both stay null, honestly omitted.
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

	// Safari doesn't always fire visibilitychange on tab close - pagehide
	// catches that case too; sendBeacon()'s own `sent` guard makes a
	// second call from both firing harmless.
	window.addEventListener( 'pagehide', sendBeacon );
} )();
