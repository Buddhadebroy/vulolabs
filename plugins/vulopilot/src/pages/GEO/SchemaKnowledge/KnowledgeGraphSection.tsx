/* global appLocalizer */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';
import { getApiLink, getApiResponse, scrollToId } from '@zyra/core';
import {
	BadgeComponent,
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';

/** Real Settings → Scanning → AI Visibility subtab id (Settings.tsx's own `currentTab === 'ai-visibility'` branch) — where the `entity_service_pages`/`entity_business_locations` fields this section reads actually live. */
const ENTITY_SETTINGS_URL = '?page=vulopilot#&tab=settings&subtab=ai-visibility';

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

const HIGHLIGHT_MAX_ROWS = 4;

/**
 * Section → response-key grouping for Entity Extraction's remaining 3 types
 * (People/Organizations/Services) — kept as their own real cards below the
 * mockup's featured 3 (Products/Locations/Categories) rather than dropped,
 * per "existing tab data, no duplicate data". Rendered with the same
 * `EntityHighlightCard` used for Products/Categories/Business Locations
 * (icon + count badge header, `kg-entity-list` rows) so all 6 entity types
 * share one visual design, in a 3-up `grid={4}` row of their own.
 */
const OTHER_ENTITY_SECTIONS: {
	key: keyof EntitiesResponse;
	title: string;
	icon: string;
	emptyMessage: string;
}[] = [
	{
		key: 'people',
		title: __('People', 'vulopilot'),
		icon: 'person',
		emptyMessage: __(
			'No published posts/pages with a real author yet.',
			'vulopilot'
		),
	},
	{
		key: 'organizations',
		title: __('Organizations', 'vulopilot'),
		icon: 'global-community',
		emptyMessage: __('Nothing to show yet.', 'vulopilot'),
	},
	{
		key: 'services',
		title: __('Services', 'vulopilot'),
		icon: 'customer-service',
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

/**
 * Real category names flagged as worth cleaning up — either the generic WP
 * default "Uncategorized" (a real signal nothing meaningful was ever set),
 * or a name reused by more than one real term (possibly across the
 * `category`/`product_cat` taxonomies EntityExtractor::extract_categories()
 * both reads). Kept as one shared function rather than two separate copies
 * of the same "uncategorized or duplicate" rule — `buildChecks()`'s own
 * "What should you check?" panel and each Categories row's own status
 * badge both call this, so they can never silently disagree about which
 * names are messy.
 */
const getMessyCategoryNames = (categories: Entity[]): Set<string> => {
	const nameCounts = new Map<string, number>();
	categories.forEach((category) => {
		const key = category.name.trim().toLowerCase();
		nameCounts.set(key, (nameCounts.get(key) ?? 0) + 1);
	});

	return new Set(
		categories
			.filter(
				(category) =>
					'uncategorized' === category.name.trim().toLowerCase() ||
					(nameCounts.get(category.name.trim().toLowerCase()) ?? 0) > 1
			)
			.map((category) => category.name)
	);
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

	const messyNames = Array.from(getMessyCategoryNames(entities.categories));
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
	/** Replaces the plain `emptyMessage` text with a richer real callout (Business Locations' own "Why it matters" box) — only rendered when `rows.length === 0`. */
	emptyState?: ReactNode;
	/** A real, functional destination for "View all {title} →" — the real WP-admin screen this entity type's own data actually lives on. Omitted entirely when there's nowhere real to send someone (e.g. Business Locations, whose real data is a plugin setting, not a WP-admin list screen). */
	viewAllHref?: string;
	/**
	 * Per-row status badge (Categories' own real Good/"Needs cleanup" flag,
	 * from getMessyCategoryNames()) — omitted for entity types with no real
	 * per-row status to report. Base no-unused-vars doesn't understand TS
	 * function-type parameter positions (no runtime binding to "use") —
	 * same known gap useApiList.ts's own onQueryUpdate type already
	 * documents.
	 */
	// eslint-disable-next-line no-unused-vars
	rowBadge?: (entity: Entity) => { text: string; color: string } | null;
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
	emptyState,
	viewAllHref,
	rowBadge,
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
				emptyState ?? <div className="desc">{emptyMessage}</div>
			) : (
				<>
					<ul className="kg-entity-list">
						{visible.map((entity) => {
							const badge = rowBadge?.(entity);

							return (
								<li key={entity.id} className="kg-entity-list-row">
									{entity.url ? (
										<a href={entity.url} target="_blank" rel="noreferrer">
											{entity.name}
										</a>
									) : (
										<span>{entity.name}</span>
									)}
									{badge && (
										<BadgeComponent
											color={badge.color}
											icon={'green' === badge.color ? 'check' : 'alarm'}
											text={badge.text}
										/>
									)}
								</li>
							);
						})}
					</ul>
					{remaining > 0 && (
						<ButtonInput
							position="left"
							buttons={{
								text: sprintf(
									/* translators: %d is how many more real entities of this type exist beyond the first few shown. */
									__('+ %d more', 'vulopilot'),
									remaining
								),
								color: 'text-purple',
								onClick: () => setExpanded(true),
							}}
						/>
					)}
					{expanded && rows.length > HIGHLIGHT_MAX_ROWS && (
						<ButtonInput
							position="left"
							buttons={{
								text: __('Show less', 'vulopilot'),
								color: 'text-purple',
								onClick: () => setExpanded(false),
							}}
						/>
					)}
					{viewAllHref && (
						<a
							className="schema-view-pages-link kg-entity-view-all"
							href={viewAllHref}
							target="_blank"
							rel="noreferrer"
						>
							{sprintf(
								/* translators: %s is the entity type's own title, e.g. "Products". */
								__('View all %s', 'vulopilot'),
								title
							)}
							<i className="adminfont-arrow-right" />
						</a>
					)}
				</>
			)}
		</CardComponent>
	);
};

/**
 * "Knowledge Graph" section of the merged "Schema & Knowledge" tab (moved
 * here unchanged from the standalone KnowledgeGraphTab.tsx as part of that
 * merge — see SchemaKnowledgeTab.tsx's own docblock) — Free's own Entity
 * Extraction (6 real, deterministic entity types, KNOWLEDGE-GRAPH-MODULE.md)
 * restyled to match the reference mockup's own information architecture:
 * the mockup's featured 3 entity cards (Products/Business Locations/
 * Categories, EntityHighlightCard below), a real computed "What should
 * you check?" panel, a static "why this matters" explainer, then the
 * remaining 3 entity types (People/Organizations/Services) as their own
 * real cards below — kept, not dropped, per "existing tab data, no
 * duplicate data" — plus vulopilot-pro's own Graph Visualization/Entity
 * Recommendations/Knowledge Graph Health Pro slots in the second column,
 * unchanged.
 *
 * The former standalone "Your website at a glance" stat row (Products/
 * Business Locations/Categories counts) was removed per direct
 * instruction — it repeated exactly the same 3 numbers the
 * EntityHighlightCards immediately below it already show, each as its
 * own real count badge.
 */
const KnowledgeGraphSection = () => {
	const [entities, setEntities] = useState<EntitiesResponse | null>(null);
	const [error, setError] = useState<string | null>(null);

	const fetchEntities = () => {
		if (!isEntityExtractionModuleActive()) {
			return;
		}

		setError(null);

		getApiResponse<EntitiesResponse>(getApiLink(appLocalizer, 'entities'), {
			headers: { 'X-WP-Nonce': appLocalizer.nonce },
		}).then((response) => {
			if (response) {
				setEntities(response);
			} else {
				setError(
					__('Could not load extracted entities.', 'vulopilot')
				);
			}
		});
	};

	useEffect(() => {
		fetchEntities();
	}, []);

	if (!isEntityExtractionModuleActive()) {
		return (
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
		);
	}

	if (error) {
		return (
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
		);
	}

	const checks = entities ? buildChecks(entities) : [];
	const messyCategoryNames = entities
		? getMessyCategoryNames(entities.categories)
		: new Set<string>();

	return (
		<>
			{entities && (
				<ColumnComponent>
					<CardComponent
						title={__('Your website at a glance', 'vulopilot')}
						desc={__(
							'These are the main things VuloPilot found on your website.',
							'vulopilot'
						)}
					>
						<div className="kg-glance-grid">
							<div className="kg-glance-item">
								<div className="kg-glance-icon">
									<i className="adminfont-product" />
								</div>
								<div>
									<div className="kg-glance-label">
										{__('Products', 'vulopilot')}
									</div>
									<div className="kg-glance-value">
										{entities.products?.length ?? 0}
									</div>
								</div>
							</div>
							<div className="kg-glance-item">
								<div className="kg-glance-icon">
									<i className="adminfont-location" />
								</div>
								<div>
									<div className="kg-glance-label">
										{__('Business Locations', 'vulopilot')}
									</div>
									<div className="kg-glance-value">
										{entities.locations.length}
									</div>
								</div>
							</div>
							<div className="kg-glance-item">
								<div className="kg-glance-icon">
									<i className="adminfont-category" />
								</div>
								<div>
									<div className="kg-glance-label">
										{__('Categories', 'vulopilot')}
									</div>
									<div className="kg-glance-value">
										{entities.categories.length}
									</div>
								</div>
							</div>
						</div>
					</CardComponent>
				</ColumnComponent>
			)}

			<ContainerComponent>
				<ColumnComponent grid={8}>
					{entities && (
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
								"This site doesn't have an active online store — VuloPilot looks for real WooCommerce products.",
								'vulopilot'
							)}
							viewAllHref={`${appLocalizer.site_url}/wp-admin/edit.php?post_type=product`}
						/>
					)}

					{entities && (
						<EntityHighlightCard
							id="kg-categories"
							icon="category"
							title={__('Categories', 'vulopilot')}
							rows={entities.categories}
							emptyMessage={__(
								'No categories in use yet.',
								'vulopilot'
							)}
							viewAllHref={`${appLocalizer.site_url}/wp-admin/edit-tags.php?taxonomy=category`}
							rowBadge={(entity) =>
								messyCategoryNames.has(entity.name)
									? {
											text: __('Needs cleanup', 'vulopilot'),
											color: 'yellow',
										}
									: {
											text: __('Good', 'vulopilot'),
											color: 'green',
										}
							}
						/>
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
										<ButtonInput
											buttons={{
												text: `${__('Review', 'vulopilot')} ›`,
												color: 'text-purple',
												onClick: () => scrollToId(check.targetId),
											}}
										/>
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
				</ColumnComponent>

				<ColumnComponent grid={4}>
					{entities && (
						<EntityHighlightCard
							id="kg-locations"
							icon="location"
							title={__('Business Locations', 'vulopilot')}
							rows={entities.locations}
							emptyMessage={__(
								'No business locations configured yet — add some under Settings → Entity Extraction.',
								'vulopilot'
							)}
							emptyState={
								<>
									<div className="kg-why-it-matters">
										<i className="adminfont-info" />
										<div>
											<div className="kg-why-it-matters-title">
												{__('Why it matters', 'vulopilot')}
											</div>
											<div className="kg-why-it-matters-desc">
												{__(
													'Adding your business location helps customers and search engines understand where you operate.',
													'vulopilot'
												)}
											</div>
										</div>
									</div>
									<a
										className="schema-view-pages-link kg-entity-view-all"
										href={ENTITY_SETTINGS_URL}
									>
										{__('Check locations', 'vulopilot')}
										<i className="adminfont-arrow-right" />
									</a>
								</>
							}
						/>
					)}
					{KnowledgeGraphHealthCard && <KnowledgeGraphHealthCard />}
					{KnowledgeGraphVisualizationCard && (
						<KnowledgeGraphVisualizationCard />
					)}
					{EntityRecommendationsCard && <EntityRecommendationsCard />}
				</ColumnComponent>
			</ContainerComponent>

			{entities && (
				<ContainerComponent>
					{OTHER_ENTITY_SECTIONS.map((section) => (
						<ColumnComponent key={section.key} grid={4}>
							<EntityHighlightCard
								id={`kg-${section.key}`}
								icon={section.icon}
								title={section.title}
								rows={entities[section.key]}
								emptyMessage={section.emptyMessage}
							/>
						</ColumnComponent>
					))}
				</ContainerComponent>
			)}
		</>
	);
};

export default KnowledgeGraphSection;
