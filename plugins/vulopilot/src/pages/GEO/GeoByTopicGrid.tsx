import { __, _n, sprintf } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { sumGroupCounts } from './useGeoFindingGroups';
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
}

/**
 * "A Closer Look, By Topic" — one real tile per unified-table section
 * (`topics`, owned by GeoTab.tsx so this grid and the "All GEO Issues"
 * table below it always agree on the same 5 groupings), each showing the
 * real open-issue count for that topic (`sumGroupCounts`, same `groups`
 * fetch GeoFixTheseFirstCard.tsx already uses — no second fetch). "View
 * issues" switches the unified table's own active tab to that topic
 * instead of duplicating a second findings list here.
 */
const GeoByTopicGrid = ({
	topics,
	groups,
	isLoading,
	onViewTopic,
	title,
	desc,
}: GeoByTopicGridProps) => (
	<div className="geo-by-topic-section">
		<h3 className="reports-section-title">
			{title || __('A Closer Look, By Topic', 'vulopilot')}
		</h3>
		<p className="geo-by-topic-desc">
			{desc ||
				__(
					'We grouped every issue by the kind of thing AI is looking for.',
					'vulopilot'
				)}
		</p>
		<div className="geo-by-topic-grid">
			{topics.map((topic) => {
				const count = sumGroupCounts(groups, topic.scannerIds);

				return (
					<CardComponent
						key={topic.key}
						className="geo-by-topic-tile"
						isLoading={isLoading}
					>
						<div className="geo-by-topic-tile-header">
							<i className={`adminfont-${topic.titleIcon}`} />
							<span
								className={`admin-badge ${count > 0 ? 'red' : 'green'}`}
							>
								{count}
							</span>
						</div>
						<p className="geo-by-topic-tile-title">{topic.title}</p>
						<p className="geo-by-topic-tile-sublabel">
							{sprintf(
								/* translators: %d is the number of real open GEO findings under this topic. */
								_n(
									'%d open issue',
									'%d open issues',
									count,
									'vulopilot'
								),
								count
							)}
						</p>
						<button
							type="button"
							className="geo-by-topic-tile-link"
							onClick={() => onViewTopic(topic.key)}
						>
							{__('View issues', 'vulopilot')} ›
						</button>
					</CardComponent>
				);
			})}
		</div>
	</div>
);

export default GeoByTopicGrid;
