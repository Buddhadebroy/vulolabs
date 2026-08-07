import { render, screen } from '@testing-library/react';
import { getApiResponse } from '@zyra/core';
import LatestReportsWidget from '../LatestReportsWidget';

describe( 'LatestReportsWidget', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
	} );

	it( 'shows an honest empty state when no report has been generated yet', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( [] );

		render(
			<LatestReportsWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect(
			await screen.findByText( /no reports yet/i )
		).toBeInTheDocument();
	} );

	it( 'shows a retry option when the reports request fails', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( null );

		render(
			<LatestReportsWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect(
			await screen.findByText( /could not load reports/i )
		).toBeInTheDocument();
		expect(
			screen.getByRole( 'button', { name: /retry/i } )
		).toBeInTheDocument();
	} );

	it( 'renders real report rows with their status', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( [
			{ id: 1, report_type: 'seo', status: 'ready', created_at: '2026-01-01T00:00:00' },
		] );

		render(
			<LatestReportsWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect( await screen.findByText( 'seo' ) ).toBeInTheDocument();
	} );
} );
