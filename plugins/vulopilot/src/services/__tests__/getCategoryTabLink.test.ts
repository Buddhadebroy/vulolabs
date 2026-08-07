import { getCategoryTabLink } from '../getCategoryTabLink';

describe( 'getCategoryTabLink', () => {
	it.each( [
		// Regression: these two used to point at '?tab=seo'/'?tab=accessibility',
		// neither of which routes.ts registers as a real tab.
		[ 'seo', '?page=vulopilot#&tab=geo&subtab=seo' ],
		[ 'accessibility', '?page=vulopilot#&tab=security&subtab=accessibility' ],
		[ 'images', '?page=vulopilot#&tab=geo&subtab=seo' ],
		[ 'schema', '?page=vulopilot#&tab=geo&subtab=seo' ],
		[ 'links', '?page=vulopilot#&tab=geo&subtab=seo' ],
		[ 'geo', '?page=vulopilot#&tab=geo&subtab=geo' ],
		[ 'security', '?page=vulopilot#&tab=security&subtab=security' ],
		[ 'performance', '?page=vulopilot#&tab=performance' ],
		[ 'woocommerce', '?page=vulopilot#&tab=woocommerce' ],
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
