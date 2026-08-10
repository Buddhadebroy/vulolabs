import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getApiResponse } from '@zyra/core';
import RecentConversationsCard from '../RecentConversationsCard';

describe( 'RecentConversationsCard', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
	} );

	/**
	 * Regression: this card used to render 5 hardcoded rows ("Why is my SEO
	 * score low?", fixed times like "2:15 PM") regardless of what actually
	 * happened — not backed by any real data at all. It should read the
	 * same real `vulopilot_ai_history` rows HistoryTab.tsx's own table
	 * reads via `GET /ai-history`.
	 */
	it( 'renders real recent AI history rows, not placeholder copy', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			data: [
				{
					id: 1,
					provider: 'groq',
					model: 'llama-3.3-70b-versatile',
					status: 'success',
					response_excerpt: 'Generated a meta description for your homepage.',
					created_at: new Date( Date.now() - 5 * 60 * 1000 ).toISOString(),
				},
				{
					id: 2,
					provider: 'groq',
					model: null,
					status: 'failure',
					response_excerpt: null,
					created_at: new Date( Date.now() - 60 * 60 * 1000 ).toISOString(),
				},
			],
			total: 2,
		} );

		render( <RecentConversationsCard onNavigateTab={ jest.fn() } /> );

		expect(
			await screen.findByText(
				'Generated a meta description for your homepage.'
			)
		).toBeInTheDocument();
		expect( screen.getByText( 'groq request failed' ) ).toBeInTheDocument();
		expect( screen.getByText( '5m ago' ) ).toBeInTheDocument();
		expect( screen.getByText( '1h ago' ) ).toBeInTheDocument();

		expect(
			screen.queryByText( /why is my seo score low/i )
		).not.toBeInTheDocument();
	} );

	it( 'shows an honest empty state when no AI activity has happened yet', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( { data: [], total: 0 } );

		render( <RecentConversationsCard onNavigateTab={ jest.fn() } /> );

		expect(
			await screen.findByText( /no ai activity yet/i )
		).toBeInTheDocument();
	} );

	it( '"View all history" navigates to the History tab', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( { data: [], total: 0 } );

		const onNavigateTab = jest.fn();
		render( <RecentConversationsCard onNavigateTab={ onNavigateTab } /> );

		await userEvent.click(
			await screen.findByText( /view all history/i )
		);

		expect( onNavigateTab ).toHaveBeenCalledWith( 'history' );
	} );
} );
