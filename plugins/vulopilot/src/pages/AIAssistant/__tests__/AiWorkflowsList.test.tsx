import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getApiResponse } from '@zyra/core';
import AiWorkflowsList from '../AiWorkflowsList';

describe( 'AiWorkflowsList', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
		delete ( window as unknown as { location: unknown } ).location;
		( window as unknown as { location: Location } ).location = {
			href: '',
		} as Location;
	} );

	/**
	 * Regression: the empty state used to say "Create one from the
	 * Automation page" with no actual way to get there — a real
	 * instruction with no real action behind it.
	 */
	it( 'the empty state\'s "Go to Automation" button actually navigates there', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( [] );

		render( <AiWorkflowsList /> );

		await userEvent.click(
			await screen.findByRole( 'button', { name: /go to automation/i } )
		);

		expect( window.location.href ).toBe( '?page=vulopilot#&tab=automation' );
	} );

	it( 'clicking a real workflow row navigates to Automation', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( [
			{ id: 1, name: 'Escalate critical findings', status: 'enabled' },
		] );

		render( <AiWorkflowsList /> );

		await userEvent.click(
			await screen.findByText( 'Escalate critical findings' )
		);

		expect( window.location.href ).toBe( '?page=vulopilot#&tab=automation' );
	} );
} );
