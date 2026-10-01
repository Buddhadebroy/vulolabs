/* global vulopilotAppLocalizer */
import { __, _n, sprintf } from '@wordpress/i18n';
import type { EntitiesResponse } from './KnowledgeGraphSection';
import { ENTITY_SETTINGS_URL } from './KnowledgeGraphSection';

interface DiagramNode {
	key: string;
	/** Small label shown above the node's own box - the entity TYPE name (e.g. "Category"), never the value itself. */
	label: string;
	found: boolean;
	/** True only for Products with no WooCommerce active - a real "doesn't apply" state, told apart from a real, fixable "missing" gap. */
	notApplicable?: boolean;
	/** The real value shown inside the box once found - a real count ("2 Categories"), a real name ("admin"), or the site's own real URL. */
	value: string;
	/** Real, functional "add this" destination - set only for entity types with an actual real place to add one (Category → the real WP admin term-manager screen, Location → the real owner-curated setting, Products → the real WP admin new-product screen). */
	ctaText?: string;
	ctaHref?: string;
}

/**
 * Real node list - one entry per entity type this diagram shows.
 */
export const buildDiagramNodes = (entities: EntitiesResponse): DiagramNode[] => {
	const siteUrl = vulopilotAppLocalizer.site_url;

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
			// No real "add a person" workflow exists - People are
			// auto-detected from real post authorship, not owner-curated.
		},
		{
			key: 'website',
			label: __('Website', 'vulopilot'),
			// The site's own real URL - always real, always found
			// (Services\EntityExtractor::extract_organizations() always returns a real entry, at
			// minimum the site's own title/URL).
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
 * Node/box design matches a newer reference mockup exactly.
 */
export const KnowledgeGraphDiagram = ({ entities }: KnowledgeGraphDiagramProps) => {
	const businessName = entities.organizations[0]?.name || __('Your business', 'vulopilot');
	const nodes = buildDiagramNodes(entities);

	// Evenly spaced around the center, starting from the top.
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
