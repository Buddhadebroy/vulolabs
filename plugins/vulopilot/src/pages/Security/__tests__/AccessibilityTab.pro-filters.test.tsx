import { render, screen } from '@testing-library/react';

jest.mock( '../../../components/FindingsTable', () => ( {
	__esModule: true,
	default: () => <div data-testid="findings-table" />,
} ) );

/**
 * Accessibility.tsx resolves `vulopilot_accessibility_dashboard_card`/
 * `vulopilot_accessibility_history_panel` via applyFilters() once, at
 * module top-level scope — same reasoning
 * Security.pro-filters.test.tsx's own docblock documents for the
 * identical pattern.
 */
const { addFilter } = require( '@wordpress/hooks' );

addFilter(
	'vulopilot_accessibility_dashboard_card',
	'test/accessibility-pro-filters',
	() => () => <div data-testid="accessibility-dashboard-stub" />
);
addFilter(
	'vulopilot_accessibility_history_panel',
	'test/accessibility-pro-filters',
	() => () => <div data-testid="accessibility-history-stub" />
);

const AccessibilityTab = require( '../AccessibilityTab' ).default;

describe( 'AccessibilityTab — Pro filter slots registered', () => {
	it( 'renders both Pro cards registered via the vulopilot_accessibility_* filters, around the 6 section FindingsTables', () => {
		render( <AccessibilityTab /> );

		expect( screen.getByTestId( 'accessibility-dashboard-stub' ) ).toBeInTheDocument();
		// One independent FindingsTable per PROTECT-MY-SITE.md section
		// (Images/Page Structure/Forms/Links & Buttons/Readability/
		// Keyboard & Assistive Technology) — see AccessibilityTab.tsx's
		// own docblock.
		expect( screen.getAllByTestId( 'findings-table' ) ).toHaveLength( 6 );
		expect( screen.getByTestId( 'accessibility-history-stub' ) ).toBeInTheDocument();
	} );
} );
