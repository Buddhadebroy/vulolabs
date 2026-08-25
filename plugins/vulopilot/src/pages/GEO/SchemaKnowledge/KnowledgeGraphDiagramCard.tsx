/* global appLocalizer */
import { __, _n, sprintf } from '@wordpress/i18n';
import type { EntitiesResponse } from './KnowledgeGraphSection';
import { ENTITY_SETTINGS_URL } from './KnowledgeGraphSection';

interface DiagramNode {
	key: string;
	/** Small label shown above the node's own box — the entity TYPE name (e.g. "Category"), never the value itself. */
	label: string;
	found: boolean;
	/** True only for Products with no WooCommerce active — a real "doesn't apply" state, told apart from a real, fixable "missing" gap. */
	notApplicable?: boolean;
	/** The real value shown inside the box once found — a real count ("2 Categories"), a real name ("admin"), or the site's own real URL. Empty when `!found`. */
	value: string;
	/** Real, functional "add this" destination — set only for entity types with an actual real place to add one (Category → the real WP admin term-manager screen, Location → the real owner-curated setting, Products → the real WP admin new-product screen). Left unset for types with no real add workflow of their own (Person: auto-detected from real post authorship, nothing to "add" here) and for Website (always real, never missing). */
	ctaText?: string;
	ctaHref?: string;
}

/**
 * Real node list — one entry per entity type this diagram shows, built
 * from `GET /entities`'s own real counts/names/flags (plus the site's own
 * real URL for Website). Shared by both render sites of this same diagram
 * (see `KnowledgeGraphDiagram` below): this card's own full-size
 * rendering, and KnowledgeGraphSection.tsx's "What AI & Search Understand"
 * card, which renders the same real nodes at `compact` size in its own
 * middle pane instead of duplicating this list or re-deriving it from a
 * 2nd fetch.
 *
 * Node set matches a newer reference mockup exactly (Category/Location/
 * Person/Products/Website) — a deliberate, direct-instruction change from
 * an earlier Services/Contact-based set; those 2 real signals still exist
 * (Services has its own count-list tab beside this diagram, Contact
 * details is its own row on BusinessProfileCard.tsx), they're just not
 * graph nodes any more.
 */
export const buildDiagramNodes = (entities: EntitiesResponse): DiagramNode[] => {
	const siteUrl = appLocalizer.site_url;

	const categoryCount = entities.categories.length;
	const locationCount = entities.locations.length;
	const peopleCount = entities.people.length;
	const productsNotApplicable = null === entities.products;
	const productCount = entities.products?.length ?? 0;

	return [
		{
			key: 'category',
			label: __('Category', 'vulopilot'),
			found: categoryCount > 0,
			value:
				categoryCount > 0
					? sprintf(
							/* translators: %d is a real category count. */
							_n('%d Category', '%d Categories', categoryCount, 'vulopilot'),
							categoryCount
						)
					: '',
			ctaText: 0 === categoryCount ? __('Add category', 'vulopilot') : undefined,
			ctaHref: 0 === categoryCount ? `${siteUrl}/wp-admin/edit-tags.php?taxonomy=category` : undefined,
		},
		{
			key: 'person',
			label: __('Person', 'vulopilot'),
			found: peopleCount > 0,
			value:
				1 === peopleCount
					? entities.people[0].name
					: peopleCount > 0
						? sprintf(
								/* translators: %d is a real count of published-post authors. */
								__('%d People', 'vulopilot'),
								peopleCount
							)
						: '',
			// No real "add a person" workflow exists — People are
			// auto-detected from real post authorship, not owner-curated.
		},
		{
			key: 'website',
			label: __('Website', 'vulopilot'),
			// The site's own real URL — always real, always found
			// (Services\EntityExtractor::extract_organizations() always
			// returns a real entry, at minimum the site's own title/URL).
			found: true,
			value: entities.organizations[0]?.url || siteUrl,
		},
		{
			key: 'products',
			label: __('Products', 'vulopilot'),
			found: !productsNotApplicable && productCount > 0,
			notApplicable: productsNotApplicable,
			value:
				!productsNotApplicable && productCount > 0
					? sprintf(
							/* translators: %d is a real published-WooCommerce-product count. */
							_n('%d Product', '%d Products', productCount, 'vulopilot'),
							productCount
						)
					: '',
			ctaText: !productsNotApplicable && 0 === productCount ? __('Add product', 'vulopilot') : undefined,
			ctaHref:
				!productsNotApplicable && 0 === productCount
					? `${siteUrl}/wp-admin/post-new.php?post_type=product`
					: undefined,
		},
		{
			key: 'location',
			label: __('Location', 'vulopilot'),
			found: locationCount > 0,
			value:
				1 === locationCount
					? entities.locations[0].name
					: locationCount > 0
						? sprintf(
								/* translators: %d is a real, owner-curated location count. */
								_n('%d Location', '%d Locations', locationCount, 'vulopilot'),
								locationCount
							)
						: '',
			ctaText: 0 === locationCount ? __('Add location', 'vulopilot') : undefined,
			ctaHref: 0 === locationCount ? ENTITY_SETTINGS_URL : undefined,
		},
	];
};

interface KnowledgeGraphDiagramProps {
	entities: EntitiesResponse;
}

/**
 * The real hub-and-spoke visualization itself — nodes/lines only, no card
 * chrome, no "Suggested relationships" panel (a standalone card wrapping
 * this with that panel used to exist here too — removed per direct
 * instruction ("remove this section"), since KnowledgeGraphSection.tsx's
 * own "What AI & Search Understand" card below already renders this exact
 * same real diagram at `compact` size and was the only real content this
 * file's own former card duplicated a 2nd time). Exported so
 * KnowledgeGraphSection.tsx can render this real diagram (not a 2nd,
 * separately-maintained one) inline in its own "What AI & Search
 * Understand" card, replacing that card's former Pro-only "Graph
 * visualization is a Pro feature" fallback with this always-real default
 * — Pro's own richer `vulopilot_knowledge_graph_visualization_card` filter
 * slot still renders first when it resolves (see that file's own
 * `useFilterSlot()` call).
 *
 * Node/box design matches a newer reference mockup exactly: each satellite
 * is its own real rounded-box "card" (a real type label above, a real
 * value or a real "Not found" + a real, functional "Add …" link inside),
 * connected to the center by a plain dashed line — status now lives on the
 * box itself (found/missing/not-applicable colors), not on the connector,
 * so there's no separate legend to keep in sync any more. Every value
 * shown is real: a real count, a real name, or the site's own real URL —
 * never fabricated, and "Add category"/"Add product"/"Add location" are
 * real, functional deep links (see `buildDiagramNodes()`'s own docblock
 * for exactly where each one goes and why Person/Website never show one).
 *
 * Sized for KnowledgeGraphSection.tsx's own `.kg-understand-graph` pane —
 * its only remaining render site since the standalone card that used to
 * render this at a 2nd, larger size was removed (see this file's own
 * docblock above); `.kg-diagram-wrap`'s own sizing in SeoVisibility.scss
 * is that pane's compact size directly now, not a `--compact` modifier.
 */
export const KnowledgeGraphDiagram = ({ entities }: KnowledgeGraphDiagramProps) => {
	const businessName = entities.organizations[0]?.name || __('Your business', 'vulopilot');
	const nodes = buildDiagramNodes(entities);

	// Evenly spaced around the center, starting from the top — a real,
	// deterministic layout (not hand-placed per node), so it stays correct
	// if a future node is ever added/removed from the array above.
	const RADIUS_X = 42;
	const RADIUS_Y = 40;
	const nodePositions = nodes.map((node, index) => {
		const angle = (index / nodes.length) * 2 * Math.PI - Math.PI / 2;
		return {
			...node,
			left: 50 + RADIUS_X * Math.cos(angle),
			top: 50 + RADIUS_Y * Math.sin(angle),
		};
	});

	return (
		<div className="kg-diagram-wrap">
			<svg className="kg-diagram-lines" viewBox="0 0 100 100" preserveAspectRatio="none">
				{nodePositions.map((node) => (
					<line key={node.key} x1={50} y1={50} x2={node.left} y2={node.top} />
				))}
			</svg>

			<div className="kg-diagram-node kg-diagram-node--center">
				<span className="kg-diagram-node-center-icon">
					<i className="adminfont-global-community" />
				</span>
				<span className="kg-diagram-node-center-name">{businessName}</span>
				<span className="kg-diagram-node-center-sub">{__('Organization', 'vulopilot')}</span>
			</div>

			{nodePositions.map((node) => {
				const statusClass = node.notApplicable ? 'is-na' : node.found ? 'is-found' : 'is-missing';

				return (
					<div
						key={node.key}
						className="kg-diagram-node kg-diagram-node--satellite"
						style={{ left: `${node.left}%`, top: `${node.top}%` }}
					>
						<span className="kg-diagram-node-label">{node.label}</span>
						<div className={`kg-diagram-node-box ${statusClass}`}>
							{node.notApplicable ? (
								<span className="kg-diagram-node-na-text">{__('Not applicable', 'vulopilot')}</span>
							) : node.found ? (
								<span className="kg-diagram-node-value">{node.value}</span>
							) : (
								<>
									<span className="kg-diagram-node-missing-text">{__('Not found', 'vulopilot')}</span>
									{node.ctaHref && (
										<a className="kg-diagram-node-cta" href={node.ctaHref}>
											{node.ctaText}
										</a>
									)}
								</>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
};
