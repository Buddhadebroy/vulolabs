import { render, screen } from '@testing-library/react';
import { getApiResponse } from '@zyra/core';
import RecentChangesWidget from '../RecentChangesWidget';

describe( 'RecentChangesWidget', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
	} );

	it( 'shows an honest empty state when there are no AI-attributed changes yet', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( [] );

		render(
			<RecentChangesWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect(
			await screen.findByText( /no ai changes yet/i )
		).toBeInTheDocument();
	} );

	it( 'renders real automation-attributed activity with an honestly-disabled Undo control', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( [
			{
				id: 1,
				event_type: 'scan',
				message: 'Fixed missing alt text',
				actor_type: 'automation',
				created_at: '2026-01-01T00:00:00',
			},
		] );

		render(
			<RecentChangesWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect(
			await screen.findByText( 'Fixed missing alt text' )
		).toBeInTheDocument();
		expect(
			screen.getByRole( 'button', { name: /undo/i } )
		).toBeDisabled();
	} );
} );
