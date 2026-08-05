import { render, screen } from '@testing-library/react';

jest.mock( '../../../services/useApiList', () => ( {
	useApiList: () => ( {
		data: [],
		total: 0,
		categoryCounts: [],
		isLoading: false,
		error: null,
		refetch: jest.fn(),
		onQueryUpdate: jest.fn(),
	} ),
} ) );

jest.mock( '../CrawlerSummaryCard', () => ( {
	__esModule: true,
	default: () => <div data-testid="crawler-summary-card" />,
} ) );

jest.mock( '../../../components/FindingsTable', () => ( {
	__esModule: true,
	default: () => <div data-testid="findings-table" />,
} ) );

/**
 * CrawlerTraffic.tsx resolves `vulopilot_crawler_historical_trends_card`/
 * `vulopilot_crawler_visibility_correlation_card`/
 * `vulopilot_crawler_alerts_card` via applyFilters() once, at module
 * top-level scope — same reasoning
 * BrandVisibility.pro-filters.test.tsx's own docblock documents for the
 * identical pattern.
 */
const { addFilter } = require( '@wordpress/hooks' );

addFilter(
	'vulopilot_crawler_historical_trends_card',
	'test/crawler-traffic-pro-filters',
	() => () => <div data-testid="historical-trends-stub" />
);
addFilter(
	'vulopilot_crawler_visibility_correlation_card',
	'test/crawler-traffic-pro-filters',
	() => () => <div data-testid="visibility-correlation-stub" />
);
addFilter(
	'vulopilot_crawler_alerts_card',
	'test/crawler-traffic-pro-filters',
	() => () => <div data-testid="crawler-alerts-stub" />
);

const CrawlerTraffic = require( '../CrawlerTrafficTab' ).default;

describe( 'CrawlerTraffic page — Pro filter slots registered', () => {
	it( 'renders all 3 Pro cards registered via the vulopilot_crawler_* filters', () => {
		global.appLocalizer.active_modules = [ 'seo' ];

		render( <CrawlerTraffic /> );

		expect( screen.getByTestId( 'historical-trends-stub' ) ).toBeInTheDocument();
		expect(
			screen.getByTestId( 'visibility-correlation-stub' )
		).toBeInTheDocument();
		expect( screen.getByTestId( 'crawler-alerts-stub' ) ).toBeInTheDocument();
	} );
} );
