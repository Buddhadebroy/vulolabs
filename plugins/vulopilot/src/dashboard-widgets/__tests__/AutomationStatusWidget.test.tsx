import { render, screen } from '@testing-library/react';
import { getApiResponse } from '@zyra/core';
import AutomationStatusWidget from '../AutomationStatusWidget';
import type { DashboardSummary } from '../types';

const summary = {
	automation_status: { enabled: 3, disabled: 1 },
} as DashboardSummary;

describe( 'AutomationStatusWidget', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
	} );

	it( 'shows the real enabled/disabled counts from the dashboard summary', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( [] );

		render(
			<AutomationStatusWidget
				summary={ summary }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect( await screen.findByText( '3 enabled' ) ).toBeInTheDocument();
		expect( screen.getByText( '1 disabled' ) ).toBeInTheDocument();
	} );

	it( 'shows an honest empty state when there are no automations', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( [] );

		render(
			<AutomationStatusWidget
				summary={ summary }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect(
			await screen.findByText( /no automations yet/i )
		).toBeInTheDocument();
	} );

	it( 'renders real automation rows with their status', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( [
			{ id: 1, name: 'Auto-fix broken links', status: 'enabled' },
		] );

		render(
			<AutomationStatusWidget
				summary={ summary }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect(
			await screen.findByText( 'Auto-fix broken links' )
		).toBeInTheDocument();
	} );
} );
