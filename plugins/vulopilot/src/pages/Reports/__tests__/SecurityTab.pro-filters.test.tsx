import { render, screen } from '@testing-library/react';

jest.mock( '../../../components/FindingsTable', () => ( {
	__esModule: true,
	default: () => <div data-testid="findings-table" />,
} ) );

/**
 * Security.tsx resolves `vulopilot_security_dashboard_card`/
 * `vulopilot_security_incident_reports_panel` via applyFilters() once, at
 * module top-level scope — same reasoning
 * CrawlerTraffic.pro-filters.test.tsx's own docblock documents for the
 * identical pattern.
 */
const { addFilter } = require( '@wordpress/hooks' );

addFilter(
	'vulopilot_security_dashboard_card',
	'test/security-pro-filters',
	() => () => <div data-testid="security-dashboard-stub" />
);
addFilter(
	'vulopilot_security_incident_reports_panel',
	'test/security-pro-filters',
	() => () => <div data-testid="security-incidents-stub" />
);

const SecurityTab = require( '../SecurityTab' ).default;

describe( 'SecurityTab — Pro filter slots registered', () => {
	it( 'renders both Pro cards registered via the vulopilot_security_* filters, around the base FindingsTable', () => {
		render( <SecurityTab /> );

		expect( screen.getByTestId( 'security-dashboard-stub' ) ).toBeInTheDocument();
		expect( screen.getByTestId( 'findings-table' ) ).toBeInTheDocument();
		expect( screen.getByTestId( 'security-incidents-stub' ) ).toBeInTheDocument();
	} );
} );
