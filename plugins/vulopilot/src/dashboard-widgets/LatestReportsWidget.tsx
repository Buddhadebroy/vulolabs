/* global vulopilotAppLocalizer */
import React from 'react';
import { __ } from '@wordpress/i18n';
import { ListComponent, ModuleGuardComponent, BadgeComponent } from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { useApiList } from '../services/useApiList';
import { formatWpDate } from '../services/formatWpDate';
import { WidgetProps } from './types';

interface ReportRow {
	id: number;
	report_type: string;
	status: 'generating' | 'ready' | 'failed';
	created_at: string;
}

/**
 * Compact read of `/reports` (src/pages/Reports/Reports.tsx's own data
 * source) - same reasoning as RecentActivityWidget for using a plain list
 * instead of TableCard at this size.
 */
const LatestReportsWidget: React.FC<WidgetProps> = ({
	onHide,
	isCustomizing,
}) => {
	const { data, isLoading, error } = useApiList<ReportRow>(
		'reports',
		{ per_page: 5 },
		undefined,
		Boolean(vulopilotAppLocalizer.khali_dabba)
	);

	return (
		<DashboardWidget
			title={__('Latest reports', 'vulopilot')}
			desc={__('Your most recently generated scan and audit reports.', 'vulopilot')}
			icon="report"
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
		>
			{error ? (
				<ModuleGuardComponent
					icon="error"
					title={__('Could not load reports', 'vulopilot')}
					desc={error}
				/>
			) : data.length === 0 ? (
				<ModuleGuardComponent
					icon="report"
					title={__('No reports yet', 'vulopilot')}
					desc={__(
						'Generate your first compliance report from the Reports page.',
						'vulopilot'
					)}
				/>
			) : (
				<ListComponent
					items={data.map((row) => ({
						id: String(row.id),
						title: row.report_type,
						value: formatWpDate(row.created_at),
						className: `status-${row.status}`,
						tags: (
							<BadgeComponent
								color={`status-${row.status}`}
								text={row.status}
							/>
						),
					}))}
				/>
			)}
		</DashboardWidget>
	);
};

export default LatestReportsWidget;
