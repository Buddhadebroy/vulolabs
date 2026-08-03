import React from 'react';
import { __ } from '@wordpress/i18n';
import { ListComponent, ModuleGuardComponent } from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { useApiList } from '../services/useApiList';
import { WidgetProps } from './types';

interface ReportRow {
	id: number;
	report_type: string;
	status: 'generating' | 'ready' | 'failed';
	created_at: string;
}

/**
 * Compact read of `/reports` (src/pages/Reports/Reports.tsx's own data
 * source) — same reasoning as RecentActivityWidget for using a plain list
 * instead of TableCard at this size.
 */
const LatestReportsWidget: React.FC<WidgetProps> = ({
	onHide,
	isCustomizing,
}) => {
	const { data, isLoading, error, refetch } = useApiList<ReportRow>(
		'reports',
		{ per_page: 5 }
	);

	return (
		<DashboardWidget
			title={__('Latest reports', 'vulopilot')}
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
					buttonText={__('Retry', 'vulopilot')}
					onButtonClick={refetch}
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
						className: `status-${row.status}`,
						tags: (
							<span className={`admin-badge status-${row.status}`}>
								{row.status}
							</span>
						),
					}))}
				/>
			)}
		</DashboardWidget>
	);
};

export default LatestReportsWidget;
