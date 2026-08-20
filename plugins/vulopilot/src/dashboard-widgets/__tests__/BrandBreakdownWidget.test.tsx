import { render, screen } from '@testing-library/react';
import { getApiResponse } from '@zyra/core';
import BrandBreakdownWidget from '../BrandBreakdownWidget';

describe( 'BrandBreakdownWidget', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
	} );

	it( 'renders its title/pink accent through DashboardWidget despite the extra borderColor/desc props', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			brand_score: 72,
			trust_score: 80,
			authority_score: 65,
		} );

		render(
			<BrandBreakdownWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect(
			await screen.findByText( 'Brand Visibility breakdown' )
		).toBeInTheDocument();
	} );

	it( 'shows an honest error state when the score request fails', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( null );

		render(
			<BrandBreakdownWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect(
			await screen.findByText( /could not load brand visibility scores/i )
		).toBeInTheDocument();
	} );

	it( 'renders the real bar chart once scores load', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			brand_score: 72,
			trust_score: 80,
			authority_score: 65,
		} );

		render(
			<BrandBreakdownWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		// The chart placeholder exists from the very first (isLoading)
		// render onward, so findByTestId alone would resolve immediately
		// against its pre-fetch "0 points" content — waiting on the real
		// post-fetch text instead actually waits for the score to load.
		// 3 points now, not 4 — this widget dropped its own Entity bar
		// alongside Brand Visibility's own Entity Score tile (see
		// BrandBreakdownWidget.tsx's own docblock).
		expect( await screen.findByText( '3 points' ) ).toBeInTheDocument();
	} );
} );
