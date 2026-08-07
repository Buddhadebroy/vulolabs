/* global appLocalizer */
import React from 'react';
import { __ } from '@wordpress/i18n';
import { ChartComponent, ModuleGuardComponent } from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import ProLockedCard from '../components/ProLockedCard';
import { useApiList } from '../services/useApiList';
import { WidgetProps } from './types';

interface HealthSnapshot {
	snapshot_date: string;
	overall_score: number;
}

/**
 * The health-score trend chart, unchanged in content from what
 * Dashboard.tsx originally rendered inline — moved here so it's a widget
 * like the other twelve (reorderable, hideable) instead of a fixed
 * element outside the grid. Fetches its own data (`/site-health-snapshots`)
 * rather than reading it off the shared summary payload, since it's a
 * list of up to 30 rows, not a single number the summary aggregate is
 * meant for (see Controllers/Dashboard.php's docblock on why list-shaped
 * widgets call their own endpoint).
 */
const HealthTimelineWidget: React.FC<WidgetProps> = ({
	onHide,
	isCustomizing,
}) => {
	const {
		data: snapshots,
		isLoading,
	} = useApiList<HealthSnapshot>('site-health-snapshots', { days: 30 });

	/**
	 * `/site-health-snapshots` only exists at all once vulopilot-pro's
	 * AdvancedReports module registers it (via the vulopilot_rest_controllers
	 * filter) — on a Free-only install this request 404s every time, which
	 * is the expected, permanent state, not a transient failure. Checking
	 * `active_modules` directly (rather than treating "zero rows" and
	 * "404'd" as the same friendly empty state, as this widget used to)
	 * distinguishes the two honestly: a Free user sees the real "unlock
	 * with Pro" pitch (same ProLockedCard/ShowProPopup pattern every other
	 * Pro-gated panel in this plugin uses) instead of "run a scan" copy
	 * that can never resolve on Free, since scans never populate this
	 * endpoint there.
	 */
	const isModuleActive =
		appLocalizer.active_modules.includes('advanced-reports');

	return (
		<DashboardWidget
			title={__('Health timeline', 'vulopilot')}
			icon="analytics"
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
		>
			{!isModuleActive ? (
				<ProLockedCard moduleName="advanced-reports" />
			) : snapshots.length === 0 ? (
				<ModuleGuardComponent
					icon="analytics"
					title={__('No trend data yet', 'vulopilot')}
					desc={__(
						'Run your first scan to start building a health score history.',
						'vulopilot'
					)}
				/>
			) : (
				<ChartComponent
					type="area"
					data={snapshots}
					dataKey="overall_score"
					xKey="snapshot_date"
					height={300}
					yDomain={[0, 100]}
				/>
			)}
		</DashboardWidget>
	);
};

export default HealthTimelineWidget;
