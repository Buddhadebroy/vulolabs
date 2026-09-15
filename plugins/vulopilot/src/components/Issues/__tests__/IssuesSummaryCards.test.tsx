import { render, screen } from '@testing-library/react';
import IssuesSummaryCards from '../IssuesSummaryCards';

describe( 'IssuesSummaryCards', () => {
	it( 'renders the real total and priority counts', () => {
		render(
			<IssuesSummaryCards
				total={ 28 }
				priorityCounts={ { high: 79, medium: 88, low: 314 } }
				isLoading={ false }
			/>
		);

		expect( screen.getByText( 'All Issues' ) ).toBeInTheDocument();
		expect( screen.getByText( 28 ) ).toBeInTheDocument();
		expect( screen.getByText( 79 ) ).toBeInTheDocument();
		expect( screen.getByText( 88 ) ).toBeInTheDocument();
		expect( screen.getByText( 314 ) ).toBeInTheDocument();
	} );
} );
