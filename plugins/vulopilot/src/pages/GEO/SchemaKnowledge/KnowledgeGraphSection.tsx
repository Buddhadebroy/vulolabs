/* global appLocalizer */
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	BadgeComponent,
	CardComponent,
	ColumnComponent,
	ListComponent,
	ModuleGuardComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useFilterSlot } from '../../../services/useFilterSlot';
import { KnowledgeGraphDiagram } from './KnowledgeGraphDiagramCard';

/** Real Settings → Scanning → AI Visibility subtab id (Settings.tsx's own `currentTab === 'ai-visibility'` branch) — where the `entity_business_type`/`entity_service_pages`/`entity_business_locations` fields this section (and BusinessProfileCard.tsx/KnowledgeGraphDiagramCard.tsx, which import this same constant) read actually live. */
export const ENTITY_SETTINGS_URL = '?page=vulopilot#&tab=settings&subtab=ai-visibility';


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
	/** Real, owner-provided `entity_business_type` setting (Settings → Scanning → AI Visibility) — empty string until set, never guessed. */
	business_type: string;
	/** Real, deterministic check — a published page at `/contact/` or `/contact-us/` (Services\EntityExtractor::find_contact_page(), same slug list Scanners\Basic\GeoTrustSignalsScanner's own "missing Contact page" finding already checks). */
	has_contact_page: boolean;
	contact_page_url: string | null;
	/** Real, template-built (never AI-generated) candidate relationships — see Services\EntityExtractor::build_suggested_relationships()'s own docblock for why these are "suggested," not "confirmed." */
	suggested_relationships: string[];
}

const HIGHLIGHT_MAX_ROWS = 4;

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
 * both reads). Drives the Categories tab's own real Good/"Needs cleanup"
 * status badge below.
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

interface EntityDetailContentProps {
	title: string;
	rows: Entity[] | null;
	emptyMessage: string;
	naMessage?: string;
	/** Replaces the plain `emptyMessage` text with a richer real callout (Locations' own "Why it matters" box) — only rendered when `rows.length === 0`. */
	emptyState?: ReactNode;
	/** A real, functional destination for "View all {title} →" — the real WP-admin screen this entity type's own data actually lives on. Omitted entirely when there's nowhere real to send someone (e.g. Locations, whose real data is a plugin setting, not a WP-admin list screen). */
	viewAllHref?: string;
	/** A real settings-tab deep link ("Manage in Settings →") — the entity types whose real data lives in a plugin setting rather than a WP-admin screen (Locations, Services). */
	settingsUrl?: string;
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
 * One entity type's real detail — count, first 4 real names, and a "+N
 * more" toggle that expands the same already-fetched list in place rather
 * than a modal (no modal component is otherwise used on this tab shell,
 * see GeoTab.tsx's own precedent of plain in-page navigation/scroll
 * instead of dialogs). Content only, no card chrome of its own — rendered
 * inside "What AI & Search Understand"'s own tab content area
 * (KnowledgeGraphSection's own render, below), not as a separate card, per
 * direct instruction to consolidate what used to be 5 standalone cards
 * (Products/Categories/People/Locations/Services) into that one card.
 */
const EntityDetailContent = ({
	title,
	rows,
	emptyMessage,
	naMessage,
	emptyState,
	viewAllHref,
	settingsUrl,
	rowBadge,
}: EntityDetailContentProps) => {
	const [expanded, setExpanded] = useState(false);

	if (null === rows) {
		return (
			<ModuleGuardComponent
				icon="info"
				title={__('Not applicable to this site', 'vulopilot')}
				desc={naMessage || __("WooCommerce isn't active.", 'vulopilot')}
			/>
		);
	}

	if (0 === rows.length) {
		return emptyState ?? <div className="desc">{emptyMessage}</div>;
	}

	const visible = expanded ? rows : rows.slice(0, HIGHLIGHT_MAX_ROWS);
	const remaining = rows.length - visible.length;

	return (
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
			{settingsUrl && (
				<a className="schema-view-pages-link kg-entity-view-all" href={settingsUrl}>
					{__('Manage in Settings', 'vulopilot')}
					<i className="adminfont-arrow-right" />
				</a>
			)}
		</>
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
 * "What AI & Search Understand" is now a real tabbed card, not just a
 * count list — per direct instruction ("remove the separate
 * Business Locations/Categories/People/Services cards, populate their
 * data inside this card in tabbed format, clicking a row shows that
 * tab"). Each of the 6 count-list rows (Organization/Products/Categories/
 * People/Locations/Services) IS the tab selector — clicking one sets
 * `activeEntityTab` and shows that type's own real detail (the exact same
 * list/empty-state/badge/link content the old standalone cards rendered,
 * via `EntityDetailContent`) in its own panel, inside this same card.
 * Defaults to the "Organization" tab so that panel never starts blank.
 *
 * Count list, Graph Visualization, and the active tab's detail panel sit
 * side by side as 3 columns in one row (`.kg-understand-grid`) rather than
 * the detail panel dropping to a full-width row underneath — per direct
 * instruction ("make the 3 sections side by side instead of organization
 * list in the 2nd row"). The Graph Visualization pane itself is otherwise
 * untouched — still always visible regardless of which tab is active. It
 * renders vulopilot-pro's own richer `vulopilot_knowledge_graph_visualization_card`
 * slot when that module is active; otherwise it now renders the real,
 * free `KnowledgeGraphDiagram` (imported from KnowledgeGraphDiagramCard.tsx
 * — that file's own former standalone card wrapping this same diagram was
 * removed per direct instruction, this is its only remaining render site
 * now), reusing `entities` already fetched here rather than a 2nd fetch —
 * instead of the former "Graph visualization is a Pro feature" upgrade
 * placeholder.
 */
const KnowledgeGraphSection = () => {
	const [entities, setEntities] = useState<EntitiesResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [activeEntityTab, setActiveEntityTab] =
		useState<keyof EntitiesResponse>('organizations');

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
				<CardComponent
					title={__('Entity Extraction', 'vulopilot')}
					titleIcon="centralized-connections"
					desc={__(
						'What VuloPilot extracts from your site — organizations, products, categories, people, locations, and services — and how they relate.',
						'vulopilot'
					)}
				>
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
				<CardComponent
					title={__('Knowledge Graph', 'vulopilot')}
					titleIcon="centralized-connections"
					desc={__(
						'These are the main things we detected on your site and how they connect.',
						'vulopilot'
					)}
				>
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

	const messyCategoryNames = entities
		? getMessyCategoryNames(entities.categories)
		: new Set<string>();

	/**
	 * One entry per real entity type — both the count-list/tab-selector row
	 * data AND (via the rest of the fields) exactly what EntityDetailContent
	 * needs to render that tab's own real detail, once selected. Replaces
	 * the old `understandCounts` (count-list-only) and `OTHER_ENTITY_SECTIONS`
	 * (People/Services-only) arrays — one list now covers all 6 types, since
	 * all 6 are real tabs.
	 */
	const entityTabs: {
		key: keyof EntitiesResponse;
		icon: string;
		label: string;
		count: number;
		rows: Entity[] | null;
		emptyMessage: string;
		naMessage?: string;
		emptyState?: ReactNode;
		viewAllHref?: string;
		settingsUrl?: string;
		// eslint-disable-next-line no-unused-vars
		rowBadge?: (entity: Entity) => { text: string; color: string } | null;
	}[] = entities
			? [
				{
					key: 'organizations',
					icon: 'global-community',
					label: __('Organization', 'vulopilot'),
					count: entities.organizations.length,
					rows: entities.organizations,
					emptyMessage: __(
						'No organization detected yet.',
						'vulopilot'
					),
				},
				{
					key: 'products',
					icon: 'product',
					label: __('Products', 'vulopilot'),
					count: entities.products?.length ?? 0,
					rows: entities.products,
					emptyMessage: __(
						'No published products yet.',
						'vulopilot'
					),
					naMessage: __(
						"This site doesn't have an active online store — VuloPilot looks for real WooCommerce products.",
						'vulopilot'
					),
					viewAllHref: `${appLocalizer.site_url}/wp-admin/edit.php?post_type=product`,
				},
				{
					key: 'categories',
					icon: 'category',
					label: __('Categories', 'vulopilot'),
					count: entities.categories.length,
					rows: entities.categories,
					emptyMessage: __(
						'No categories in use yet.',
						'vulopilot'
					),
					viewAllHref: `${appLocalizer.site_url}/wp-admin/edit-tags.php?taxonomy=category`,
					rowBadge: (entity) =>
						messyCategoryNames.has(entity.name)
							? {
								text: __('Needs cleanup', 'vulopilot'),
								color: 'yellow',
							}
							: {
								text: __('Good', 'vulopilot'),
								color: 'green',
							},
				},
				{
					key: 'people',
					icon: 'person',
					label: __('People', 'vulopilot'),
					count: entities.people.length,
					rows: entities.people,
					emptyMessage: __(
						'No published posts/pages with a real author yet.',
						'vulopilot'
					),
				},
				{
					key: 'locations',
					icon: 'location',
					label: __('Locations', 'vulopilot'),
					count: entities.locations.length,
					rows: entities.locations,
					emptyMessage: __(
						'No business locations configured yet.',
						'vulopilot'
					),
					settingsUrl: ENTITY_SETTINGS_URL,
					emptyState: (
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
					),
				},
				{
					key: 'services',
					icon: 'customer-service',
					label: __('Services', 'vulopilot'),
					count: entities.services.length,
					rows: entities.services,
					emptyMessage: __(
						'No service pages configured yet.',
						'vulopilot'
					),
					settingsUrl: ENTITY_SETTINGS_URL,
				},
			]
			: [];

	const activeTab = entityTabs.find((tab) => tab.key === activeEntityTab);

	const scrollToTabContent = () =>
		document
			.getElementById('kg-entity-tab-content')
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });

	return (
		<>
			<ColumnComponent >
				{entities && (
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
							<ListComponent
								className="kg-understand-count-list"
								items={entityTabs.map((tab) => ({
									id: tab.key,
									icon: tab.icon,
									title: tab.label,
									className:
										tab.key === activeEntityTab ? 'is-active' : '',
									tags: (
										<span className="kg-understand-count-value">
											{tab.count}
										</span>
									),
									action: () => {
										setActiveEntityTab(tab.key);
										scrollToTabContent();
									},
								}))}
							/>
							<div className="kg-understand-graph">
								{KnowledgeGraphVisualizationCard ? (
									<KnowledgeGraphVisualizationCard />
								) : (
									<KnowledgeGraphDiagram entities={entities} />
								)}
							</div>

							{activeTab && (
								<div
									id="kg-entity-tab-content"
									className="kg-entity-tab-content"
								>
									<div className="kg-entity-tab-content-header">
										<i className={`adminfont-${activeTab.icon}`} />
										<span className="kg-entity-tab-content-title">
											{activeTab.label}
										</span>
										<BadgeComponent
											color={activeTab.count > 0 ? 'green' : 'grey'}
											text={String(activeTab.count)}
										/>
									</div>
									<EntityDetailContent
										title={activeTab.label}
										rows={activeTab.rows}
										emptyMessage={activeTab.emptyMessage}
										naMessage={activeTab.naMessage}
										emptyState={activeTab.emptyState}
										viewAllHref={activeTab.viewAllHref}
										settingsUrl={activeTab.settingsUrl}
										rowBadge={activeTab.rowBadge}
									/>
								</div>
							)}
						</div>
					</CardComponent>
				)}

			</ColumnComponent>
			{KnowledgeGraphHealthCard &&
				<ColumnComponent grid={6} fullHeight>
					<KnowledgeGraphHealthCard />
				</ColumnComponent>
			}
			{EntityRecommendationsCard &&
				<ColumnComponent grid={6} fullHeight>
					<EntityRecommendationsCard />
				</ColumnComponent>
			}
		</>
	);
};

export default KnowledgeGraphSection;
