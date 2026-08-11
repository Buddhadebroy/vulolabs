/**
 * Real Core Web Vitals RUM (Real User Monitoring) — measures this actual
 * page view's LCP/CLS/INP in the visitor's own browser via native
 * PerformanceObserver, and reports them once, on page-hide, to
 * VuloPilot's own public beacon endpoint
 * (classes/RestAPI/Controllers/CoreWebVitalsBeaconRest.php). See
 * Services\CoreWebVitalsBeacon.php's own docblock for why this exists as
 * hand-written vanilla JS in public/js/ rather than a webpack entry (same
 * reasoning admin-menu-groups.js already documents — plain DOM/Web APIs
 * only, no JSX/TS, no admin bundle dependency).
 *
 * Sends no cookie, no visitor id, no IP, no URL — just three numbers,
 * aggregated site-wide rather than broken down per page. INP here is a
 * simplified, honest approximation (the
 * largest single interaction duration observed) rather than the full
 * official percentile-across-all-interactions algorithm, which needs more
 * bookkeeping than a v1 beacon warrants — still a real, measured number,
 * never fabricated.
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

	var sent = false;

	function sendBeacon() {
		if ( sent || ( null === lcpMs && null === clsValue && null === inpMs ) ) {
			return;
		}

		sent = true;

		var payload = {
			lcp_ms: lcpMs,
			cls_thousandths: null !== clsValue ? Math.round( clsValue * 1000 ) : null,
			inp_ms: inpMs,
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
