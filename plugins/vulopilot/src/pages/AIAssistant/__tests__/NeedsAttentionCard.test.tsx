import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getApiResponse } from '@zyra/core';
import NeedsAttentionCard from '../NeedsAttentionCard';

describe( 'NeedsAttentionCard', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
	} );

	it( 'shows a retry option when the dashboard summary request fails', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( null );

		render( <NeedsAttentionCard onNavigateTab={ jest.fn() } /> );

		expect(
			await screen.findByText( /could not load issues/i )
		).toBeInTheDocument();
		expect(
			screen.getByRole( 'button', { name: /retry/i } )
		).toBeInTheDocument();
	} );

	it( 'renders the real overall score, the 4 category scores, and the open-issues count', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			overall_score: 72,
			open_findings: 43,
			category_scores: {
				seo: 81,
				performance: 64,
				security: 58,
				content: 78,
			},
		} );

		render( <NeedsAttentionCard onNavigateTab={ jest.fn() } /> );

		expect( await screen.findByText( '72' ) ).toBeInTheDocument();
		expect(
			screen.getByText( /overall health/i )
		).toBeInTheDocument();
		// 72 falls in the 60-74 "orange" band — same band as the 64
		// performance score below.
		expect(
			screen.getByText( /needs improvement/i )
		).toBeInTheDocument();

		expect( screen.getByText( /seo & visibility/i ) ).toBeInTheDocument();
		expect( screen.getByText( '81' ) ).toBeInTheDocument();
		expect( screen.getByText( /^performance$/i ) ).toBeInTheDocument();
		expect( screen.getByText( '64' ) ).toBeInTheDocument();
		expect( screen.getByText( /^security$/i ) ).toBeInTheDocument();
		expect( screen.getByText( '58' ) ).toBeInTheDocument();
		expect( screen.getByText( /^content$/i ) ).toBeInTheDocument();
		expect( screen.getByText( '78' ) ).toBeInTheDocument();

		expect(
			screen.getByText( '43 open issues found' )
		).toBeInTheDocument();
	} );

	it( '"View all issues" navigates to the Chat tab\'s inline Issues table unfiltered', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			overall_score: 90,
			open_findings: 0,
			category_scores: { seo: 90, performance: 90, security: 90, content: 90 },
		} );

		const onNavigateTab = jest.fn();
		render( <NeedsAttentionCard onNavigateTab={ onNavigateTab } /> );

		await userEvent.click(
			await screen.findByText( /view all issues/i )
		);

		expect( onNavigateTab ).toHaveBeenCalledWith( 'chat' );
	} );
} );
