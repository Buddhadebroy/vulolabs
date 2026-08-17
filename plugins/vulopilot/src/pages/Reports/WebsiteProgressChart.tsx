import React, { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent, ChartComponent, ModuleGuardComponent, BadgeComponent } from '@zyra/components';
import { useApiList } from '../../services/useApiList';

interface HealthSnapshot {
	snapshot_date: string;
	overall_score: number;
}

const DAY_OPTIONS = [7, 30, 90];

/**
 * The mockup's "Website Progress" is a 4-line chart (Traffic/Visibility/
 * Revenue/Performance) — none of those has real daily history (only
 * `overall_score` gets a daily snapshot, and only when Pro's
 * AdvancedReports module is active). This shows that one real series
 * instead of fabricating the other three, reusing the exact same
 * `/site-health-snapshots` + `ChartComponent type="area"` pattern Free's
 * own Dashboard HealthTimelineWidget.tsx already established (including
 * its graceful 404→empty degrade on Free-only installs — a 404 here is
 * permanent, not transient, so no error+retry card). "7/30/90 Days" is
 * real (the endpoint already supports `?days=N`); "1 Year" and "Compare
 * Previous Period" are dropped — the site is very unlikely to have a full
 * year of daily snapshots, and no overlay-comparison series exists
 * anywhere to back a "Compare Previous Period" toggle.
 */
const WebsiteProgressChart = () => {
	const [days, setDays] = useState(30);

	const { data: snapshots, isLoading } = useApiList<HealthSnapshot>(
		'site-health-snapshots',
		{ days }
	);

	return (
		<CardComponent
			className="website-progress-card"
			titleIcon="analytics"
			title={__('Website Progress', 'vulopilot')}
			action={
				<div className="website-progress-day-toggle">
					{DAY_OPTIONS.map((option) => (
						<BadgeComponent
							key={option}
							color={option === days ? 'purple' : ''}
							role="button"
							tabIndex={0}
							onClick={() => setDays(option)}
							text={`${option} ${__('Days', 'vulopilot')}`}
						/>
					))}
				</div>
			}
		>
			{!isLoading && snapshots.length === 0 ? (
				<ModuleGuardComponent
					icon="analytics"
					title={__('No trend data yet', 'vulopilot')}
					desc={__(
						'Health score history builds up once scans run regularly — this needs Pro\'s Advanced Reports module.',
						'vulopilot'
					)}
				/>
			) : (
				<ChartComponent
					type="area"
					isLoading={isLoading}
					data={snapshots}
					dataKey="overall_score"
					xKey="snapshot_date"
					height={280}
					yDomain={[0, 100]}
				/>
			)}
		</CardComponent>
	);
};

export default WebsiteProgressChart;
