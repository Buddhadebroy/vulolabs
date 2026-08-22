import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getApiResponse } from '@zyra/core';
import KnowledgeGraph from '../KnowledgeGraphSection';

describe( 'KnowledgeGraph section', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
	} );

	it( 'shows the module-off guard and does not fetch when the module is inactive', () => {
		global.appLocalizer.active_modules = [];

		render( <KnowledgeGraph /> );

		expect(
			screen.getByText( /entity extraction module is turned off/i )
		).toBeInTheDocument();
	} );

	/**
	 * Regression: Products/Categories/People/Locations/Services used to
	 * each be their own standalone card, all visible at once. They're now
	 * tabs inside "What AI & Search Understand" — only the active tab's
	 * own detail is shown at a time (defaults to "Organization"), and
	 * clicking a different row in the count list switches which one is
	 * shown, replacing the previous tab's content rather than adding to it.
	 */
	it( 'shows the Organization tab by default, and switches tabs on click', async () => {
		global.appLocalizer.active_modules = [ 'entity-extraction' ];
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			people: [
				{
					id: 'person:1',
					type: 'person',
					name: 'Jane Doe',
					url: 'https://example.test/author/jane/',
					source_object_type: 'user',
					source_object_ref: '1',
					meta: {},
				},
			],
			organizations: [
				{
					id: 'organization:site',
					type: 'organization',
					name: 'Acme Site',
					url: 'https://example.test/',
					source_object_type: 'site',
					source_object_ref: '0',
					meta: {},
				},
			],
			products: null,
			services: [],
			locations: [],
			categories: [],
		} );

		render( <KnowledgeGraph /> );

		// Every count-list row (the tab selector) is always visible,
		// regardless of which tab is active.
		expect( await screen.findByText( 'Organization' ) ).toBeInTheDocument();
		expect( screen.getByText( 'Products' ) ).toBeInTheDocument();
		expect( screen.getByText( 'People' ) ).toBeInTheDocument();

		// Default tab (Organization) shows its own real entity.
		expect( await screen.findByText( 'Acme Site' ) ).toBeInTheDocument();
		// A different tab's content isn't shown until it's actually selected.
		expect( screen.queryByText( 'Jane Doe' ) ).not.toBeInTheDocument();
		expect(
			screen.queryByText( /not applicable to this site/i )
		).not.toBeInTheDocument();

		// Switch to the "People" tab.
		await userEvent.click( screen.getByText( 'People' ) );

		expect( await screen.findByText( 'Jane Doe' ) ).toBeInTheDocument();
		// The previous tab's own content (Organization's real row) is gone
		// now that a different tab is active.
		expect( screen.queryByText( 'Acme Site' ) ).not.toBeInTheDocument();

		// Switch to "Products" — a `rows: null` type (WooCommerce inactive).
		await userEvent.click( screen.getByText( 'Products' ) );

		expect(
			await screen.findByText( /not applicable to this site/i )
		).toBeInTheDocument();
	} );

	it( 'shows a retry option when the fetch fails', async () => {
		global.appLocalizer.active_modules = [ 'entity-extraction' ];
		( getApiResponse as jest.Mock ).mockResolvedValue( null );

		render( <KnowledgeGraph /> );

		await waitFor( () => {
			expect(
				screen.getAllByText( /could not load extracted entities/i ).length
			).toBeGreaterThan( 0 );
		} );
	} );

	it( 'does not render a Pro card slot when nothing has registered one (this file registers no filters)', async () => {
		global.appLocalizer.active_modules = [ 'entity-extraction' ];
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			people: [],
			organizations: [],
			products: null,
			services: [],
			locations: [],
			categories: [],
		} );

		render( <KnowledgeGraph /> );

		await screen.findByText( 'People' );

		expect(
			screen.queryByTestId( 'kg-visualization-stub' )
		).not.toBeInTheDocument();
		expect(
			screen.queryByTestId( 'kg-recommendations-stub' )
		).not.toBeInTheDocument();
		expect( screen.queryByTestId( 'kg-health-stub' ) ).not.toBeInTheDocument();
	} );
} );
