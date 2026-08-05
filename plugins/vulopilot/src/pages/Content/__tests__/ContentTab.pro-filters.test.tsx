import { render, screen } from '@testing-library/react';

jest.mock( '../../../components/FindingsTable', () => ( {
	__esModule: true,
	default: () => <div data-testid="findings-table" />,
} ) );

jest.mock( '../ContentScoreCard', () => ( {
	__esModule: true,
	default: () => <div data-testid="content-score-card" />,
} ) );

/**
 * Content.tsx resolves `vulopilot_content_topic_authority_card`/
 * `vulopilot_content_gap_analysis_card` via applyFilters() once, at module
 * top-level scope — exactly like GEO.tsx's own GeoScoreCard slot already
 * does. In the real app, vulopilot-pro's src/index.tsx (require.context,
 * gated on active_modules) registers both filters before Free's Content.tsx
 * is ever imported/rendered. This test reproduces that same ordering with
 * plain require() calls (not a static `import`, which Jest/Babel hoists
 * above this file's own addFilter() calls regardless of source order).
 */
const { addFilter } = require( '@wordpress/hooks' );

addFilter(
	'vulopilot_content_topic_authority_card',
	'test/content-pro-filters',
	() => () => <div data-testid="topic-authority-stub" />
);
addFilter(
	'vulopilot_content_gap_analysis_card',
	'test/content-pro-filters',
	() => () => <div data-testid="content-gap-stub" />
);

const Content = require( '../ContentTab' ).default;

describe( 'Content page — Pro filter slots registered', () => {
	it( 'renders both Pro cards registered via the vulopilot_content_* filters', () => {
		global.appLocalizer.active_modules = [ 'content-intelligence' ];

		render( <Content /> );

		expect( screen.getByTestId( 'topic-authority-stub' ) ).toBeInTheDocument();
		expect( screen.getByTestId( 'content-gap-stub' ) ).toBeInTheDocument();
	} );
} );
