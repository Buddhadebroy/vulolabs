/* global appLocalizer */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, scrollToId } from '@zyra/core';
import {
	BadgeComponent,
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useFilterSlot } from '../../../services/useFilterSlot';

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
 * "Graph Visualization"/"Entity Recommendations"/"Knowledge Graph Health"
 * — vulopilot-pro's KnowledgeGraph module's own real Pro card slots.
 *
 * `useFilterSlot()`, not a plain top-level `applyFilters()` read — this
 * file used the plain-read pattern for all 3 of these slots until now,
 * which is a real, confirmed bug: BrandVisibilityTab.tsx's own docblock
 * already documents that a top-level `applyFilters()` call evaluates
 * before Pro's own script has necessarily finished registering its
 * filters (Free's bundle can finish importing and evaluating this module
 * before Pro's later `<script>` tag runs its `addFilter()` calls), which
 * leaves the slot permanently stuck at `null` regardless of whether the
 * `knowledge-graph` module is actually active — confirmed live: even with
 * that module active, "Graph Visualization" kept showing its own
 * "Graph visualization is a Pro feature" fallback every time, the exact
 * symptom that docblock describes. `useFilterSlot()` re-checks on the
 * real `vulopilot_pro_modules_loaded` event Pro's own script fires once
 * it's actually finished, which is what BrandVisibilityTab.tsx's own 4
 * slots already correctly use instead of this same broken pattern.
 */

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
 * "Knowledge Graph" section of the merged "Business Identity & Schema" tab
 * (moved here unchanged from the standalone KnowledgeGraphTab.tsx as part
 * of the original Schema+Knowledge Graph merge — see SchemaKnowledgeTab.tsx's
 * own docblock; renamed again since, per direct instruction, to match a
 * newer reference mockup — see that same docblock) — Free's own Entity
 * Extraction (6 real, deterministic entity types, KNOWLEDGE-GRAPH-MODULE.md).
 *
 * "What AI & Search Understand" replaces the former standalone "Your
 * website at a glance" stat row (Products/Business Locations/Categories
 * counts only) — real counts for all 6 entity types now (Organization/
 * Products/Categories/People/Locations/Services), plus vulopilot-pro's own
 * Graph Visualization Pro slot moved up into this same card (previously
 * a separate tile in the sidebar column) so the real entity list and the
 * real relationship diagram sit side by side, matching the mockup.
 *
 * The real "Entity Understanding" score that briefly lived here as its
 * own card moved again, up to BusinessUnderstandingCard.tsx's own hero
 * section at the top of this page — showing it here too would have
 * recreated the exact "same real number shown twice" problem fixed
 * elsewhere this session (see that file's own docblock).
 *
 * Below the summary: a real computed "What should you check?" panel, a
 * static "why this matters" explainer, then all 6 entity types as their
 * own real detail cards (EntityHighlightCard) — kept, not dropped, per
 * "existing tab data, no duplicate data" — plus vulopilot-pro's own
 * Entity Recommendations/Knowledge Graph Health Pro slots in the second
 * column. InspectorSection.tsx (JSON-LD viewer/Schema Validator/Conflict
 * Detection) used to also live in this same sidebar column; moved out to
 * SchemaKnowledgeTab.tsx's own "Technical Details (Schema & Markup)"
 * section instead — it's fundamentally a schema concern, not a
 * knowledge-graph/entity one, so it now sits next to StructuredDataSection.tsx
 * (the same real grouping the reference mockup shows) rather than nested
 * inside this section's sidebar.
 */
const KnowledgeGraphSection = () => {
	const [entities, setEntities] = useState<EntitiesResponse | null>(null);
	const [error, setError] = useState<string | null>(null);

	// Called unconditionally, before the early returns below, per the
	// rules of hooks — same reasoning BrandVisibilityTab.tsx's own 4
	// useFilterSlot() calls already document (a Pro slot resolving is
	// irrelevant on the "module off"/error branches anyway).
	const KnowledgeGraphVisualizationCard = useFilterSlot(
		'vulopilot_knowledge_graph_visualization_card'
	);
	const EntityRecommendationsCard = useFilterSlot(
		'vulopilot_knowledge_graph_recommendations_card'
	);
	const KnowledgeGraphHealthCard = useFilterSlot(
		'vulopilot_knowledge_graph_health_card'
	);

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

	const understandCounts: { key: string; icon: string; label: string; count: number }[] = entities
		? [
				{
					key: 'organizations',
					icon: 'global-community',
					label: __('Organization', 'vulopilot'),
					count: entities.organizations.length,
				},
				{
					key: 'products',
					icon: 'product',
					label: __('Products', 'vulopilot'),
					count: entities.products?.length ?? 0,
				},
				{
					key: 'categories',
					icon: 'category',
					label: __('Categories', 'vulopilot'),
					count: entities.categories.length,
				},
				{
					key: 'people',
					icon: 'person',
					label: __('People', 'vulopilot'),
					count: entities.people.length,
				},
				{
					key: 'locations',
					icon: 'location',
					label: __('Locations', 'vulopilot'),
					count: entities.locations.length,
				},
				{
					key: 'services',
					icon: 'customer-service',
					label: __('Services', 'vulopilot'),
					count: entities.services.length,
				},
			]
		: [];

	return (
		<>
			<ColumnComponent grid={8}>
				{entities && (
					<>
						<CardComponent
							title={__('What AI & Search Understand', 'vulopilot')}
							titleIcon="centralized-connections"
							desc={__(
								'These are the main things we detected on your site and how they connect.',
								'vulopilot'
							)}
							badges={[
								{ text: __('Knowledge Graph view', 'vulopilot'), color: 'purple' },
							]}
						>
							<div className="kg-understand-grid">
								<ul className="kg-understand-count-list">
									{understandCounts.map((row) => (
										<li key={row.key} className="kg-understand-count-row">
											<i className={`adminfont-${row.icon}`} />
											<span className="kg-understand-count-label">
												{row.label}
											</span>
											<span className="kg-understand-count-value">
												{row.count}
											</span>
										</li>
									))}
								</ul>
								<div className="kg-understand-graph">
									{KnowledgeGraphVisualizationCard ? (
										<KnowledgeGraphVisualizationCard />
									) : (
										<ModuleGuardComponent
											icon="centralized-connections"
											title={__(
												'Graph visualization is a Pro feature',
												'vulopilot'
											)}
											desc={__(
												'Upgrade to see how your real entities connect to each other as a diagram.',
												'vulopilot'
											)}
										/>
									)}
								</div>
							</div>
						</CardComponent>
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
					</>
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
				{entities && (
					<>
					<ColumnComponent row>
						{OTHER_ENTITY_SECTIONS.map((section) => (
								<EntityHighlightCard
									id={`kg-${section.key}`}
									icon={section.icon}
									title={section.title}
									rows={entities[section.key]}
									emptyMessage={section.emptyMessage}
								/>
							))}
					</ColumnComponent>
					</>
				)}
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
				{EntityRecommendationsCard && <EntityRecommendationsCard />}
			</ColumnComponent>
		</>
	);
};

export default KnowledgeGraphSection;
