import { render, screen } from '@testing-library/react';
import { getApiResponse, sendApiResponse } from '@zyra/core';
import DashboardGrid from '../DashboardGrid';
import { DEFAULT_DASHBOARD_WIDGETS } from '../registry';

const mockByEndpoint = ( fixtures: Record< string, unknown > ) => {
	( getApiResponse as jest.Mock ).mockImplementation( ( url: string ) => {
		const [ endpoint ] = url.split( '?' );
		return Promise.resolve( fixtures[ endpoint ] ?? [] );
	} );
};

const EMPTY_SUMMARY = {} as never;

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

		expect(
			await screen.findByText( 'Run Complete Audit' )
		).toBeInTheDocument();
		expect(
			screen.queryByText( 'Overall Site Score' )
		).not.toBeInTheDocument();
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

		expect(
			await screen.findByText( 'Run Complete Audit' )
		).toBeInTheDocument();
		expect(
			screen.queryByText( 'Overall Site Score' )
		).not.toBeInTheDocument();

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
