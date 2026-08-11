import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getApiResponse } from '@zyra/core';
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

describe( 'RecentContentCard', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
		global.fetch = jest.fn();
		window.confirm = jest.fn( () => true );
	} );

	const mockRealData = () => {
		( getApiResponse as jest.Mock )
			.mockResolvedValueOnce( POSTS )
			.mockResolvedValueOnce( PAGES )
			.mockResolvedValueOnce( PRODUCTS );
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

	it( 'clicking the "Products" tab filters to only real product rows', async () => {
		mockRealData();

		render( <RecentContentCard /> );
		await screen.findByText( 'SaaS Landing Page' );

		await userEvent.click( screen.getByText( 'Products' ) );

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

	it( 'the kebab menu opens with real Edit/View links, and closes on outside click', async () => {
		mockRealData();

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
} );
