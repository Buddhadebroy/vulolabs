import { render, screen } from '@testing-library/react';
import Content from '../Content';

jest.mock( '../../../components/FindingsTable', () => ( {
	__esModule: true,
	default: ( { title, scannerIds }: { title: string; scannerIds: string[] } ) => (
		<div data-testid="findings-table">
			{ title }: { scannerIds.join( ',' ) }
		</div>
	),
} ) );

jest.mock( '../ContentScoreCard', () => ( {
	__esModule: true,
	default: () => <div data-testid="content-score-card" />,
} ) );

describe( 'Content page', () => {
	it( 'shows the module-off guard and no findings tables when the module is inactive', () => {
		global.appLocalizer.active_modules = [];

		render( <Content /> );

		expect(
			screen.getByText( /content intelligence module is turned off/i )
		).toBeInTheDocument();
		expect( screen.queryByTestId( 'content-score-card' ) ).not.toBeInTheDocument();
		expect( screen.queryByTestId( 'findings-table' ) ).not.toBeInTheDocument();
	} );

	it( 'renders the Content Score card and all 3 sections, grouped by their own scanner_id list, when the module is active', () => {
		global.appLocalizer.active_modules = [ 'content-intelligence' ];

		render( <Content /> );

		expect( screen.getByTestId( 'content-score-card' ) ).toBeInTheDocument();

		const tables = screen.getAllByTestId( 'findings-table' );
		expect( tables ).toHaveLength( 3 );
		expect( tables[ 0 ] ).toHaveTextContent( 'readability' );
		expect( tables[ 1 ] ).toHaveTextContent( 'thin-content,duplicate-content' );
		expect( tables[ 2 ] ).toHaveTextContent(
			'heading-structure,internal-linking,orphan-pages'
		);
	} );

	it( 'does not render a Pro card slot when nothing has registered one (this file registers no filters)', () => {
		global.appLocalizer.active_modules = [ 'content-intelligence' ];

		render( <Content /> );

		expect( screen.queryByTestId( 'topic-authority-stub' ) ).not.toBeInTheDocument();
		expect( screen.queryByTestId( 'content-gap-stub' ) ).not.toBeInTheDocument();
	} );
} );
