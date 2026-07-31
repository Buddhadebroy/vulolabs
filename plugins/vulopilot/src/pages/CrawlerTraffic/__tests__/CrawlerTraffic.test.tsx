import { render, screen } from '@testing-library/react';
import CrawlerTraffic from '../CrawlerTraffic';

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
	default: ( { title, scannerIds }: { title: string; scannerIds: string[] } ) => (
		<div data-testid="findings-table">
			{ title }: { scannerIds.join( ',' ) }
		</div>
	),
} ) );

describe( 'CrawlerTraffic page', () => {
	it( 'shows the Blocked pages FindingsTable when the SEO module is active', () => {
		global.appLocalizer.active_modules = [ 'seo' ];

		render( <CrawlerTraffic /> );

		expect( screen.getByTestId( 'crawler-summary-card' ) ).toBeInTheDocument();
		expect( screen.getByTestId( 'findings-table' ) ).toHaveTextContent(
			'ai-crawler-blocked-pages'
		);
	} );

	it( 'hides the Blocked pages card when the SEO module is inactive', () => {
		global.appLocalizer.active_modules = [];

		render( <CrawlerTraffic /> );

		expect( screen.queryByTestId( 'findings-table' ) ).not.toBeInTheDocument();
	} );

	it( 'does not render a Pro card slot when nothing has registered one (this file registers no filters)', () => {
		global.appLocalizer.active_modules = [ 'seo' ];

		render( <CrawlerTraffic /> );

		expect(
			screen.queryByTestId( 'historical-trends-stub' )
		).not.toBeInTheDocument();
		expect(
			screen.queryByTestId( 'visibility-correlation-stub' )
		).not.toBeInTheDocument();
		expect( screen.queryByTestId( 'crawler-alerts-stub' ) ).not.toBeInTheDocument();
	} );
} );
