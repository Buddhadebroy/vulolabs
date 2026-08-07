import { render, screen } from '@testing-library/react';
import { getApiResponse } from '@zyra/core';
import HealthTimelineWidget from '../HealthTimelineWidget';

describe( 'HealthTimelineWidget', () => {
	const originalActiveModules = [ ...appLocalizer.active_modules ];

	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
	} );

	afterEach( () => {
		appLocalizer.active_modules = [ ...originalActiveModules ];
	} );

	/**
	 * Regression test: this widget used to treat "endpoint 404'd because
	 * Pro's AdvancedReports module isn't active" and "loaded zero real
	 * rows" as the same friendly "run a scan" empty state — misleading on
	 * Free, since running a scan can never populate this endpoint there.
	 */
	it( 'shows an honest "unlock with Pro" state on Free, not the run-a-scan copy', async () => {
		appLocalizer.active_modules = [];
		( getApiResponse as jest.Mock ).mockResolvedValue( null );

		render(
			<HealthTimelineWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect(
			await screen.findByRole( 'button', { name: /unlock with pro/i } )
		).toBeInTheDocument();
		expect(
			screen.queryByText( /run your first scan/i )
		).not.toBeInTheDocument();
	} );

	it( 'shows the real "no trend data yet" empty state once Pro is active but nothing has run', async () => {
		appLocalizer.active_modules = [ 'advanced-reports' ];
		( getApiResponse as jest.Mock ).mockResolvedValue( [] );

		render(
			<HealthTimelineWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect(
			await screen.findByText( /run your first scan/i )
		).toBeInTheDocument();
	} );

	it( 'renders the real trend chart once Pro is active and snapshots exist', async () => {
		appLocalizer.active_modules = [ 'advanced-reports' ];
		( getApiResponse as jest.Mock ).mockResolvedValue( [
			{ snapshot_date: '2026-01-01', overall_score: 80 },
			{ snapshot_date: '2026-01-02', overall_score: 82 },
		] );

		render(
			<HealthTimelineWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect( await screen.findByTestId( 'chart-area' ) ).toHaveTextContent(
			'2 points'
		);
	} );
} );
