import { render, screen } from '@testing-library/react';
import CrawlerTraffic from '../CrawlerTrafficTab';

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

jest.mock( '../../../services/useFindingsTable', () => ( {
	useFindingsTable: ( { scannerIds }: { scannerIds?: string[] } ) => ( {
		// Stands in for a real `<TableCard>`'s props — the signal below
		// (an otherwise-nonsense emptyMessage) exists only so this test can
		// see which real `scannerIds` reached the hook, same thing
		// `findings-table`'s own stub used to prove by rendering its props
		// as text before `<FindingsTable>` was replaced with a real
		// `<TableCard>` fed by this hook.
		tableCardProps: {
			rows: [],
			emptyMessage: `blocked-pages:${ ( scannerIds || [] ).join( ',' ) }`,
		},
		error: null,
		refetch: jest.fn(),
		isProPopupOpen: false,
		closeProPopup: jest.fn(),
	} ),
} ) );

describe( 'CrawlerTraffic page', () => {
	it( 'shows the Blocked pages table when the SEO module is active', () => {
		global.appLocalizer.active_modules = [ 'seo' ];

		render( <CrawlerTraffic /> );

		expect( screen.getByTestId( 'crawler-summary-card' ) ).toBeInTheDocument();
		expect(
			screen.getByText( 'blocked-pages:ai-crawler-blocked-pages' )
		).toBeInTheDocument();
	} );

	it( 'hides the Blocked pages card when the SEO module is inactive', () => {
		global.appLocalizer.active_modules = [];

		render( <CrawlerTraffic /> );

		expect(
			screen.queryByText( 'blocked-pages:ai-crawler-blocked-pages' )
		).not.toBeInTheDocument();
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
