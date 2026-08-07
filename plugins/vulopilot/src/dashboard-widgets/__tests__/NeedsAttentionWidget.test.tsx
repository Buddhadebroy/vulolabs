import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getApiResponse, sendApiResponse } from '@zyra/core';
import NeedsAttentionWidget from '../NeedsAttentionWidget';

const mockByEndpoint = ( fixtures: Record< string, unknown > ) => {
	( getApiResponse as jest.Mock ).mockImplementation( ( url: string ) => {
		const [ endpoint ] = url.split( '?' );
		return Promise.resolve( fixtures[ endpoint ] ?? [] );
	} );
};

describe( 'NeedsAttentionWidget', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
		( sendApiResponse as jest.Mock ).mockReset();
	} );

	it( 'shows an honest empty state on every tab when there is nothing real to show', async () => {
		mockByEndpoint( { findings: [], 'ai-action-runs': [] } );

		render(
			<NeedsAttentionWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect(
			await screen.findByText( /nothing to fix right now/i )
		).toBeInTheDocument();

		await userEvent.click(
			screen.getByRole( 'tab', { name: /open issues/i } )
		);
		expect( screen.getByText( /no open issues/i ) ).toBeInTheDocument();

		await userEvent.click(
			screen.getByRole( 'tab', { name: /pending approval/i } )
		);
		expect(
			screen.getByText( /nothing waiting on you/i )
		).toBeInTheDocument();
	} );

	it( 'approves a real pending AI action via POST /ai-action-runs/{id}/approve', async () => {
		mockByEndpoint( {
			findings: [],
			'ai-action-runs': [
				{ id: 42, action_id: 'rewrite_meta', created_at: '2026-01-01T00:00:00' },
			],
		} );
		( sendApiResponse as jest.Mock ).mockResolvedValue( { success: true } );

		render(
			<NeedsAttentionWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		await userEvent.click(
			screen.getByRole( 'tab', { name: /pending approval/i } )
		);
		expect( await screen.findByText( 'rewrite_meta' ) ).toBeInTheDocument();

		await userEvent.click(
			screen.getByRole( 'button', { name: /approve/i } )
		);

		expect( sendApiResponse ).toHaveBeenCalledWith(
			expect.anything(),
			'ai-action-runs/42/approve',
			{}
		);
	} );
} );
