/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
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
 * The 3 entity types the reference mockup features as its own highlighted
 * "at a glance" row + dedicated cards — real counts straight off the same
 * `entities` response the rest of this tab already fetches, no second
 * request. `products` stays in this row even when WooCommerce is inactive
 * (rendered as a real "0, not applicable" state rather than hidden) so the
 * glance row's own 3 numbers always add up to what the cards below it show.
 */
const GLANCE_ITEMS: {
	key: 'products' | 'locations' | 'categories';
	entityKey: keyof EntitiesResponse;
	label: string;
	icon: string;
}[] = [
	{
		key: 'products',
		entityKey: 'products',
		label: __('Products', 'vulopilot'),
		icon: 'product',
	},
	{
		key: 'locations',
		entityKey: 'locations',
		label: __('Business Locations', 'vulopilot'),
		icon: 'location',
	},
	{
		key: 'categories',
		entityKey: 'categories',
		label: __('Categories', 'vulopilot'),
		icon: 'category',
	},
];

const HIGHLIGHT_MAX_ROWS = 4;

/**
 * Section → response-key grouping for Entity Extraction's remaining 3 types
 * (People/Organizations/Services) — kept as their own real cards below the
 * mockup's featured 3 (Products/Locations/Categories) rather than dropped,
 * per "existing tab data, no duplicate data".
 */
const OTHER_ENTITY_SECTIONS: {
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
		key: 'services',
		title: __('Services', 'vulopilot'),
		emptyMessage: __(
			'No service pages configured yet — add some under Settings → Entity Extraction.',
			'vulopilot'
		),
	},
];

/**
 * Same "genuinely gates the underlying data" posture SeoTab.tsx's own
 * isSeoModuleActive() already documents — EntityExtractor returns empty
 * groups when this module is inactive (see its own docblock), so this
 * tab tells the site owner why rather than showing empty lists with no
 * explanation.
 */
const isEntityExtractionModuleActive = () =>
	appLocalizer.active_modules?.includes('entity-extraction') ?? false;

/**
 * "Graph Visualization" — vulopilot-pro's KnowledgeGraph module's own
 * force-graph-style render of Free's entities + Pro's relationships, same
 * "register a source, don't modify the host" slot pattern BrandVisibilityTab's
 * Pro card slots already use.
 */
const KnowledgeGraphVisualizationCard = applyFilters(
	'vulopilot_knowledge_graph_visualization_card',
	null
) as ComponentType | null;

/**
 * "Entity Recommendations" — same slot pattern as
 * CrawlerVisibilityCorrelationCard's slot on CrawlerTrafficTab.tsx.
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

const scrollToId = (id: string) => {
	const el = document.getElementById(id);
	if (!el) {
		return;
	}
	el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	el.classList.add('vulopilot-glimpse-highlight');
	setTimeout(() => el.classList.remove('vulopilot-glimpse-highlight'), 1200);
};

/**
 * Real, computed "What should you check?" findings — no fabricated numbers,
 * every item here is derived directly from the same `entities` response
 * already on screen. Mirrors the reference mockup's own 2 example checks
 * (no locations found / category names need cleaning) but only shows an
 * item when it's actually true for this site's real data.
 */
const buildChecks = (entities: EntitiesResponse) => {
	const checks: {
		key: string;
		icon: string;
		title: string;
		desc: string;
		targetId: string;
	}[] = [];

	if (entities.locations.length === 0) {
		checks.push({
			key: 'no-locations',
			icon: 'location',
			title: __('No business locations found', 'vulopilot'),
			desc: __(
				'No business locations were identified on your website.',
				'vulopilot'
			),
			targetId: 'kg-locations',
		});
	}

	const nameCounts = new Map<string, number>();
	entities.categories.forEach((category) => {
		const key = category.name.trim().toLowerCase();
		nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
	});
	const messyNames = Array.from(
		new Set(
			entities.categories
				.filter(
					(category) =>
						'uncategorized' === category.name.trim().toLowerCase() ||
						(nameCounts.get(category.name.trim().toLowerCase()) ?? 0) > 1
				)
				.map((category) => category.name)
		)
	);
	if (messyNames.length > 0) {
		checks.push({
			key: 'messy-categories',
			icon: 'category',
			title: __('Category names need cleaning', 'vulopilot'),
			desc: sprintf(
				/* translators: %s is a comma-separated list of real category names found on this site (duplicates and/or "Uncategorized"). */
				__('%s detected.', 'vulopilot'),
				messyNames.join(', ')
			),
			targetId: 'kg-categories',
		});
	}

	return checks;
};

interface EntityHighlightCardProps {
	id: string;
	icon: string;
	title: string;
	rows: Entity[] | null;
	emptyMessage: string;
	naMessage?: string;
}

/**
 * One of the mockup's 3 featured entity cards (Products/Business Locations/
 * Categories) — real count, first 4 real names, and a "+N more" toggle that
 * expands the same already-fetched list in place rather than a modal (no
 * modal component is otherwise used on this tab shell, see GeoTab.tsx's own
 * precedent of plain in-page navigation/scroll instead of dialogs).
 */
const EntityHighlightCard = ({
	id,
	icon,
	title,
	rows,
	emptyMessage,
	naMessage,
}: EntityHighlightCardProps) => {
	const [expanded, setExpanded] = useState(false);

	if (null === rows) {
		return (
			<CardComponent id={id} className="kg-entity-card" title={title} titleIcon={icon}>
				<ModuleGuardComponent
					icon="info"
					title={__('Not applicable to this site', 'vulopilot')}
					desc={naMessage || __("WooCommerce isn't active.", 'vulopilot')}
				/>
			</CardComponent>
		);
	}

	const visible = expanded ? rows : rows.slice(0, HIGHLIGHT_MAX_ROWS);
	const remaining = rows.length - visible.length;

	return (
		<CardComponent
			id={id}
			className="kg-entity-card"
			title={title}
			titleIcon={icon}
			badges={[{ text: String(rows.length), color: rows.length > 0 ? 'green' : 'grey' }]}
		>
			{0 === rows.length ? (
				<div className="desc">{emptyMessage}</div>
			) : (
				<>
					<ul className="kg-entity-list">
						{visible.map((entity) => (
							<li key={entity.id} className="kg-entity-list-row">
								{entity.url ? (
									<a href={entity.url} target="_blank" rel="noreferrer">
										{entity.name}
									</a>
								) : (
									<span>{entity.name}</span>
								)}
							</li>
						))}
					</ul>
					{remaining > 0 && (
						<button
							type="button"
							className="kg-entity-toggle"
							onClick={() => setExpanded(true)}
						>
							{sprintf(
								/* translators: %d is how many more real entities of this type exist beyond the first few shown. */
								__('+ %d more', 'vulopilot'),
								remaining
							)}
						</button>
					)}
					{expanded && rows.length > HIGHLIGHT_MAX_ROWS && (
						<button
							type="button"
							className="kg-entity-toggle"
							onClick={() => setExpanded(false)}
						>
							{__('Show less', 'vulopilot')}
						</button>
					)}
				</>
			)}
		</CardComponent>
	);
};

/**
 * "Knowledge Graph" tab of "Grow My Traffic" — Free's own Entity
 * Extraction (6 real, deterministic entity types, KNOWLEDGE-GRAPH-MODULE.md)
 * restyled to match the reference mockup's own information architecture:
 * a real "at a glance" stat row, the mockup's featured 3 entity cards
 * (Products/Business Locations/Categories, EntityHighlightCard above), a
 * real computed "What should you check?" panel, a static "why this
 * matters" explainer, then the remaining 3 entity types
 * (People/Organizations/Services) as their own real cards below — kept, not
 * dropped, per "existing tab data, no duplicate data" — plus
 * vulopilot-pro's own Graph Visualization/Entity Recommendations/Knowledge
 * Graph Health Pro slots in the second column, unchanged.
 */
const KnowledgeGraphTab = () => {
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

	if (!isEntityExtractionModuleActive()) {
		return (
			<ContainerComponent general>
				<ColumnComponent>
					<CardComponent title={__('Entity Extraction', 'vulopilot')}>
						<ModuleGuardComponent
							icon="error"
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
				</ColumnComponent>
			</ContainerComponent>
		);
	}

	if (error) {
		return (
			<ContainerComponent general>
				<ColumnComponent>
					<CardComponent title={__('Knowledge Graph', 'vulopilot')}>
						<ModuleGuardComponent
							icon="error"
							title={__(
								'Could not load extracted entities',
								'vulopilot'
							)}
							desc={error}
							buttonText={__('Retry', 'vulopilot')}
							onButtonClick={fetchEntities}
						/>
					</CardComponent>
				</ColumnComponent>
			</ContainerComponent>
		);
	}

	const checks = entities ? buildChecks(entities) : [];

	return (
		<ContainerComponent general>
			<ColumnComponent>
				<CardComponent
					title={__('Your website at a glance', 'vulopilot')}
					desc={__(
						'These are the main things VuloPilot found on your website.',
						'vulopilot'
					)}
					isLoading={isLoading}
				>
					{entities && (
						<div className="kg-glance-grid">
							{GLANCE_ITEMS.map((item) => {
								const rows = entities[item.entityKey];
								return (
									<div key={item.key} className="kg-glance-item">
										<div className="kg-glance-icon">
											<i className={`adminfont-${item.icon}`} />
										</div>
										<div>
											<div className="kg-glance-label">
												{item.label}
											</div>
											<div className="kg-glance-value">
												{null === rows ? '—' : rows.length}
											</div>
										</div>
									</div>
								);
							})}
						</div>
					)}
				</CardComponent>

				{entities && (
					<ContainerComponent>
						<ColumnComponent grid={4}>
							<EntityHighlightCard
								id="kg-products"
								icon="product"
								title={__('Products', 'vulopilot')}
								rows={entities.products}
								emptyMessage={__(
									'No published products yet.',
									'vulopilot'
								)}
								naMessage={__(
									"VuloPilot didn't find a business location on your website.",
									'vulopilot'
								)}
							/>
						</ColumnComponent>
						<ColumnComponent grid={4}>
							<EntityHighlightCard
								id="kg-locations"
								icon="location"
								title={__('Business Locations', 'vulopilot')}
								rows={entities.locations}
								emptyMessage={__(
									'No business locations configured yet — add some under Settings → Entity Extraction.',
									'vulopilot'
								)}
							/>
						</ColumnComponent>
						<ColumnComponent grid={4}>
							<EntityHighlightCard
								id="kg-categories"
								icon="category"
								title={__('Categories', 'vulopilot')}
								rows={entities.categories}
								emptyMessage={__(
									'No categories in use yet.',
									'vulopilot'
								)}
							/>
						</ColumnComponent>
					</ContainerComponent>
				)}

				{checks.length > 0 && (
					<CardComponent
						title={__('What should you check?', 'vulopilot')}
						titleIcon="analytics"
						desc={__(
							'A few things on your website are worth reviewing.',
							'vulopilot'
						)}
					>
						<div className="kg-check-list">
							{checks.map((check) => (
								<div key={check.key} className="kg-check-row">
									<div className="kg-check-icon">
										<i className={`adminfont-${check.icon}`} />
									</div>
									<div className="kg-check-body">
										<div className="kg-check-title">
											{check.title}
										</div>
										<div className="kg-check-desc">
											{check.desc}
										</div>
									</div>
									<button
										type="button"
										className="geo-card-view-all"
										onClick={() => scrollToId(check.targetId)}
									>
										{__('Review', 'vulopilot')} ›
									</button>
								</div>
							))}
						</div>
					</CardComponent>
				)}

				<CardComponent
					title={__('Why does this matter?', 'vulopilot')}
					titleIcon="info"
				>
					<div className="desc">
						{__(
							'Search engines and AI systems need to understand who you are, what you offer, and what the important things on your website are. Clear, accurate information helps your content show up in more relevant searches and AI answers.',
							'vulopilot'
						)}
					</div>
				</CardComponent>

				{entities &&
					OTHER_ENTITY_SECTIONS.map((section) => {
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
											"WooCommerce isn't active.",
											'vulopilot'
										)}
									/>
								) : rows.length === 0 ? (
									<div className="desc">{section.emptyMessage}</div>
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
					})}
			</ColumnComponent>
			<ColumnComponent>
				{KnowledgeGraphHealthCard && <KnowledgeGraphHealthCard />}
				{KnowledgeGraphVisualizationCard && (
					<KnowledgeGraphVisualizationCard />
				)}
				{EntityRecommendationsCard && <EntityRecommendationsCard />}
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default KnowledgeGraphTab;
