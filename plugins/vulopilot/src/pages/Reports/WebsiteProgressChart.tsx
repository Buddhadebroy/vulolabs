import React, { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent, ChartComponent, ModuleGuardComponent, BadgeComponent } from '@zyra/components';
import { useApiList } from '../../services/useApiList';
import { formatWpDate } from '../../services/formatWpDate';

interface HealthSnapshot {
	snapshot_date: string;
	overall_score: number;
}

const DAY_OPTIONS = [7, 30, 90];

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
			desc={__('Your site health score over time.', 'vulopilot')}
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
						'Health score history builds up once scans run regularly - this needs Pro\'s Advanced Reports module.',
						'vulopilot'
					)}
				/>
			) : (
				<ChartComponent
					type="dynamic-line"
					isLoading={isLoading}
					data={snapshots.map((snapshot) => ({
						...snapshot,
						snapshot_date: formatWpDate(snapshot.snapshot_date),
					}))}
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
