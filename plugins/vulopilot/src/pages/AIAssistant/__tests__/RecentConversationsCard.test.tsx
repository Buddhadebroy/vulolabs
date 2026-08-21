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
	 * happened — not backed by any real data at all. It now reads real,
	 * reloadable conversation threads via `GET /copilot/conversations`
	 * (AiConversationRepository::get_recent()) — a real `title` (the
	 * thread's own first message) and `updated_at`, not an unwrapped
	 * orchestrator-JSON excerpt from the unrelated `vulopilot_ai_history`
	 * audit trail.
	 */
	it( 'renders real recent conversation rows, not placeholder copy', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			data: [
				{
					id: 1,
					title: 'Generate a meta description for my homepage',
					updated_at: new Date( Date.now() - 5 * 60 * 1000 ).toISOString(),
				},
				{
					id: 2,
					title: 'Why is my SEO score dropping?',
					updated_at: new Date( Date.now() - 60 * 60 * 1000 ).toISOString(),
				},
			],
			total: 2,
		} );

		render(
			<RecentConversationsCard
				onSelectConversation={ jest.fn() }
			/>
		);

		expect(
			await screen.findByText(
				'Generate a meta description for my homepage'
			)
		).toBeInTheDocument();
		expect(
			screen.getByText( 'Why is my SEO score dropping?' )
		).toBeInTheDocument();
		expect( screen.getByText( '5m ago' ) ).toBeInTheDocument();
		expect( screen.getByText( '1h ago' ) ).toBeInTheDocument();
	} );

	it( 'shows an honest empty state when no AI activity has happened yet', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( { data: [], total: 0 } );

		render(
			<RecentConversationsCard
				onSelectConversation={ jest.fn() }
			/>
		);

		expect(
			await screen.findByText( /no ai activity yet/i )
		).toBeInTheDocument();
	} );

	/**
	 * Regression: this used to be a same-page tab switch
	 * (`onNavigateTab('history')`) back when History lived inside AI
	 * Copilot's own tab shell — it's since moved to Reports (a different
	 * top-level menu item), so this is now a real page navigation.
	 */
	it( '"View all history" navigates to Reports\' History tab', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( { data: [], total: 0 } );

		render(
			<RecentConversationsCard
				onSelectConversation={ jest.fn() }
			/>
		);

		await userEvent.click(
			await screen.findByText( /view all history/i )
		);

		expect( window.location.href ).toBe(
			'?page=vulopilot#&tab=reports&subtab=history'
		);
	} );

	/**
	 * `onSelectConversation` now means "load this thread's full history into
	 * the composer" (ChatTab.tsx's own handleSelectConversation(), backed by
	 * useCopilotChat.ts's loadConversation()) rather than "navigate to
	 * History" — this card no longer knows or cares which, it just reports
	 * the clicked row's real id either way.
	 */
	it( 'clicking a row calls onSelectConversation with its real id', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			data: [
				{
					id: 42,
					title: 'Hi there.',
					updated_at: new Date().toISOString(),
				},
			],
			total: 1,
		} );

		const onSelectConversation = jest.fn();
		render(
			<RecentConversationsCard
				onSelectConversation={ onSelectConversation }
			/>
		);

		await userEvent.click( await screen.findByText( 'Hi there.' ) );

		expect( onSelectConversation ).toHaveBeenCalledWith( 42 );
	} );
} );
