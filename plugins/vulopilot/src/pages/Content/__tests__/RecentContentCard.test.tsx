import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { addFilter, removeFilter } from '@wordpress/hooks';
import { getApiResponse, sendApiResponse } from '@zyra/core';
import RecentContentCard from '../RecentContentCard';

const POSTS = [
	{
		id: 10,
		title: { rendered: 'How to Optimize Images for SEO' },
		content: { rendered: '<p>' + 'word '.repeat(1800) + '</p>' },
		status: 'draft',
		date: '2026-08-07T10:00:00',
		link: 'http://example.test/?p=10',
	},
];

const PAGES = [
	{
		id: 20,
		title: { rendered: 'SaaS Landing Page' },
		content: { rendered: '<p>' + 'word '.repeat(1250) + '</p>' },
		status: 'publish',
		date: '2026-08-09T10:00:00',
		link: 'http://example.test/saas-landing-page/',
		meta: { _vulopilot_landing_page: true },
	},
	{
		id: 21,
		title: { rendered: 'About Us' },
		content: { rendered: '<p>' + 'word '.repeat(100) + '</p>' },
		status: 'publish',
		date: '2026-08-01T10:00:00',
		link: 'http://example.test/about-us/',
		meta: { _vulopilot_landing_page: false },
	},
];

const PRODUCTS = [
	{
		id: 30,
		name: 'Best Headphones for Working from Home',
		description: '<p>' + 'word '.repeat(320) + '</p>',
		status: 'draft',
		date_created: '2026-08-10T05:00:00',
		permalink: 'http://example.test/product/headphones/',
	},
];

// Real GET /findings shape — object_type/object_ref join a finding back to
// the post row it belongs to (id=20, "SaaS Landing Page"). Titles follow
// the real scanner format "{issue}: {post title}" (see
// ThinContentScanner/HeadingStructureScanner's own sprintf() calls) — the
// component strips the ": SaaS Landing Page" suffix since that post
// title is already shown once as the row's own heading.
const FINDINGS_EMPTY = { data: [], total: 0 };

const OPEN_FINDINGS = {
	data: [
		{
			id: 501,
			title: 'Thin content (120 words): SaaS Landing Page',
			severity: 'low',
			status: 'open',
			scanner_id: 'thin-content',
			object_type: 'post',
			object_ref: '20',
			fix_action_id: 'improve-readability',
		},
		{
			id: 502,
			title: 'No subheadings found in long content: SaaS Landing Page',
			severity: 'medium',
			status: 'open',
			scanner_id: 'heading-structure',
			object_type: 'post',
			object_ref: '20',
			fix_action_id: 'add-subheadings',
		},
	],
	total: 2,
};

const IGNORED_FINDINGS = {
	data: [
		{
			id: 503,
			title: 'Thin content (95 words): SaaS Landing Page',
			severity: 'low',
			status: 'ignored',
			scanner_id: 'thin-content',
			object_type: 'post',
			object_ref: '20',
			fix_action_id: 'improve-readability',
		},
	],
	total: 1,
};

describe( 'RecentContentCard', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
		( sendApiResponse as jest.Mock ).mockReset();
		global.fetch = jest.fn();
		window.confirm = jest.fn( () => true );
	} );

	afterEach( () => {
		removeFilter( 'vulopilot_finding_fix_handler', 'test' );
	} );

	/**
	 * The component fires 5 real requests in this exact order: posts,
	 * pages, products, open findings, ignored findings (see
	 * RecentContentCard.tsx's own `Promise.all` — `status` only accepts
	 * one value per request, unlike `scanner_id`, so open/ignored are two
	 * separate real calls).
	 */
	const mockRealData = (
		openFindings: unknown = FINDINGS_EMPTY,
		ignoredFindings: unknown = FINDINGS_EMPTY
	) => {
		( getApiResponse as jest.Mock )
			.mockResolvedValueOnce( POSTS )
			.mockResolvedValueOnce( PAGES )
			.mockResolvedValueOnce( PRODUCTS )
			.mockResolvedValueOnce( openFindings )
			.mockResolvedValueOnce( ignoredFindings );
	};

	/** Expands a row the same way a real user does now — clicking anywhere on its own background, not a dedicated chevron (there isn't one anymore). Clicks the row's own meta line: real, visible, and neither the title link nor an action control. */
	const expandRow = async ( title: string ) => {
		const heading = await screen.findByText( title );
		const row = heading.closest( '.recent-content-row' ) as HTMLElement;
		const meta = row.querySelector(
			'.recent-content-row-meta'
		) as HTMLElement;
		await userEvent.click( meta );
		return row;
	};

	it( 'shows an honest empty state when there is no content yet', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( [] );

		render( <RecentContentCard /> );

		expect(
			await screen.findByText( /no content found yet/i )
		).toBeInTheDocument();
	} );

	it( 'renders real rows with real categories, word counts, and status', async () => {
		mockRealData();

		render( <RecentContentCard /> );

		expect(
			await screen.findByText( 'SaaS Landing Page' )
		).toBeInTheDocument();
		expect(
			screen.getByText( 'Best Headphones for Working from Home' )
		).toBeInTheDocument();
		expect(
			screen.getByText( 'How to Optimize Images for SEO' )
		).toBeInTheDocument();
		expect( screen.getByText( 'About Us' ) ).toBeInTheDocument();

		// Real category derived from the real _vulopilot_landing_page meta
		// flag — "About Us" has post_type=page too but no flag, so it's
		// "Page" (Other), not "Landing Page".
		expect( screen.getByText( /Landing Page • 1,250 words/ ) ).toBeInTheDocument();
		expect( screen.getByText( /Page • 100 words/ ) ).toBeInTheDocument();
		expect(
			screen.getByText( /Product Description • 320 words/ )
		).toBeInTheDocument();
		expect( screen.getByText( /Blog Post • 1,800 words/ ) ).toBeInTheDocument();

		expect( screen.getAllByText( 'Published' ) ).toHaveLength( 2 );
		expect( screen.getAllByText( 'Draft' ) ).toHaveLength( 2 );
	} );

	it( 'the "All resources" dropdown filters to only real product rows', async () => {
		mockRealData();

		render( <RecentContentCard /> );
		await screen.findByText( 'SaaS Landing Page' );

		await userEvent.selectOptions(
			screen.getByLabelText( 'Filter by content type' ),
			'product'
		);

		expect(
			screen.getByText( 'Best Headphones for Working from Home' )
		).toBeInTheDocument();
		expect(
			screen.queryByText( 'SaaS Landing Page' )
		).not.toBeInTheDocument();
	} );

	it( 'the search box filters rows by real title', async () => {
		mockRealData();

		render( <RecentContentCard /> );
		await screen.findByText( 'SaaS Landing Page' );

		await userEvent.type(
			screen.getByPlaceholderText( /search by title/i ),
			'headphones'
		);

		expect(
			screen.getByText( 'Best Headphones for Working from Home' )
		).toBeInTheDocument();
		expect(
			screen.queryByText( 'SaaS Landing Page' )
		).not.toBeInTheDocument();
	} );

	it( '"View All" links to the real WP posts list screen', async () => {
		mockRealData();

		render( <RecentContentCard /> );
		await screen.findByText( 'SaaS Landing Page' );

		expect( screen.getByText( 'View All' ).closest( 'a' ) ).toHaveAttribute(
			'href',
			expect.stringContaining( '/wp-admin/edit.php' )
		);
	} );

	it( 'clicking the real title navigates to the real edit screen and does NOT expand the row', async () => {
		mockRealData( OPEN_FINDINGS );

		render( <RecentContentCard /> );
		const title = await screen.findByText( 'SaaS Landing Page' );

		expect( title.closest( 'a' ) ).toHaveAttribute(
			'href',
			expect.stringContaining( 'post.php?post=20&action=edit' )
		);

		await userEvent.click( title );

		// jsdom doesn't implement real navigation — clicking a real
		// `<a href>` (the actual, real edit-screen link) logs its own
		// "Not implemented: navigation" console.error, which is expected
		// here precisely because the link is real.
		expect( console ).toHaveErrored();

		expect(
			screen.queryByText( /Thin content \(120 words\)/ )
		).not.toBeInTheDocument();
	} );

	it( 'clicking anywhere else on a row with real issues expands it; clicking again collapses it', async () => {
		mockRealData( OPEN_FINDINGS );

		render( <RecentContentCard /> );
		const row = await expandRow( 'SaaS Landing Page' );

		// The real per-post duplication is gone — the finding's own text
		// no longer repeats "SaaS Landing Page" a second time.
		expect(
			screen.getByText( 'Thin content (120 words)' )
		).toBeInTheDocument();
		expect(
			screen.getByText( 'No subheadings found in long content' )
		).toBeInTheDocument();
		expect(
			screen.queryByText( /Thin content \(120 words\): SaaS Landing Page/ )
		).not.toBeInTheDocument();

		const meta = row.querySelector(
			'.recent-content-row-meta'
		) as HTMLElement;
		await userEvent.click( meta );

		expect(
			screen.queryByText( 'Thin content (120 words)' )
		).not.toBeInTheDocument();
	} );

	it( 'a row with no real issues does not expand when clicked, and has no chevron/arrow icon', async () => {
		mockRealData( OPEN_FINDINGS );

		render( <RecentContentCard /> );
		await screen.findByText( 'SaaS Landing Page' );

		const otherRow = screen
			.getByText( 'About Us' )
			.closest( '.recent-content-row' ) as HTMLElement;

		expect( otherRow ).not.toHaveClass( 'is-expandable' );
		expect(
			otherRow.querySelector( '.recent-content-row-chevron' )
		).not.toBeInTheDocument();
		expect(
			otherRow.querySelector( 'i[class*="adminfont-arrow"]' )
		).not.toBeInTheDocument();

		const meta = otherRow.querySelector(
			'.recent-content-row-meta'
		) as HTMLElement;
		await userEvent.click( meta );

		expect(
			otherRow.querySelector( '.recent-content-row-issues' )
		).not.toBeInTheDocument();
	} );

	it( 'a row with real open issues shows a real issue-count badge, collapsed by default', async () => {
		mockRealData( OPEN_FINDINGS );

		render( <RecentContentCard /> );
		const title = await screen.findByText( 'SaaS Landing Page' );
		const row = title.closest( '.recent-content-row' ) as HTMLElement;

		expect( row.querySelector( '.recent-content-row-issue-count' ) )
			.toHaveTextContent( '2 issues' );
		expect( row ).toHaveClass( 'is-expandable' );
		// Collapsed by default — the real findings aren't in the DOM yet.
		expect(
			screen.queryByText( 'Thin content (120 words)' )
		).not.toBeInTheDocument();
	} );

	it( 'the kebab menu opens with real Edit/View links, closes on outside click, and clicking it does not expand the row', async () => {
		mockRealData( OPEN_FINDINGS );

		render( <RecentContentCard /> );
		const title = await screen.findByText( 'SaaS Landing Page' );

		const row = title.closest( '.recent-content-row' ) as HTMLElement;
		const menu = row.querySelector(
			'.recent-content-row-menu .adminfont-more-vertical'
		) as HTMLElement;
		await userEvent.click( menu );

		expect( screen.getByText( 'Edit' ).closest( 'a' ) ).toHaveAttribute(
			'href',
			expect.stringContaining( 'post.php?post=20' )
		);
		expect( screen.getByText( 'View' ).closest( 'a' ) ).toHaveAttribute(
			'href',
			'http://example.test/saas-landing-page/'
		);
		// Opening the menu is a real action control click — it must not
		// also have expanded the row's own issues.
		expect(
			screen.queryByText( 'Thin content (120 words)' )
		).not.toBeInTheDocument();

		await userEvent.click( document.body );
		expect( screen.queryByText( 'Edit' ) ).not.toBeInTheDocument();
	} );

	it( 'Delete asks for real confirmation, then really DELETEs and removes the row', async () => {
		mockRealData();
		( global.fetch as jest.Mock ).mockResolvedValue( { ok: true } );

		render( <RecentContentCard /> );
		const title = await screen.findByText( 'SaaS Landing Page' );

		const row = title.closest( '.recent-content-row' ) as HTMLElement;
		const menu = row.querySelector(
			'.recent-content-row-menu .adminfont-more-vertical'
		) as HTMLElement;
		await userEvent.click( menu );
		await userEvent.click( screen.getByText( 'Delete' ) );

		expect( window.confirm ).toHaveBeenCalled();
		await waitFor( () =>
			expect( global.fetch ).toHaveBeenCalledWith(
				expect.stringContaining( 'pages/20' ),
				expect.objectContaining( { method: 'DELETE' } )
			)
		);
		await waitFor( () =>
			expect(
				screen.queryByText( 'SaaS Landing Page' )
			).not.toBeInTheDocument()
		);
	} );

	it( 'a draft row (2 real actions: Edit + Delete, no View) shows inline buttons, not a kebab menu, and clicking one does not expand the row', async () => {
		mockRealData();

		render( <RecentContentCard /> );
		const title = await screen.findByText(
			'How to Optimize Images for SEO'
		);

		const row = title.closest( '.recent-content-row' ) as HTMLElement;

		expect(
			row.querySelector( '.recent-content-row-actions' )
		).toBeInTheDocument();
		expect(
			row.querySelector( '.recent-content-row-menu' )
		).not.toBeInTheDocument();

		const editLink = row.querySelector(
			'.recent-content-row-actions a[title="Edit"]'
		);
		expect( editLink ).toHaveAttribute(
			'href',
			expect.stringContaining( 'post.php?post=10' )
		);
	} );

	it( 'Delete does nothing if the real confirmation is declined', async () => {
		mockRealData();
		window.confirm = jest.fn( () => false );

		render( <RecentContentCard /> );
		const title = await screen.findByText( 'SaaS Landing Page' );

		const row = title.closest( '.recent-content-row' ) as HTMLElement;
		const menu = row.querySelector(
			'.recent-content-row-menu .adminfont-more-vertical'
		) as HTMLElement;
		await userEvent.click( menu );
		await userEvent.click( screen.getByText( 'Delete' ) );

		expect( global.fetch ).not.toHaveBeenCalled();
		expect( screen.getByText( 'SaaS Landing Page' ) ).toBeInTheDocument();
	} );

	it( 'the "All issues" severity dropdown narrows both which rows and which findings show', async () => {
		mockRealData( OPEN_FINDINGS );

		render( <RecentContentCard /> );
		await screen.findByText( 'SaaS Landing Page' );

		await userEvent.selectOptions(
			screen.getByLabelText( 'Filter by issue severity' ),
			'medium'
		);

		// The row itself still shows (it has a medium finding)…
		await expandRow( 'SaaS Landing Page' );

		// …but only the medium finding, not the low one.
		expect(
			screen.getByText( 'No subheadings found in long content' )
		).toBeInTheDocument();
		expect(
			screen.queryByText( 'Thin content (120 words)' )
		).not.toBeInTheDocument();

		// A row with no findings at that severity drops out entirely.
		expect( screen.queryByText( 'About Us' ) ).not.toBeInTheDocument();
	} );

	it( 'clicking "Fix with AI" opens the real Pro popup when no fix handler is registered, without collapsing the row', async () => {
		mockRealData( OPEN_FINDINGS );

		render( <RecentContentCard /> );
		await expandRow( 'SaaS Landing Page' );

		expect( screen.queryByRole( 'dialog' ) ).not.toBeInTheDocument();

		await userEvent.click( screen.getAllByText( 'Fix with AI' )[ 0 ] );

		expect( screen.getByRole( 'dialog' ) ).toBeInTheDocument();
		// The action click shouldn't have also collapsed the row.
		expect(
			screen.getByText( 'Thin content (120 words)' )
		).toBeInTheDocument();
	} );

	it( 'clicking "Fix with AI" calls the real registered fix handler and removes the finding on success', async () => {
		mockRealData( OPEN_FINDINGS );

		const fixHandler = jest.fn().mockResolvedValue( {
			success: true,
			message: 'Finding fixed.',
		} );
		addFilter(
			'vulopilot_finding_fix_handler',
			'test',
			() => fixHandler
		);

		render( <RecentContentCard /> );
		await expandRow( 'SaaS Landing Page' );

		await userEvent.click( screen.getAllByText( 'Fix with AI' )[ 0 ] );

		expect( fixHandler ).toHaveBeenCalledWith(
			expect.objectContaining( { id: 501 } )
		);
		await waitFor( () =>
			expect(
				screen.queryByText( 'Thin content (120 words)' )
			).not.toBeInTheDocument()
		);
		expect(
			screen.getByText( 'No subheadings found in long content' )
		).toBeInTheDocument();
	} );

	it( 'Resolve calls the real POST /findings/{id} and removes the finding from the row', async () => {
		mockRealData( OPEN_FINDINGS );
		( sendApiResponse as jest.Mock ).mockResolvedValue( { success: true } );

		render( <RecentContentCard /> );
		await expandRow( 'SaaS Landing Page' );

		await userEvent.click( screen.getAllByText( 'Resolve' )[ 0 ] );

		expect( sendApiResponse ).toHaveBeenCalledWith(
			expect.anything(),
			'findings/501',
			{ status: 'resolved' }
		);
		await waitFor( () =>
			expect(
				screen.queryByText( 'Thin content (120 words)' )
			).not.toBeInTheDocument()
		);
	} );

	it( 'Ignore calls the real POST /findings/{id} and removes the finding from the default (non-ignored) view', async () => {
		mockRealData( OPEN_FINDINGS );
		( sendApiResponse as jest.Mock ).mockResolvedValue( { success: true } );

		render( <RecentContentCard /> );
		await expandRow( 'SaaS Landing Page' );

		await userEvent.click( screen.getAllByText( 'Ignore' )[ 1 ] );

		expect( sendApiResponse ).toHaveBeenCalledWith(
			expect.anything(),
			'findings/502',
			{ status: 'ignored' }
		);
		await waitFor( () =>
			expect(
				screen.queryByText( 'No subheadings found in long content' )
			).not.toBeInTheDocument()
		);
	} );

	it( '"Show ignored" is off by default; switching it on reveals real ignored findings with a real Reopen action', async () => {
		mockRealData( OPEN_FINDINGS, IGNORED_FINDINGS );
		( sendApiResponse as jest.Mock ).mockResolvedValue( { success: true } );

		render( <RecentContentCard /> );
		await expandRow( 'SaaS Landing Page' );

		// Off by default — the real ignored finding isn't shown yet.
		expect(
			screen.queryByText( 'Thin content (95 words)' )
		).not.toBeInTheDocument();

		await userEvent.click( screen.getByLabelText( 'Show ignored' ) );

		const ignoredFinding = await screen.findByText(
			'Thin content (95 words)'
		);
		expect( ignoredFinding ).toBeInTheDocument();

		const ignoredRow = ignoredFinding.closest(
			'.recent-content-row-issue'
		) as HTMLElement;
		expect( ignoredRow ).toHaveClass( 'is-ignored' );
		expect( ignoredRow.querySelector( '.admin-badge' ) ).toHaveTextContent(
			'Ignored'
		);

		const reopenButton = ignoredRow.querySelector(
			'.recent-content-row-issue-resolve'
		) as HTMLElement;
		expect( reopenButton ).toHaveTextContent( 'Reopen' );
		await userEvent.click( reopenButton );

		expect( sendApiResponse ).toHaveBeenCalledWith(
			expect.anything(),
			'findings/503',
			{ status: 'open' }
		);
	} );

	it( 'Export CSV builds a real client-side export of what\'s currently on screen', async () => {
		mockRealData( OPEN_FINDINGS );

		const createObjectURL = jest.fn( () => 'blob:mock-url' );
		const revokeObjectURL = jest.fn();
		( global.URL as unknown as { createObjectURL: unknown } ).createObjectURL = createObjectURL;
		( global.URL as unknown as { revokeObjectURL: unknown } ).revokeObjectURL = revokeObjectURL;
		// jsdom doesn't implement real navigation — clicking a real
		// `<a href="blob:...">` (this component's actual, real download
		// mechanism, same as HistoryTab.tsx's own handleExport) would log
		// a "Not implemented: navigation" console.error otherwise.
		const clickSpy = jest
			.spyOn( HTMLAnchorElement.prototype, 'click' )
			.mockImplementation( () => {} );

		render( <RecentContentCard /> );
		await screen.findByText( 'SaaS Landing Page' );

		await userEvent.click( screen.getByText( 'Export CSV' ) );

		expect( createObjectURL ).toHaveBeenCalled();
		const blob = createObjectURL.mock.calls[ 0 ][ 0 ] as Blob;
		expect( blob.type ).toContain( 'text/csv' );
		expect( clickSpy ).toHaveBeenCalled();
		expect( revokeObjectURL ).toHaveBeenCalledWith( 'blob:mock-url' );

		clickSpy.mockRestore();
	} );

	it( 'never links out to the removed "Health" tab anywhere on the page', async () => {
		mockRealData( OPEN_FINDINGS );

		render( <RecentContentCard /> );
		await expandRow( 'SaaS Landing Page' );

		const healthLinks = Array.from(
			document.querySelectorAll( 'a[href*="tab=health"]' )
		);
		expect( healthLinks ).toHaveLength( 0 );
	} );
} );
