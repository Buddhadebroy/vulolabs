import { render, screen, waitFor } from '@testing-library/react';
import { getApiResponse, sendApiResponse } from '@zyra/core';
import DashboardGrid from '../DashboardGrid';
import { DEFAULT_DASHBOARD_WIDGETS } from '../registry';

const mockByEndpoint = ( fixtures: Record< string, unknown > ) => {
	( getApiResponse as jest.Mock ).mockImplementation( ( url: string ) => {
		const [ endpoint ] = url.split( '?' );
		return Promise.resolve( fixtures[ endpoint ] ?? [] );
	} );
};

// DashboardGrid renders its real, unmocked widget components (unlike a
// single-widget test), so a bare `{}` isn't enough — OverallScoreWidget
// reads straight into `summary.category_scores`. Same zero-filled shape
// Dashboard.tsx's own EMPTY_SUMMARY uses while the real fetch is in flight.
const EMPTY_SUMMARY = {
	overall_score: 0,
	open_findings: 0,
	critical_findings: 0,
	findings_by_severity: { critical: 0, high: 0, medium: 0, low: 0 },
	active_automations: 0,
	ai_jobs_used: 0,
	ai_jobs_quota: 0,
	category_scores: {
		seo: 0,
		performance: 0,
		security: 0,
		accessibility: 0,
		woocommerce: null,
		geo: 0,
		content: 0,
		brand: 0,
	},
	category_scores_7d_ago: {
		seo: 0,
		performance: 0,
		security: 0,
		accessibility: 0,
		woocommerce: null,
		geo: 0,
		content: 0,
		brand: 0,
	},
	new_findings_this_week: 0,
	fixed_findings_this_week: 0,
	quick_fixes: 0,
	pending_approvals: 0,
	automation_status: { enabled: 0, disabled: 0 },
};

describe( 'DashboardGrid', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
		( sendApiResponse as jest.Mock ).mockReset();
	} );

	it( 'renders only the saved, enabled widgets from a customized layout', async () => {
		mockByEndpoint( {
			'dashboard-layout': [
				{ id: 'run-audit', enabled: true },
				{ id: 'overall-score', enabled: false },
			],
		} );

		render(
			<DashboardGrid
				summary={ EMPTY_SUMMARY }
				isLoading={ false }
				isCustomizing={ false }
			/>
		);

		// The initial loading skeleton (while `/dashboard-layout` is still
		// in flight) always renders the first 4 registry widgets —
		// including Overall Site Score — regardless of the saved layout,
		// so 'Run Complete Audit' alone isn't proof the real layout has
		// loaded. Wait for the skeleton-only widget to clear first.
		await waitFor( () => {
			expect(
				screen.queryByText( 'Overall Site Score' )
			).not.toBeInTheDocument();
		} );
		expect( screen.getByText( 'Run Complete Audit' ) ).toBeInTheDocument();
	} );

	/**
	 * Regression test for the "Restore default" header button
	 * (Dashboard.tsx): clicking it increments `restoreDefaultSignal`,
	 * which this component must treat as "persist and render the
	 * registry's own default order," not just a no-op re-render.
	 */
	it( 'restores every registered widget, enabled, in registry order, when restoreDefaultSignal changes', async () => {
		mockByEndpoint( {
			'dashboard-layout': [ { id: 'run-audit', enabled: true } ],
		} );

		const { rerender } = render(
			<DashboardGrid
				summary={ EMPTY_SUMMARY }
				isLoading={ false }
				isCustomizing={ false }
				restoreDefaultSignal={ 0 }
			/>
		);

		await waitFor( () => {
			expect(
				screen.queryByText( 'Overall Site Score' )
			).not.toBeInTheDocument();
		} );
		expect( screen.getByText( 'Run Complete Audit' ) ).toBeInTheDocument();

		rerender(
			<DashboardGrid
				summary={ EMPTY_SUMMARY }
				isLoading={ false }
				isCustomizing={ false }
				restoreDefaultSignal={ 1 }
			/>
		);

		expect(
			await screen.findByText( 'Overall Site Score' )
		).toBeInTheDocument();

		expect( sendApiResponse ).toHaveBeenCalledWith(
			expect.anything(),
			'dashboard-layout',
			{
				widgets: DEFAULT_DASHBOARD_WIDGETS.map( ( widget ) => ( {
					id: widget.id,
					enabled: true,
				} ) ),
			}
		);
	} );

	it( 'does not reset the layout on initial mount just because restoreDefaultSignal starts at 0', async () => {
		mockByEndpoint( {
			'dashboard-layout': [ { id: 'run-audit', enabled: true } ],
		} );

		render(
			<DashboardGrid
				summary={ EMPTY_SUMMARY }
				isLoading={ false }
				isCustomizing={ false }
				restoreDefaultSignal={ 0 }
			/>
		);

		await screen.findByText( 'Run Complete Audit' );

		expect( sendApiResponse ).not.toHaveBeenCalled();
	} );
} );
