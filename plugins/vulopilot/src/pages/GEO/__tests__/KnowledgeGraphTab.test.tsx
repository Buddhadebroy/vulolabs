import { render, screen, waitFor } from '@testing-library/react';
import { getApiResponse } from '@zyra/core';
import KnowledgeGraph from '../KnowledgeGraph';

describe( 'KnowledgeGraph page', () => {
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

		expect( await screen.findByText( 'People (1)' ) ).toBeInTheDocument();
		expect( screen.getByText( 'Jane Doe' ) ).toBeInTheDocument();
		expect(
			screen.getByText( 'Organizations (1)' )
		).toBeInTheDocument();
		expect( screen.getByText( 'Products (0)' ) ).toBeInTheDocument();
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

		await screen.findByText( 'People (0)' );

		expect(
			screen.queryByTestId( 'kg-visualization-stub' )
		).not.toBeInTheDocument();
		expect(
			screen.queryByTestId( 'kg-recommendations-stub' )
		).not.toBeInTheDocument();
		expect( screen.queryByTestId( 'kg-health-stub' ) ).not.toBeInTheDocument();
	} );
} );
