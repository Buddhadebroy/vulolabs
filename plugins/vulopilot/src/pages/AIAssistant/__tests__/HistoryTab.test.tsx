import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getApiResponse } from '@zyra/core';
import HistoryTab from '../HistoryTab';

const HISTORY_RESPONSE = {
	data: [
		{
			id: 904,
			event_type: 'scan.completed',
			category: 'scan',
			message: 'Scan "security-headers" completed with 1 finding(s).',
			severity: 'info',
			created_at: new Date().toISOString().slice( 0, 19 ).replace( 'T', ' ' ),
			scan: {
				id: 884,
				scanner_id: 'security-headers',
				label: 'Security Headers',
				status: 'completed',
				trigger_type: 'manual',
				duration_ms: 120,
				by_severity: { medium: 1 },
				total: 1,
			},
			change: null,
		},
		{
			id: 865,
			event_type: 'ai_action.executed',
			category: 'change',
			message: 'Write meta description executed.',
			severity: 'info',
			created_at: '2026-08-07 12:12:09',
			scan: null,
			change: {
				id: 1,
				action_id: 'write-meta-description',
				label: 'Write meta description',
				status: 'executed',
				before: null,
				after: 'Example page with introductory content and instructions.',
				format: 'text',
				error_message: null,
				page: '/sample-page/',
			},
		},
	],
	total: 2,
	type_counts: { scan: 887, change: 2, conversation: 0, automation: 0 },
};

describe( 'HistoryTab', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
	} );

	it( 'shows an honest empty state when there is no history yet', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			data: [],
			total: 0,
			type_counts: { scan: 0, change: 0, conversation: 0, automation: 0 },
		} );

		render( <HistoryTab /> );

		expect(
			await screen.findByText( /nothing here yet/i )
		).toBeInTheDocument();
	} );

	it( 'renders real day-grouped rows with real titles and badges', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( HISTORY_RESPONSE );

		render( <HistoryTab /> );

		// "Security Headers" legitimately appears twice — the row title
		// and the auto-selected detail panel's own title.
		expect(
			await screen.findAllByText( 'Security Headers' )
		).toHaveLength( 2 );
		expect(
			screen.getByText( 'Write meta description' )
		).toBeInTheDocument();
		// "Today" also legitimately appears as a <option> in the date-range
		// select — scoped to the day heading specifically.
		expect(
			screen.getByText( 'Today', { selector: '.history-day-heading' } )
		).toBeInTheDocument();
		expect( screen.getByText( 'Applied' ) ).toBeInTheDocument();
	} );

	it( 'clicking the "Changes" filter re-fetches scoped to that type', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( HISTORY_RESPONSE );

		render( <HistoryTab /> );
		await screen.findByText(
			'Scan "security-headers" completed with 1 finding(s).'
		);

		( getApiResponse as jest.Mock ).mockClear();
		await userEvent.click(
			screen.getByText( 'Changes', { selector: '.issues-category-tab' } )
		);

		await waitFor( () =>
			expect( getApiResponse ).toHaveBeenCalledWith(
				expect.stringContaining( 'type=change' ),
				expect.anything()
			)
		);
	} );

	it( 'the "Conversations" filter shows an honest empty state, no fabricated rows', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			data: [],
			total: 0,
			type_counts: { scan: 887, change: 2, conversation: 0, automation: 0 },
		} );

		render( <HistoryTab /> );
		await waitFor( () => expect( getApiResponse ).toHaveBeenCalled() );

		( getApiResponse as jest.Mock ).mockClear();
		await userEvent.click(
			screen.getByText( 'Conversations', {
				selector: '.issues-category-tab',
			} )
		);

		await waitFor( () =>
			expect( getApiResponse ).toHaveBeenCalledWith(
				expect.stringContaining( 'type=conversation' ),
				expect.anything()
			)
		);
		expect(
			await screen.findByText( /no conversations yet/i )
		).toBeInTheDocument();
	} );

	it( 'typing in search debounces then re-fetches scoped to the query', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( HISTORY_RESPONSE );

		render( <HistoryTab /> );
		await waitFor( () => expect( getApiResponse ).toHaveBeenCalled() );

		( getApiResponse as jest.Mock ).mockClear();
		await userEvent.type(
			screen.getByPlaceholderText( /search history/i ),
			'meta'
		);

		// Real timers — the component's own 400ms debounce needs to
		// actually elapse, so this waits past it rather than faking time
		// (fake timers here fight React's own act() batching).
		await waitFor(
			() =>
				expect( getApiResponse ).toHaveBeenCalledWith(
					expect.stringContaining( 'search=meta' ),
					expect.anything()
				),
			{ timeout: 2000 }
		);
	}, 10000 );

	it( 'clicking a row updates the selected detail panel', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( HISTORY_RESPONSE );

		render( <HistoryTab /> );
		await screen.findByText(
			'Scan "security-headers" completed with 1 finding(s).'
		);

		await userEvent.click( screen.getByText( 'Write meta description' ) );

		expect(
			await screen.findByText(
				'Example page with introductory content and instructions.'
			)
		).toBeInTheDocument();
	} );

	it( 'shows a "Load more" button when more rows exist, and appends on click', async () => {
		( getApiResponse as jest.Mock )
			.mockResolvedValueOnce( { ...HISTORY_RESPONSE, total: 40 } )
			// Real pagination is always ordered `created_at DESC`, so a
			// second page's rows are always an OLDER day than the first
			// page's — this uses a real older date rather than reusing
			// today's, matching that real invariant.
			.mockResolvedValueOnce( {
				...HISTORY_RESPONSE,
				data: [
					{
						...HISTORY_RESPONSE.data[ 0 ],
						id: 999,
						message: 'Scan "second-page-scanner" completed with 0 finding(s).',
						created_at: '2026-07-01 09:00:00',
						scan: { ...HISTORY_RESPONSE.data[ 0 ].scan, label: 'Second Page Scanner' },
					},
				],
				total: 40,
			} );

		render( <HistoryTab /> );
		await screen.findByText(
			'Scan "security-headers" completed with 1 finding(s).'
		);

		await userEvent.click( screen.getByText( 'Load more' ) );

		expect(
			await screen.findByText( 'Second Page Scanner' )
		).toBeInTheDocument();
		// The first page's rows stay visible — appended, not replaced.
		expect(
			screen.getByText(
				'Scan "security-headers" completed with 1 finding(s).'
			)
		).toBeInTheDocument();
	} );
} );
