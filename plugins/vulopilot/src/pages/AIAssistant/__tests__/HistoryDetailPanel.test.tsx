import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { sendApiResponse } from '@zyra/core';
import { NoticeManager } from '@zyra/components';
import HistoryDetailPanel from '../HistoryDetailPanel';
import { HistoryRow } from '../historyTypes';

const SCAN_ROW: HistoryRow = {
	id: 904,
	event_type: 'scan.completed',
	category: 'scan',
	message: 'Scan "security-headers" completed with 1 finding(s).',
	severity: 'info',
	created_at: '2026-08-10 07:40:49',
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
};

const CHANGE_ROW: HistoryRow = {
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
};

const EXECUTED_CHANGE_ROW: HistoryRow = {
	...CHANGE_ROW,
	id: 866,
	change: { ...CHANGE_ROW.change!, id: 8, status: 'executed' },
};

const PENDING_CHANGE_ROW: HistoryRow = {
	...CHANGE_ROW,
	id: 867,
	change: { ...CHANGE_ROW.change!, id: 9, status: 'pending_approval' },
};

const CONVERSATION_ROW: HistoryRow = {
	id: 67,
	event_type: 'ai_history.success',
	category: 'conversation',
	message: '{"status":"respond","message":"You have 268 open findings."}',
	severity: 'info',
	created_at: '2026-08-14 07:31:30',
	scan: null,
	change: null,
	conversation: {
		id: 67,
		provider: 'gemini',
		model: 'gemini-flash-lite-latest',
		status: 'success',
		excerpt: '{"status":"respond","message":"You have 268 open findings."}',
	},
};

describe( 'HistoryDetailPanel', () => {
	beforeEach( () => {
		( sendApiResponse as jest.Mock ).mockReset();
	} );

	it( 'shows an honest empty state when nothing is selected', () => {
		render(
			<HistoryDetailPanel
				row={ null }
				onClose={ jest.fn() }
				onDeleted={ jest.fn() }
				onRolledBack={ jest.fn() }
			/>
		);

		expect( screen.getByText( /select an item/i ) ).toBeInTheDocument();
	} );

	it( 'shows a scan row\'s real per-severity findings breakdown', () => {
		render(
			<HistoryDetailPanel
				row={ SCAN_ROW }
				onClose={ jest.fn() }
				onDeleted={ jest.fn() }
				onRolledBack={ jest.fn() }
			/>
		);

		expect( screen.getByText( 'Security Headers' ) ).toBeInTheDocument();
		expect( screen.getByText( 'Medium' ) ).toBeInTheDocument();
		expect( screen.getByText( '1' ) ).toBeInTheDocument();
	} );

	it( 'shows a change row\'s real before/after and where', () => {
		render(
			<HistoryDetailPanel
				row={ CHANGE_ROW }
				onClose={ jest.fn() }
				onDeleted={ jest.fn() }
				onRolledBack={ jest.fn() }
			/>
		);

		expect(
			screen.getByText( 'Write meta description' )
		).toBeInTheDocument();
		expect( screen.getByText( 'Applied' ) ).toBeInTheDocument();
		expect(
			screen.getByText(
				'Example page with introductory content and instructions.'
			)
		).toBeInTheDocument();
		expect( screen.getByText( '/sample-page/' ) ).toBeInTheDocument();
	} );

	it( 'shows a conversation row\'s real provider and humanized reply, never the raw JSON', () => {
		render(
			<HistoryDetailPanel
				row={ CONVERSATION_ROW }
				onClose={ jest.fn() }
				onDeleted={ jest.fn() }
				onRolledBack={ jest.fn() }
			/>
		);

		expect(
			screen.getByText( 'gemini (gemini-flash-lite-latest)' )
		).toBeInTheDocument();
		// Shown twice, honestly: once as the panel's own title (rowTitle()),
		// once in the "Reply" detail section — both real uses of the same
		// humanized text, not a duplicate-rendering bug.
		expect(
			screen.getAllByText( 'You have 268 open findings.' )
		).toHaveLength( 2 );
		expect( screen.queryByText( /"status":"respond"/ ) ).not.toBeInTheDocument();
	} );

	it( 'clicking the close button calls onClose', async () => {
		const onClose = jest.fn();
		render(
			<HistoryDetailPanel
				row={ SCAN_ROW }
				onClose={ onClose }
				onDeleted={ jest.fn() }
				onRolledBack={ jest.fn() }
			/>
		);

		await userEvent.click( screen.getByLabelText( /close/i ) );

		expect( onClose ).toHaveBeenCalled();
	} );

	it( '"Delete from history" deletes the real row and calls onDeleted', async () => {
		( sendApiResponse as jest.Mock ).mockResolvedValue( { success: true } );
		const onDeleted = jest.fn();

		render(
			<HistoryDetailPanel
				row={ SCAN_ROW }
				onClose={ jest.fn() }
				onDeleted={ onDeleted }
				onRolledBack={ jest.fn() }
			/>
		);

		await userEvent.click(
			screen.getByText( 'Delete from history' )
		);

		await waitFor( () =>
			expect( sendApiResponse ).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringContaining( 'history/904' ),
				{}
			)
		);
		expect( onDeleted ).toHaveBeenCalledWith( SCAN_ROW );
		expect( NoticeManager.add ).toHaveBeenCalledWith(
			expect.objectContaining( { type: 'success' } )
		);
	} );

	it( 'shows an error notice and does not call onDeleted when delete fails', async () => {
		( sendApiResponse as jest.Mock ).mockResolvedValue( null );
		const onDeleted = jest.fn();

		render(
			<HistoryDetailPanel
				row={ SCAN_ROW }
				onClose={ jest.fn() }
				onDeleted={ onDeleted }
				onRolledBack={ jest.fn() }
			/>
		);

		await userEvent.click(
			screen.getByText( 'Delete from history' )
		);

		await waitFor( () =>
			expect( NoticeManager.add ).toHaveBeenCalledWith(
				expect.objectContaining( { type: 'error' } )
			)
		);
		expect( onDeleted ).not.toHaveBeenCalled();
	} );

	it( '"Undo this change" only shows for an executed run, and calls the real rollback endpoint', async () => {
		( sendApiResponse as jest.Mock ).mockResolvedValue( { success: true } );
		const onRolledBack = jest.fn();

		render(
			<HistoryDetailPanel
				row={ EXECUTED_CHANGE_ROW }
				onClose={ jest.fn() }
				onDeleted={ jest.fn() }
				onRolledBack={ onRolledBack }
			/>
		);

		await userEvent.click( screen.getByText( 'Undo this change' ) );

		await waitFor( () =>
			expect( sendApiResponse ).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringContaining( 'ai-action-runs/8/rollback' ),
				{}
			)
		);
		expect( onRolledBack ).toHaveBeenCalled();
	} );

	it( 'does not show "Undo this change" for a non-executed run', () => {
		render(
			<HistoryDetailPanel
				row={ PENDING_CHANGE_ROW }
				onClose={ jest.fn() }
				onDeleted={ jest.fn() }
				onRolledBack={ jest.fn() }
			/>
		);

		expect(
			screen.queryByText( 'Undo this change' )
		).not.toBeInTheDocument();
	} );
} );
