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
	 * happened — not backed by any real data at all. It now reads real
	 * chat-only rows via `GET /history?type=conversation`
	 * (AiHistoryRepository::get_conversations(), `surface`-scoped) — the
	 * same source HistoryTab.tsx's own "Conversations" filter reads —
	 * rather than the previously-used unfiltered `GET /ai-history`, and
	 * shows humanized text (humanizeConversationExcerpt()) instead of a
	 * raw orchestrator-JSON excerpt.
	 */
	it( 'renders real recent conversation rows, not placeholder copy', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			data: [
				{
					id: 1,
					event_type: 'ai_history.success',
					category: 'conversation',
					message: '{"status":"respond","message":"Generated a meta description for your homepage."}',
					severity: 'info',
					created_at: new Date( Date.now() - 5 * 60 * 1000 ).toISOString(),
					scan: null,
					change: null,
					conversation: {
						id: 1,
						provider: 'groq',
						model: 'llama-3.3-70b-versatile',
						status: 'success',
						excerpt: '{"status":"respond","message":"Generated a meta description for your homepage."}',
					},
				},
				{
					id: 2,
					event_type: 'ai_history.failure',
					category: 'conversation',
					message: '',
					severity: 'high',
					created_at: new Date( Date.now() - 60 * 60 * 1000 ).toISOString(),
					scan: null,
					change: null,
					conversation: {
						id: 2,
						provider: 'groq',
						model: null,
						status: 'failure',
						excerpt: null,
					},
				},
			],
			total: 2,
		} );

		render(
			<RecentConversationsCard
				onNavigateTab={ jest.fn() }
				onSelectConversation={ jest.fn() }
			/>
		);

		expect(
			await screen.findByText(
				'Generated a meta description for your homepage.'
			)
		).toBeInTheDocument();
		expect( screen.getByText( 'Something went wrong.' ) ).toBeInTheDocument();
		expect( screen.getByText( '5m ago' ) ).toBeInTheDocument();
		expect( screen.getByText( '1h ago' ) ).toBeInTheDocument();

		expect(
			screen.queryByText( /why is my seo score low/i )
		).not.toBeInTheDocument();
	} );

	it( 'shows an honest empty state when no AI activity has happened yet', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( { data: [], total: 0 } );

		render(
			<RecentConversationsCard
				onNavigateTab={ jest.fn() }
				onSelectConversation={ jest.fn() }
			/>
		);

		expect(
			await screen.findByText( /no ai activity yet/i )
		).toBeInTheDocument();
	} );

	it( '"View all history" navigates to the History tab', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( { data: [], total: 0 } );

		const onNavigateTab = jest.fn();
		render(
			<RecentConversationsCard
				onNavigateTab={ onNavigateTab }
				onSelectConversation={ jest.fn() }
			/>
		);

		await userEvent.click(
			await screen.findByText( /view all history/i )
		);

		expect( onNavigateTab ).toHaveBeenCalledWith( 'history' );
	} );

	it( 'clicking a row calls onSelectConversation with its real id', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			data: [
				{
					id: 42,
					event_type: 'ai_history.success',
					category: 'conversation',
					message: '{"status":"respond","message":"Hi there."}',
					severity: 'info',
					created_at: new Date().toISOString(),
					scan: null,
					change: null,
					conversation: {
						id: 42,
						provider: 'gemini',
						model: 'gemini-flash-lite-latest',
						status: 'success',
						excerpt: '{"status":"respond","message":"Hi there."}',
					},
				},
			],
			total: 1,
		} );

		const onSelectConversation = jest.fn();
		render(
			<RecentConversationsCard
				onNavigateTab={ jest.fn() }
				onSelectConversation={ onSelectConversation }
			/>
		);

		await userEvent.click( await screen.findByText( 'Hi there.' ) );

		expect( onSelectConversation ).toHaveBeenCalledWith( 42 );
	} );
} );
