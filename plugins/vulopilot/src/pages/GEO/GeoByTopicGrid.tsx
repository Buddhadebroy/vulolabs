import { __, _n, sprintf } from '@wordpress/i18n';
import { MetricTileComponent, SectionComponent } from '@zyra/components';
import type { MetricTileItem } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { sumGroupCounts } from './useGeoFindingGroups';
import { countDistinctAffectedPages } from './useGeoTopicAffectedPages';
import type { FindingGroup } from '../AIAssistant/issuesTypes';
import type { FindingsSection } from '../Security/SectionedFindingsTab';

interface GeoTopicDefinition extends FindingsSection {
	titleIcon: string;
}

interface GeoByTopicGridProps {
	topics: GeoTopicDefinition[];
	groups: FindingGroup[];
	isLoading: boolean;
	onViewTopic: (key: string) => void;
	/** Defaults to "A Closer Look, By Topic" (GEO tab) — AeoTab.tsx passes "AEO Checks at a Glance" instead, reusing this same real per-section grid rather than a second copy of it. */
	title?: string;
	desc?: string;
	/**
	 * Real distinct-page-count-per-scanner map (useGeoTopicAffectedPages.ts)
	 * — when passed, each tile also shows a real "Affected pages" stat next
	 * to "Open issues" (matching the reference mockup's own two-stat tile
	 * layout). Optional so a caller that hasn't wired this fetch up yet
	 * still gets the single-stat tile this grid always showed before,
	 * rather than a broken "0 affected pages" for every topic.
	 */
	affectedPagesByScanner?: Map<string, Set<number>>;
}

/**
 * "A Closer Look, By Topic" — one real tile per unified-table section
 * (`topics`, owned by GeoTab.tsx so this grid and the "All GEO Issues"
 * table below it always agree on the same 5 groupings), each showing the
 * real open-issue count for that topic (`sumGroupCounts`, same `groups`
 * fetch GeoFixTheseFirstCard.tsx already uses — no second fetch). "View
 * issues" switches the unified table's own active tab to that topic
 * instead of duplicating a second findings list here.
 *
 * Tiles are a real `MetricTileComponent` (`@zyra/components`) —
 * icon/title/badge/grid shell all come from there now; only this grid's
 * own divergent stat body (the two-stat "Open issues"/"Affected pages"
 * row, or the single-line sublabel fallback) still needs its own markup,
 * passed through that component's own `desc` slot (arbitrary content, not
 * just text) — same "real content lives in `desc`, shell comes from
 * MetricTileComponent" split CommerceCategoryGrid.tsx's own category tiles
 * already use.
 */
const GeoByTopicGrid = ({
	topics,
	groups,
	isLoading,
	onViewTopic,
	title,
	desc,
	affectedPagesByScanner,
}: GeoByTopicGridProps) => {
	const tiles: MetricTileItem[] = topics.map((topic) => {
		const count = sumGroupCounts(groups, topic.scannerIds);
		const affectedPages = affectedPagesByScanner
			? countDistinctAffectedPages(affectedPagesByScanner, topic.scannerIds)
			: null;

		return {
			id: topic.key,
			icon: topic.titleIcon,
			title: topic.title,
			desc:
				null === affectedPages ? (
					<p className="geo-by-topic-tile-sublabel">
						{sprintf(
							/* translators: %d is the number of real open GEO findings under this topic. */
							_n('%d open issue', '%d open issues', count, 'vulopilot'),
							count
						)}
					</p>
				) : (
					<div className="geo-by-topic-tile-stats">
						<div className="geo-by-topic-tile-stat">
							<span className="geo-by-topic-tile-stat-label">
								{__('Open issues', 'vulopilot')}
							</span>
							<span className="geo-by-topic-tile-stat-value">{count}</span>
						</div>
						<div className="geo-by-topic-tile-stat">
							<span className="geo-by-topic-tile-stat-label">
								{__('Affected pages', 'vulopilot')}
							</span>
							<span className="geo-by-topic-tile-stat-value">
								{affectedPages}
							</span>
						</div>
					</div>
				),
			footer: (
				<ButtonInput
					buttons={{
						text: `${__('View issues', 'vulopilot')} ›`,
						color: 'text-purple',
						onClick: () => onViewTopic(topic.key),
					}}
				/>
			),
		};
	});

	return (
		<>
			<MetricTileComponent autoFit minTileWidth={13} compact isLoading={isLoading} data={tiles} />
		</>
	);
};

export default GeoByTopicGrid;
