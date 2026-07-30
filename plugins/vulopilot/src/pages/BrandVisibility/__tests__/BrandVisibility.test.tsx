import { render, screen } from '@testing-library/react';
import BrandVisibility from '../BrandVisibility';

jest.mock( '../../../components/FindingsTable', () => ( {
	__esModule: true,
	default: ( { title, scannerIds }: { title: string; scannerIds: string[] } ) => (
		<div data-testid="findings-table">
			{ title }: { scannerIds.join( ',' ) }
		</div>
	),
} ) );

jest.mock( '../BrandScoreCard', () => ( {
	__esModule: true,
	default: () => <div data-testid="brand-score-card" />,
} ) );

describe( 'BrandVisibility page', () => {
	it( 'shows the module-off guard and no findings tables when the module is inactive', () => {
		global.appLocalizer.active_modules = [];

		render( <BrandVisibility /> );

		expect(
			screen.getByText( /brand intelligence module is turned off/i )
		).toBeInTheDocument();
		expect( screen.queryByTestId( 'brand-score-card' ) ).not.toBeInTheDocument();
		expect( screen.queryByTestId( 'findings-table' ) ).not.toBeInTheDocument();
	} );

	it( 'renders the Brand Score card and all 3 sections, grouped by their own scanner_id list, when the module is active', () => {
		global.appLocalizer.active_modules = [ 'brand-intelligence' ];

		render( <BrandVisibility /> );

		expect( screen.getByTestId( 'brand-score-card' ) ).toBeInTheDocument();

		const tables = screen.getAllByTestId( 'findings-table' );
		expect( tables ).toHaveLength( 3 );
		expect( tables[ 0 ] ).toHaveTextContent( 'geo-trust-signals,about-page-analysis' );
		expect( tables[ 1 ] ).toHaveTextContent(
			'geo-eeat-signals,geo-author-info,author-schema'
		);
		expect( tables[ 2 ] ).toHaveTextContent(
			'geo-entity-naming-consistency,organization-schema'
		);
	} );

	it( 'still shows the off-site "not connected yet" card regardless of module state', () => {
		global.appLocalizer.active_modules = [];

		render( <BrandVisibility /> );

		expect(
			screen.getByText( /off-site mention tracking: not connected yet/i )
		).toBeInTheDocument();
	} );

	it( 'does not render a Pro card slot when nothing has registered one (this file registers no filters)', () => {
		global.appLocalizer.active_modules = [ 'brand-intelligence' ];

		render( <BrandVisibility /> );

		expect( screen.queryByTestId( 'authority-trends-stub' ) ).not.toBeInTheDocument();
		expect( screen.queryByTestId( 'competitor-comparison-stub' ) ).not.toBeInTheDocument();
		expect( screen.queryByTestId( 'knowledge-panel-stub' ) ).not.toBeInTheDocument();
	} );
} );
