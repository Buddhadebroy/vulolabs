import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
	AnalyticsComponent,
	ColumnComponent,
	ContainerComponent,
	CardComponent,
	ScoreRingComponent,
} from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { WidgetProps } from './types';

/* eslint-disable no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters, same as StatWidget.tsx's StatWidgetConfig */
/** Where each pillar's tile navigates — the same `?page=vulopilot#&tab=X`
 * hash-link navigation used elsewhere in this plugin, not a new
 * mechanism. Security has no dedicated page of its own
 * (its score lives in category_scores, but its findings only ever show up
 * in Health's unfiltered list), so it routes to Health rather than a
 * dead tab. */
const PILLAR_TILES: {
	id: string;
	tab: string;
	label: string;
	icon: string;
	getScore: (summary: WidgetProps['summary']) => number | null;
}[] = /* eslint-enable no-unused-vars */ [
	{
		id: 'seo',
		tab: 'seo',
		label: __('SEO', 'vulopilot'),
		icon: 'search',
		getScore: (summary) => summary.category_scores.seo,
	},
	{
		id: 'performance',
		tab: 'performance',
		label: __('Performance', 'vulopilot'),
		icon: 'bar-chart',
		getScore: (summary) => summary.category_scores.performance,
	},
	{
		id: 'accessibility',
		tab: 'accessibility',
		label: __('Accessibility', 'vulopilot'),
		icon: 'eye',
		getScore: (summary) => summary.category_scores.accessibility,
	},
	{
		id: 'geo',
		tab: 'geo',
		label: __('GEO', 'vulopilot'),
		icon: 'global-community',
		getScore: (summary) => summary.category_scores.geo,
	},
	{
		id: 'security',
		tab: 'health',
		label: __('Security', 'vulopilot'),
		icon: 'security',
		getScore: (summary) => summary.category_scores.security,
	},
	{
		id: 'woocommerce',
		tab: 'woocommerce',
		label: __('WooCommerce', 'vulopilot'),
		icon: 'woocommerce',
		getScore: (summary) => summary.category_scores.woocommerce,
	},
];

/**
 * "At a glance" hero for the Dashboard — every pillar's score in one row,
 * each tile a real link to that pillar's own page. HealthScoreSummary.tsx
 * already shows the same category_scores as plain (non-clickable)
 * AnalyticsComponent `progress`-variant tiles on the Health page; this
 * widget reuses the exact same tile, just with each item's `link` set, so
 * the score is also a launcher — which is what the Dashboard, unlike
 * Health, is for. Registered as a normal widget (not a fixed section) so
 * it's subject to the same show/hide/reorder customization every other
 * widget already has.
 */
const HealthPillarsWidget: React.FC<WidgetProps> = ({
	summary,
	isLoading
}) => {
	const tiles = PILLAR_TILES.map((pillar,index) => {
		const score = pillar.getScore(summary);

		if (score === null) {
			return null;
		}

		return {
			icon: pillar.icon,
			number: `${score}/100`,
			text: pillar.label,
			progress: score,
			link: `?page=vulopilot#&tab=${pillar.tab}`,
			colorClass: `admin-color${index + 1}`,
		};
	}).filter((tile): tile is NonNullable<typeof tile> => tile !== null);

	return (
		<>	
			<CardComponent>
				<ColumnComponent row>
					<ScoreRingComponent
						score={summary.overall_score}
						isLoading={isLoading}
					/>
					{!isLoading && (
						<div>
							<div className="title">{__('Good', 'vulopilot')}</div>
							<div className="desc">
								{sprintf(
									__('%1$d open findings across %2$d pillars.', 'vulopilot'),
									summary.open_findings,
									PILLAR_TILES.length
								)}
							</div>
							<div className="buttons-wrapper">
								<div className="admin-badge green"><i className='adminfont-analytics'/>{__('+5 this week', 'vulopilot')}</div>
								<div className="admin-badge red"><i className='adminfont-analytics'/>{__('2 new issues', 'vulopilot')}</div>
								<div className="admin-badge yellow"><i className='adminfont-analytics'/>{__('12 fixed', 'vulopilot')}</div>
							</div>
						</div>
					)}
				</ColumnComponent>
				<AnalyticsComponent
					variant="progress"
					cols={5}
					isLoading={isLoading}
					data={tiles}
				/>
			</CardComponent>
		</>
	);
};

export default HealthPillarsWidget;
