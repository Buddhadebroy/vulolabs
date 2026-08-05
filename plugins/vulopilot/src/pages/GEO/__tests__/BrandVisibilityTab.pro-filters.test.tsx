import { render, screen } from '@testing-library/react';

jest.mock( '../../../components/FindingsTable', () => ( {
	__esModule: true,
	default: () => <div data-testid="findings-table" />,
} ) );

jest.mock( '../BrandScoreCard', () => ( {
	__esModule: true,
	default: () => <div data-testid="brand-score-card" />,
} ) );

/**
 * BrandVisibility.tsx resolves `vulopilot_brand_authority_trends_card`/
 * `vulopilot_brand_competitor_comparison_card`/
 * `vulopilot_brand_knowledge_panel_card` via applyFilters() once, at module
 * top-level scope — same reasoning
 * Content.pro-filters.test.tsx's own docblock documents for the identical
 * pattern on Content.tsx.
 */
const { addFilter } = require( '@wordpress/hooks' );

addFilter(
	'vulopilot_brand_authority_trends_card',
	'test/brand-visibility-pro-filters',
	() => () => <div data-testid="authority-trends-stub" />
);
addFilter(
	'vulopilot_brand_competitor_comparison_card',
	'test/brand-visibility-pro-filters',
	() => () => <div data-testid="competitor-comparison-stub" />
);
addFilter(
	'vulopilot_brand_knowledge_panel_card',
	'test/brand-visibility-pro-filters',
	() => () => <div data-testid="knowledge-panel-stub" />
);

const BrandVisibility = require( '../BrandVisibilityTab' ).default;

describe( 'BrandVisibility page — Pro filter slots registered', () => {
	it( 'renders all 3 Pro cards registered via the vulopilot_brand_* filters', () => {
		global.appLocalizer.active_modules = [ 'brand-intelligence' ];

		render( <BrandVisibility /> );

		expect( screen.getByTestId( 'authority-trends-stub' ) ).toBeInTheDocument();
		expect( screen.getByTestId( 'competitor-comparison-stub' ) ).toBeInTheDocument();
		expect( screen.getByTestId( 'knowledge-panel-stub' ) ).toBeInTheDocument();
	} );
} );
