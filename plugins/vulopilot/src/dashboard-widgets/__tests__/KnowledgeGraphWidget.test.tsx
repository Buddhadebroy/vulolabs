import { render, screen } from '@testing-library/react';
import { getApiResponse } from '@zyra/core';
import KnowledgeGraphWidget from '../KnowledgeGraphWidget';

describe( 'KnowledgeGraphWidget', () => {
	beforeEach( () => {
		( getApiResponse as jest.Mock ).mockReset();
	} );

	it( 'shows the empty state when there are no entities at all', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			people: [],
			organizations: [],
			products: null,
			services: [],
			locations: [],
			categories: [],
		} );

		render(
			<KnowledgeGraphWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect(
			await screen.findByText( /no entities extracted yet/i )
		).toBeInTheDocument();
	} );

	it( 'renders a count row per entity type', async () => {
		( getApiResponse as jest.Mock ).mockResolvedValue( {
			people: [ { id: 'person:1' } ],
			organizations: [ { id: 'organization:site' } ],
			products: null,
			services: [],
			locations: [],
			categories: [
				{ id: 'category:1' },
				{ id: 'category:2' },
			],
		} );

		render(
			<KnowledgeGraphWidget
				summary={ {} as never }
				isLoading={ false }
				onHide={ jest.fn() }
				isCustomizing={ false }
			/>
		);

		expect( await screen.findByText( 'People' ) ).toBeInTheDocument();
		expect(
			screen.getByText( 'People' ).closest( 'li' )
		).toHaveTextContent( '1' );
		expect(
			screen.getByText( 'Categories' ).closest( 'li' )
		).toHaveTextContent( '2' );
	} );
} );
