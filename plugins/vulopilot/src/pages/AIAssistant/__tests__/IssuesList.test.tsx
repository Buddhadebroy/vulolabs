import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addFilter, removeFilter } from '@wordpress/hooks';
import { getApiResponse, sendApiResponse } from '@zyra/core';
import { NoticeManager } from '@zyra/components';
import IssuesList from '../IssuesList';

const FILTER_NAMESPACE = 'test/issues-list';

const GROUPS_RESPONSE = {
	data: [
		{
			scanner_id: 'weak-passwords',
			category: 'security',
			count: 18,
			severity: 'critical',
			object_type: 'user',
			label: 'Weak Password Detection',
			sample: {
				id: 474,
				title: 'Administrator "admin" is using a common, easily guessed password',
				description: 'This account\'s password matched an entry in a small dictionary.',
				object_type: 'user',
				object_ref: '1',
				created_at: '2026-08-10 07:40:46',
				page: 'Site-wide',
			},
		},
		{
			scanner_id: 'broken-links',
			category: 'seo',
			count: 12,
			severity: 'medium',
			object_type: 'url',
			label: 'Broken Links',
			sample: {
				id: 500,
				title: 'Broken link: https://example.com/old-page',
				description: 'Request failed with: HTTP 404',
				object_type: 'url',
				object_ref: 'https://example.com/old-page',
				created_at: '2026-08-09 07:40:46',
				page: '/blog/post',
			},
		},
	],
	total: 2,
	priority_counts: { high: 18, medium: 12, low: 0 },
	category_counts: { security: 18, seo: 12 },
};

/**
 * IssuesList.tsx (AI Copilot's "Issues" tab, formerly "Suggested Actions")
 * groups every open finding by issue type (`GET /findings/groups`) with
 * real stat cards, category tabs, and a detail panel — these tests cover
 * that shape, including the priority stat tiles' own real filter and the
 * detail panel's close control.
 */
describe( 'IssuesList', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
	} );

	afterEach( () => {
		removeFilter( 'vulopilot_finding_fix_handler', FILTER_NAMESPACE );
		removeFilter( 'vulopilot_finding_bulk_fix_handler', FILTER_NAMESPACE );
	} );

	it( 'shows an honest empty state when there are no open issues', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			data: [],
			total: 0,
			priority_counts: { high: 0, medium: 0, low: 0 },
			category_counts: {},
		} );

		render( <IssuesList /> );

		expect(
			await screen.findByText( /nothing to suggest right now/i )
		).toBeInTheDocument();
	} );

	it( 'renders real grouped issue rows (title, category, priority, affected count)', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( GROUPS_RESPONSE );

		render( <IssuesList /> );

		// Appears twice — the table row and the auto-selected detail panel.
		expect(
			await screen.findAllByText( 'Weak Password Detection' )
		).toHaveLength( 2 );
		expect( screen.getByText( 'Broken Links' ) ).toBeInTheDocument();
		// "18 accounts" appears twice too — the table's own Affected column
		// and the auto-selected detail panel's own Affected section.
		expect( screen.getAllByText( '18 accounts' ) ).toHaveLength( 2 );
		expect( screen.getByText( '12 endpoints' ) ).toBeInTheDocument();
	} );

	it( 'auto-selects the first group and shows its real detail panel content', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( GROUPS_RESPONSE );

		render( <IssuesList /> );

		await screen.findAllByText( 'Weak Password Detection' );

		expect(
			screen.getByText(
				'Administrator "admin" is using a common, easily guessed password'
			)
		).toBeInTheDocument();
		expect( screen.getAllByText( '18 accounts' ) ).toHaveLength( 2 );
	} );

	it( 'clicking a different row updates the detail panel', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( GROUPS_RESPONSE );

		render( <IssuesList /> );
		await screen.findAllByText( 'Weak Password Detection' );

		await userEvent.click( screen.getByText( 'Broken Links' ) );

		expect(
			await screen.findByText( 'Broken link: https://example.com/old-page' )
		).toBeInTheDocument();
	} );

	/**
	 * Regression: the close (x) button is IssueDetailPanel's own
	 * CardComponent `action` — clicking it must clear the selection back to
	 * the honest "Select an issue" empty state, not just visually hide
	 * something while a group is still considered selected underneath.
	 */
	it( 'clicking the detail panel\'s close button clears the selection', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( GROUPS_RESPONSE );

		render( <IssuesList /> );
		await screen.findAllByText( 'Weak Password Detection' );

		await userEvent.click( screen.getByLabelText( /close/i ) );

		expect(
			await screen.findByText( /select an issue/i )
		).toBeInTheDocument();
	} );

	/**
	 * Regression: this table used to fetch a flat top-20 list with no way
	 * to see real per-issue-type counts anywhere. "Resolve all"/"Ignore
	 * all"/"Fix with AI" must act on every open finding in the selected
	 * group (fetched fresh via scanner_id), not just the one sample shown.
	 */
	it( '"Resolve all" fetches the group\'s real finding ids and bulk-updates them', async () => {
		( getApiResponse as jest.Mock )
			.mockResolvedValueOnce( GROUPS_RESPONSE )
			.mockResolvedValueOnce( {
				data: [ { id: 474 }, { id: 475 } ],
				total: 2,
			} )
			// The table's own refetch() after the action completes.
			.mockResolvedValue( GROUPS_RESPONSE );

		( sendApiResponse as jest.Mock ).mockResolvedValue( { success: true } );

		render( <IssuesList /> );
		await screen.findAllByText( 'Weak Password Detection' );

		await userEvent.click( screen.getByText( 'Resolve all' ) );

		await waitFor( () =>
			expect( sendApiResponse ).toHaveBeenCalledWith(
				expect.anything(),
				expect.stringContaining( 'findings/bulk' ),
				expect.objectContaining( { ids: [ 474, 475 ], status: 'resolved' } )
			)
		);
		expect( NoticeManager.add ).toHaveBeenCalledWith(
			expect.objectContaining( {
				type: 'success',
				message: expect.stringMatching( /all findings in this group marked resolved/i ),
			} )
		);
	} );

	it( '"Fix with AI" opens the Pro popup when no bulk fix handler is registered', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( GROUPS_RESPONSE );

		render( <IssuesList /> );
		await screen.findAllByText( 'Weak Password Detection' );

		await userEvent.click( screen.getByText( 'Fix with AI' ) );

		expect(
			screen.getByText( /unlock the full vulopilot toolkit/i )
		).toBeInTheDocument();
	} );

	it( '"Fix with AI" calls the registered bulk fix handler with real group ids when active', async () => {
		( getApiResponse as jest.Mock )
			.mockResolvedValueOnce( GROUPS_RESPONSE )
			.mockResolvedValueOnce( { data: [ { id: 474 } ], total: 1 } )
			// The table's own refetch() after the action completes.
			.mockResolvedValue( GROUPS_RESPONSE );

		const bulkFixHandler = jest
			.fn()
			.mockResolvedValue( { success: true, message: 'Fixed.' } );
		addFilter(
			'vulopilot_finding_bulk_fix_handler',
			FILTER_NAMESPACE,
			() => bulkFixHandler
		);

		render( <IssuesList /> );
		await screen.findAllByText( 'Weak Password Detection' );

		await userEvent.click( screen.getByText( 'Fix with AI' ) );

		await waitFor( () =>
			expect( bulkFixHandler ).toHaveBeenCalledWith( [ 474 ] )
		);
		expect( NoticeManager.add ).toHaveBeenCalledWith(
			expect.objectContaining( { type: 'success', message: 'Fixed.' } )
		);
	} );

	it( 'switching category tabs re-fetches scoped to that category', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( GROUPS_RESPONSE );

		render( <IssuesList /> );
		await screen.findAllByText( 'Weak Password Detection' );

		( getApiResponse as jest.Mock ).mockClear();
		await userEvent.click( screen.getByText( 'Security', { selector: '.issues-category-tab' } ) );

		expect( getApiResponse ).toHaveBeenCalledWith(
			expect.stringContaining( 'category=security%2Crest-api%2Cssl' ),
			expect.anything()
		);
	} );

	/**
	 * Regression: the High/Medium/Low stat tiles used to be purely
	 * decorative — clicking "High" changed nothing about the table. They
	 * must now behave as a real server-side filter (`priority=high`),
	 * matching the same 3-tier bucket their own counts already reflect.
	 */
	it( 'clicking the "High" stat tile re-fetches scoped to that priority', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( GROUPS_RESPONSE );

		render( <IssuesList /> );
		await screen.findAllByText( 'Weak Password Detection' );

		( getApiResponse as jest.Mock ).mockClear();
		await userEvent.click( screen.getByText( 'High' ) );

		expect( getApiResponse ).toHaveBeenCalledWith(
			expect.stringContaining( 'priority=high' ),
			expect.anything()
		);
	} );

	it( 'clicking "All Issues" after a priority tile clears the priority filter', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( GROUPS_RESPONSE );

		render( <IssuesList /> );
		await screen.findAllByText( 'Weak Password Detection' );

		await userEvent.click( screen.getByText( 'Medium' ) );
		( getApiResponse as jest.Mock ).mockClear();
		await userEvent.click( screen.getByText( 'All Issues' ) );

		expect( getApiResponse ).toHaveBeenCalledWith(
			expect.not.stringContaining( 'priority=' ),
			expect.anything()
		);
	} );
} );
