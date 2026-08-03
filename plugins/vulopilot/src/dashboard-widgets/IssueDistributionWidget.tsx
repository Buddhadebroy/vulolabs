import React from 'react';
import { __ } from '@wordpress/i18n';
import { ChartComponent, ModuleGuardComponent } from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { WidgetProps } from './types';

const SEVERITY_COLORS: Record<string, string> = {
	critical: '#dc2626',
	high: '#d88c5c',
	medium: '#b45309',
	low: '#5baab3',
};

/**
 * Real open-finding counts by severity (Dashboard.php's
 * build_findings_by_severity()) as a donut chart — the same numbers
 * NeedsAttentionWidget/FindingsTable's severity badges already surface,
 * just aggregated instead of per-row.
 */
const IssueDistributionWidget: React.FC<WidgetProps> = ({
	summary,
	isLoading,
	onHide,
	isCustomizing,
}) => {
	const entries: [string, number][] = [
		['critical', summary.findings_by_severity.critical],
		['high', summary.findings_by_severity.high],
		['medium', summary.findings_by_severity.medium],
		['low', summary.findings_by_severity.low],
	];

	const data = entries
		.filter(([, value]) => value > 0)
		.map(([severity, value]) => ({
			label: severity,
			value,
			color: SEVERITY_COLORS[severity],
		}));

	return (
		<DashboardWidget
			title={__('Issue distribution', 'vulopilot')}
			icon="error"
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
		>
			{!isLoading && data.length === 0 ? (
				<ModuleGuardComponent
					icon="check"
					title={__('No open issues', 'vulopilot')}
					desc={__(
						'Every scanned finding is resolved right now.',
						'vulopilot'
					)}
				/>
			) : (
				<ChartComponent
					type="pie"
					data={data}
					height={140}
					isLoading={isLoading}
				/>
			)}
		</DashboardWidget>
	);
};

export default IssueDistributionWidget;
