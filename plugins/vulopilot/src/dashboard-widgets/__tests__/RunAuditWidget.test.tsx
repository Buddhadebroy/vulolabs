import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { sendApiResponse } from '@zyra/core';
import RunAuditWidget from '../RunAuditWidget';

describe( 'RunAuditWidget', () => {
	beforeEach( () => {
		( sendApiResponse as jest.Mock ).mockReset();
		delete ( window as unknown as { location: unknown } ).location;
		( window as unknown as { location: Location } ).location = {
			href: '',
		} as Location;
	} );

	it( 'starts a real scan via POST /scans when "Run AI Audit" is clicked', async () => {
		( sendApiResponse as jest.Mock ).mockResolvedValue( { id: 1 } );

		render(
			<RunAuditWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		await userEvent.click(
			screen.getByRole( 'button', { name: /run ai audit/i } )
		);

		expect( sendApiResponse ).toHaveBeenCalledWith(
			expect.anything(),
			'scans',
			{ scanner_id: 'all', trigger_type: 'manual' }
		);
	} );

	it( 'navigates to the Automations tab when "Schedule Audit" is clicked', async () => {
		render(
			<RunAuditWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		await userEvent.click(
			screen.getByRole( 'button', { name: /schedule audit/i } )
		);

		// Regression: this used to point at '?tab=automation' (singular),
		// a route that doesn't exist — routes.ts registers 'automations'.
		expect( window.location.href ).toBe(
			'?page=vulopilot#&tab=automations'
		);
	} );
} );
