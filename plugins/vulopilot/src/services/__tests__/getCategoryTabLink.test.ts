import { getCategoryTabLink } from '../getCategoryTabLink';

describe( 'getCategoryTabLink', () => {
	it.each( [
		// Regression: this used to point at '?tab=seo', which routes.ts
		// doesn't register as a real tab.
		[ 'seo', '?page=vulopilot#&tab=seo-visibility&subtab=seo' ],
		[ 'accessibility', '?page=vulopilot#&tab=accessibility' ],
		[ 'images', '?page=vulopilot#&tab=seo-visibility&subtab=seo' ],
		[ 'schema', '?page=vulopilot#&tab=seo-visibility&subtab=seo' ],
		[ 'links', '?page=vulopilot#&tab=seo-visibility&subtab=broken-links' ],
		[ 'geo', '?page=vulopilot#&tab=seo-visibility&subtab=geo' ],
		[ 'security', '?page=vulopilot#&tab=security' ],
		[ 'wordpress', '?page=vulopilot#&tab=site-health' ],
		[ 'server', '?page=vulopilot#&tab=site-health' ],
		[ 'cron', '?page=vulopilot#&tab=site-health' ],
		[ 'database', '?page=vulopilot#&tab=site-health' ],
		[ 'updates', '?page=vulopilot#&tab=site-health' ],
		[ 'performance', '?page=vulopilot#&tab=performance' ],
		[ 'woocommerce', '?page=vulopilot#&tab=commerce' ],
	] )( 'maps category %s to %s', ( category, expected ) => {
		expect( getCategoryTabLink( category ) ).toBe( expected );
	} );

	it( 'falls back to the Health page (every category, unfiltered) for an unknown or missing category', () => {
		expect( getCategoryTabLink( 'not-a-real-category' ) ).toBe(
			'?page=vulopilot#&tab=health'
		);
		expect( getCategoryTabLink( undefined ) ).toBe(
			'?page=vulopilot#&tab=health'
		);
	} );
} );
