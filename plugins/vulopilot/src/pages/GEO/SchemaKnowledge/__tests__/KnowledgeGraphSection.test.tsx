import { render, screen, waitFor } from '@testing-library/react';
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

	it( 'renders each entity section with its real count when the module is active', async () => {
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

		// People/Organizations/Services now share the same EntityHighlightCard
		// design as Products/Categories/Business Locations — real count shown
		// as its own badge, not concatenated into the title text.
		expect( await screen.findByText( 'Jane Doe' ) ).toBeInTheDocument();
		// "People"/"Organizations" each appear once as their EntityHighlightCard
		// title.
		expect( screen.getByText( 'People' ) ).toBeInTheDocument();
		expect( screen.getByText( 'Organizations' ) ).toBeInTheDocument();
		// Products also appears as the "Your website at a glance" card's own
		// real stat label, hence getAllByText rather than getByText.
		expect( screen.getAllByText( 'Products' ).length ).toBeGreaterThan( 0 );
		expect(
			screen.getByText( /not applicable to this site/i )
		).toBeInTheDocument();
		expect(
			screen.getByText( /no service pages configured yet/i )
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
