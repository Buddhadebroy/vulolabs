import { render, screen } from '@testing-library/react';

jest.mock( '../../../services/useFindingsTable', () => ( {
	useFindingsTable: () => ( {
		tableCardProps: { rows: [], emptyMessage: '' },
		error: null,
		refetch: jest.fn(),
		isProPopupOpen: false,
		closeProPopup: jest.fn(),
	} ),
} ) );

/**
 * WooCommerce.tsx resolves `vulopilot_woocommerce_ai_panel`/
 * `vulopilot_woocommerce_intelligence_panel` via applyFilters() once, at
 * module top-level scope. Only the second (WOOCOMMERCE-INTELLIGENCE-MODULE.md's
 * new slot) is registered here — confirms that slot renders its real panel
 * while the first slot, left unregistered, still falls back to its own
 * locked teaser card rather than rendering nothing, i.e. the two slots are
 * independent of each other.
 */
const { addFilter } = require( '@wordpress/hooks' );

addFilter(
	'vulopilot_woocommerce_intelligence_panel',
	'test/woocommerce-pro-filters',
	() => () => <div data-testid="woocommerce-intelligence-stub" />
);

const WooCommerceTab = require( '../WooCommerceTab' ).default;

describe( 'WooCommerceTab — Pro filter slots', () => {
	it( 'renders the registered WooCommerceIntelligence panel and the unregistered WooCommerceAi slot\'s locked teaser, around the base issues table', () => {
		render( <WooCommerceTab /> );

		expect(
			screen.getByTestId( 'woocommerce-intelligence-stub' )
		).toBeInTheDocument();
		expect( screen.getByTestId( 'table-card' ) ).toBeInTheDocument();
		expect(
			screen.getByText( 'Bulk AI optimization' )
		).toBeInTheDocument();
		expect( screen.getByText( 'Unlock with Pro' ) ).toBeInTheDocument();
	} );
} );
