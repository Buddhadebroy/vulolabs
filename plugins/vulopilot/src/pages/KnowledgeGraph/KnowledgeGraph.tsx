/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
	NavigatorHeaderComponent,
} from '@zyra/components';

export interface Entity {
	id: string;
	type: string;
	name: string;
	url: string | null;
	source_object_type: string;
	source_object_ref: string;
	meta: Record<string, unknown>;
}

export interface EntitiesResponse {
	people: Entity[];
	organizations: Entity[];
	products: Entity[] | null;
	services: Entity[];
	locations: Entity[];
	categories: Entity[];
}

/**
 * Section → response-key grouping for Entity Extraction's 6 types
 * (KNOWLEDGE-GRAPH-MODULE.md). `products` is the one section rendered as a
 * ModuleGuardComponent "not applicable" state when null (WooCommerce
 * inactive), same `category_scores.woocommerce` honesty
 * DASHBOARD-WIDGETS.md already documents.
 */
const ENTITY_SECTIONS: {
	key: keyof EntitiesResponse;
	title: string;
	emptyMessage: string;
}[] = [
	{
		key: 'people',
		title: __('People', 'vulopilot'),
		emptyMessage: __(
			'No published posts/pages with a real author yet.',
			'vulopilot'
		),
	},
	{
		key: 'organizations',
		title: __('Organizations', 'vulopilot'),
		emptyMessage: __('Nothing to show yet.', 'vulopilot'),
	},
	{
		key: 'products',
		title: __('Products', 'vulopilot'),
		emptyMessage: __('No published products yet.', 'vulopilot'),
	},
	{
		key: 'services',
		title: __('Services', 'vulopilot'),
		emptyMessage: __(
			'No service pages configured yet — add some under Settings → Entity Extraction.',
			'vulopilot'
		),
	},
	{
		key: 'locations',
		title: __('Locations', 'vulopilot'),
		emptyMessage: __(
			'No business locations configured yet — add some under Settings → Entity Extraction.',
			'vulopilot'
		),
	},
	{
		key: 'categories',
		title: __('Categories', 'vulopilot'),
		emptyMessage: __('No categories in use yet.', 'vulopilot'),
	},
];

/**
 * Same "genuinely gates the underlying data" posture SEO.tsx's own
 * isSeoModuleActive() already documents — EntityExtractor returns empty
 * groups when this module is inactive (see its own docblock), so this
 * page tells the site owner why rather than showing empty lists with no
 * explanation.
 */
const isEntityExtractionModuleActive = () =>
	appLocalizer.active_modules?.includes('entity-extraction') ?? false;

/**
 * "Graph Visualization" — vulopilot-pro's KnowledgeGraph module's own
 * force-graph-style render of Free's entities + Pro's relationships, same
 * "register a source, don't modify the host" slot pattern BrandVisibility's
 * Pro card slots already use.
 */
const KnowledgeGraphVisualizationCard = applyFilters(
	'vulopilot_knowledge_graph_visualization_card',
	null
) as ComponentType | null;

/**
 * "Entity Recommendations" — same slot pattern as
 * CrawlerVisibilityCorrelationCard's slot on CrawlerTraffic.tsx.
 */
const EntityRecommendationsCard = applyFilters(
	'vulopilot_knowledge_graph_recommendations_card',
	null
) as ComponentType | null;

/**
 * "Knowledge Graph Health" — same slot pattern as the two cards above.
 */
const KnowledgeGraphHealthCard = applyFilters(
	'vulopilot_knowledge_graph_health_card',
	null
) as ComponentType | null;

/**
 * Knowledge Graph — Free's own Entity Extraction (6 real, deterministic
 * entity types, KNOWLEDGE-GRAPH-MODULE.md) plus vulopilot-pro's own
 * Graph Visualization/Entity Recommendations/Knowledge Graph Health cards.
 */
const KnowledgeGraph = () => {
	const [entities, setEntities] = useState<EntitiesResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchEntities = () => {
		if (!isEntityExtractionModuleActive()) {
			setIsLoading(false);
			return;
		}

		setIsLoading(true);
		setError(null);

		getApiResponse<EntitiesResponse>(getApiLink(appLocalizer, 'entities'), {
			headers: { 'X-WP-Nonce': appLocalizer.nonce },
		})
			.then((response) => {
				if (response) {
					setEntities(response);
				} else {
					setError(
						__('Could not load extracted entities.', 'vulopilot')
					);
				}
			})
			.finally(() => setIsLoading(false));
	};

	useEffect(() => {
		fetchEntities();
	}, []);

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="share-alt2"
				headerTitle={__('Knowledge Graph', 'vulopilot')}
				headerDescription={__(
					'Real entities extracted from your site — people, organizations, products, services, locations, and categories.',
					'vulopilot'
				)}
			/>
			<ContainerComponent general>
				<ColumnComponent>
					{!isEntityExtractionModuleActive() ? (
						<CardComponent title={__('Entity Extraction', 'vulopilot')}>
							<ModuleGuardComponent
								icon="warning"
								title={__(
									'Entity Extraction module is turned off',
									'vulopilot'
								)}
								desc={__(
									'Turn the Entity Extraction module back on from Settings → Modules to see your site\'s entities here again.',
									'vulopilot'
								)}
							/>
						</CardComponent>
					) : error ? (
						<CardComponent title={__('Knowledge Graph', 'vulopilot')}>
							<ModuleGuardComponent
								icon="warning"
								title={__(
									'Could not load extracted entities',
									'vulopilot'
								)}
								desc={error}
								buttonText={__('Retry', 'vulopilot')}
								onButtonClick={fetchEntities}
							/>
						</CardComponent>
					) : (
						!isLoading &&
						entities &&
						ENTITY_SECTIONS.map((section) => {
							const rows = entities[section.key];

							return (
								<CardComponent
									key={section.key}
									title={`${section.title} (${
										rows ? rows.length : 0
									})`}
								>
									{null === rows ? (
										<ModuleGuardComponent
											icon="info"
											title={__(
												'Not applicable to this site',
												'vulopilot'
											)}
											desc={__(
												'WooCommerce isn\'t active.',
												'vulopilot'
											)}
										/>
									) : rows.length === 0 ? (
										<p>{section.emptyMessage}</p>
									) : (
										<ul className="dashboard-widget-list">
											{rows.map((entity) => (
												<li
													key={entity.id}
													className="dashboard-widget-list-row"
												>
													<span className="dashboard-widget-list-message">
														{entity.url ? (
															<a
																href={entity.url}
																target="_blank"
																rel="noreferrer"
															>
																{entity.name}
															</a>
														) : (
															entity.name
														)}
													</span>
												</li>
											))}
										</ul>
									)}
								</CardComponent>
							);
						})
					)}
				</ColumnComponent>
				<ColumnComponent>
					{KnowledgeGraphHealthCard && <KnowledgeGraphHealthCard />}
					{KnowledgeGraphVisualizationCard && (
						<KnowledgeGraphVisualizationCard />
					)}
					{EntityRecommendationsCard && <EntityRecommendationsCard />}
				</ColumnComponent>
			</ContainerComponent>
		</>
	);
};

export default KnowledgeGraph;
