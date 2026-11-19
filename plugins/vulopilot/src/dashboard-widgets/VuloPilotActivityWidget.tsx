/* global vulopilotAppLocalizer */
import React, { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { ChartComponent, PopupComponent } from '@zyra/components';
import { EmptyState, Segmented } from '../components/ui';
import DashboardWidget from './DashboardWidget';
import DummyDataNotice from '../components/DummyDataNotice';
import { BlurredProContent } from '../components/UpgradeToProOverlay';
import ShowProPopup from '../components/Popup/Popup';
import { useApiList } from '../services/useApiList';
import { formatWpDate } from '../services/formatWpDate';
import { WidgetProps, PeriodDays } from './types';

interface HealthSnapshot {
	snapshot_date: string;
	overall_score: number;
}


/** Same real `key` field convention `OverviewTab.tsx`'s own identical `ToggleInput` usage already establishes. */
const PERIOD_OPTIONS = [
	{ key: '7', value: '7', label: __('7D', 'vulopilot') },
	{ key: '30', value: '30', label: __('30D', 'vulopilot') },
	{ key: '90', value: '90', label: __('90D', 'vulopilot') },
];


/** Fabricated 7-day score trend. */
const DUMMY_HEALTH_TIMELINE = [
	{ day: __('Day 1', 'vulopilot'), score: 58 },
	{ day: __('Day 2', 'vulopilot'), score: 63 },
	{ day: __('Day 3', 'vulopilot'), score: 61 },
	{ day: __('Day 4', 'vulopilot'), score: 68 },
	{ day: __('Day 5', 'vulopilot'), score: 72 },
	{ day: __('Day 6', 'vulopilot'), score: 75 },
	{ day: __('Day 7', 'vulopilot'), score: 79 },
];

/** "Health trend": the overall score per day (Pro's daily snapshots); a blurred sample with an upgrade prompt on Free. */
const VuloPilotActivityWidget: React.FC<WidgetProps> = ({
	isLoading,
	onHide,
	isCustomizing,
}) => {
	const [healthTimelineDays, setHealthTimelineDays] = useState<PeriodDays>('30');


	const { data: healthSnapshots } = useApiList<HealthSnapshot>(
		'site-health-snapshots',
		{ days: Number(healthTimelineDays) },
		undefined,
		Boolean(vulopilotAppLocalizer.khali_dabba)
	);
	const isHealthTimelineModuleActive = Boolean(vulopilotAppLocalizer.khali_dabba);
	const [isHealthTimelineProPopupOpen, setIsHealthTimelineProPopupOpen] = useState(false);



	return (
		<>
			<DashboardWidget
				title={__('Health trend', 'vulopilot')}
				desc={__('How your overall score has moved over time.', 'vulopilot')}
				icon="analytics"
				isLoading={isLoading}
				onHide={onHide}
				isCustomizing={isCustomizing}
				headerAction={
					<Segmented
						size="sm"
						options={PERIOD_OPTIONS}
						value={healthTimelineDays}
						onChange={(value) => setHealthTimelineDays(value as PeriodDays)}
						label={__('Period', 'vulopilot')}
					/>
				}
			>

				{!isHealthTimelineModuleActive ? (
					<>
						<BlurredProContent
							contentClassName="health-timeline-dummy"
							onClick={() => setIsHealthTimelineProPopupOpen(true)}
						>
							<ChartComponent
								type="dynamic-line"
								data={DUMMY_HEALTH_TIMELINE}
								dataKey="score"
								xKey="day"
								height={300}
								yDomain={[0, 100]}
							/>
						</BlurredProContent>
						<DummyDataNotice />
					</>
				) : 0 === healthSnapshots.length ? (
					<EmptyState
						icon="analytics"
						title={__('No trend data yet', 'vulopilot')}
						text={__(
							'Health timeline builds up once daily snapshots start recording - check back after today.',
							'vulopilot'
						)}
					/>
				) : (
					<ChartComponent
						type="dynamic-line"
						data={healthSnapshots.map((snapshot) => ({
							...snapshot,
							snapshot_date: formatWpDate(snapshot.snapshot_date),
						}))}
						dataKey="overall_score"
						xKey="snapshot_date"
						height={300}
						yDomain={[0, 100]}
					/>
				)}
			</DashboardWidget>
			<PopupComponent
				open={isHealthTimelineProPopupOpen}
				onClose={() => setIsHealthTimelineProPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				<ShowProPopup />
			</PopupComponent>
		</>
	);
};

export default VuloPilotActivityWidget;