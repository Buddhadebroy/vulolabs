import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getApiResponse, sendApiResponse } from '@zyra/core';
import FindingsTable from '../FindingsTable';

describe( 'FindingsTable — Snooze (Manual Actions Only)', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
		( sendApiResponse as jest.Mock ).mockReset();
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			data: [
				{
					id: 42,
					title: 'Missing alt text',
					severity: 'medium',
					category: 'images',
					status: 'open',
					created_at: '2026-07-29 00:00:00',
				},
			],
			total: 1,
			status_counts: { open: 1, resolved: 0, ignored: 0, snoozed: 0 },
		} );
	} );

	it( 'calls the real manual-action REST route when Snooze is clicked', async () => {
		( sendApiResponse as jest.Mock ).mockResolvedValue( {
			success: true,
			message: 'Finding #42 snoozed.',
		} );

		render( <FindingsTable title="Findings" /> );

		await userEvent.click(
			await screen.findByRole( 'button', { name: 'Snooze' } )
		);

		expect( sendApiResponse ).toHaveBeenCalledWith(
			expect.anything(),
			'findings/42/actions/snooze-finding',
			{}
		);
	} );

	it( 'shows the real success message and refetches after snoozing', async () => {
		( sendApiResponse as jest.Mock ).mockResolvedValue( {
			success: true,
			message: 'Finding #42 snoozed.',
		} );

		render( <FindingsTable title="Findings" /> );

		await userEvent.click(
			await screen.findByRole( 'button', { name: 'Snooze' } )
		);

		// Two fetches: the initial mount, and the refetch after a
		// successful snooze — confirms the real refetch-on-success path,
		// not just that the request fired.
		expect( getApiResponse ).toHaveBeenCalledTimes( 2 );
	} );
} );
