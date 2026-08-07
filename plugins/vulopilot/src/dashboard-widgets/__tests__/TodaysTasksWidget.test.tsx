import { render, screen } from '@testing-library/react';
import { getApiResponse } from '@zyra/core';
import TodaysTasksWidget from '../TodaysTasksWidget';

describe( 'TodaysTasksWidget', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
	} );

	it( 'shows an honest empty state when nothing has happened today', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( [] );

		render(
			<TodaysTasksWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect(
			await screen.findByText( /nothing has happened yet today/i )
		).toBeInTheDocument();
	} );

	it( 'renders real activity log rows', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( [
			{
				id: 1,
				event_type: 'scan',
				message: 'Scan completed',
				severity: 'info',
				created_at: '2026-01-01T00:00:00',
			},
		] );

		render(
			<TodaysTasksWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect(
			await screen.findByText( 'Scan completed' )
		).toBeInTheDocument();
	} );

	it( 'links "Show details" to Reports → Activity', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( [] );

		render(
			<TodaysTasksWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect(
			screen.getByRole( 'link', { name: /show details/i } )
		).toHaveAttribute(
			'href',
			'?page=vulopilot#&tab=reports&subtab=activity'
		);

		// Let the in-flight /activity-logs fetch settle before the test
		// ends, same as every other widget test here — otherwise its
		// state update lands after the test completes and React logs an
		// unwrapped act() warning.
		await screen.findByText( /nothing has happened yet today/i );
	} );
} );
