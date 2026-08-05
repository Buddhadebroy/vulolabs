import { render, screen } from '@testing-library/react';
import { getApiResponse } from '@zyra/core';

/**
 * KnowledgeGraph.tsx resolves `vulopilot_knowledge_graph_visualization_card`/
 * `vulopilot_knowledge_graph_recommendations_card`/
 * `vulopilot_knowledge_graph_health_card` via applyFilters() once, at
 * module top-level scope — same reasoning
 * BrandVisibility.pro-filters.test.tsx's own docblock documents for the
 * identical pattern.
 */
const { addFilter } = require( '@wordpress/hooks' );

addFilter(
	'vulopilot_knowledge_graph_visualization_card',
	'test/knowledge-graph-pro-filters',
	() => () => <div data-testid="kg-visualization-stub" />
);
addFilter(
	'vulopilot_knowledge_graph_recommendations_card',
	'test/knowledge-graph-pro-filters',
	() => () => <div data-testid="kg-recommendations-stub" />
);
addFilter(
	'vulopilot_knowledge_graph_health_card',
	'test/knowledge-graph-pro-filters',
	() => () => <div data-testid="kg-health-stub" />
);

const KnowledgeGraph = require( '../KnowledgeGraphTab' ).default;

describe( 'KnowledgeGraph page — Pro filter slots registered', () => {
	it( 'renders all 3 Pro cards registered via the vulopilot_knowledge_graph_* filters', async () => {
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

		expect(
			await screen.findByTestId( 'kg-visualization-stub' )
		).toBeInTheDocument();
		expect(
			screen.getByTestId( 'kg-recommendations-stub' )
		).toBeInTheDocument();
		expect( screen.getByTestId( 'kg-health-stub' ) ).toBeInTheDocument();
	} );
} );
