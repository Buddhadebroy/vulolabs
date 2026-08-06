import React from 'react';
import { __ } from '@wordpress/i18n';
import { ModuleGuardComponent } from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { WidgetProps } from './types';

const SEVERITY_COLORS: Record<string, string> = {
	critical: '#dc2626',
	high: '#d88c5c',
	medium: '#b45309',
	low: '#5baab3',
};

const SEVERITY_LABELS: Record<string, string> = {
	critical: __('Critical', 'vulopilot'),
	high: __('High', 'vulopilot'),
	medium: __('Medium', 'vulopilot'),
	low: __('Low', 'vulopilot'),
};

/**
 * Real open-finding counts by severity (Dashboard.php's
 * build_findings_by_severity()) as a table — the same numbers
 * NeedsAttentionWidget/FindingsTable's severity badges already surface,
 * just aggregated instead of per-row. Was a donut chart; converted to a
 * table on request, same real data either way.
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
			icon="error green-color"
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
			borderColor="green"
			desc={__('Open findings grouped by severity.', 'vulopilot')}
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
				<table className="issue-distribution-table">
					<thead>
						<tr>
							<th>{__('Severity', 'vulopilot')}</th>
							<th>{__('Count', 'vulopilot')}</th>
						</tr>
					</thead>
					<tbody>
						{isLoading
							? entries.map(([severity]) => (
									<tr key={severity}>
										<td>
											<span
												className="issue-distribution-dot"
												style={{
													background:
														SEVERITY_COLORS[
															severity
														],
												}}
											/>
											{SEVERITY_LABELS[severity]}
										</td>
										<td>—</td>
									</tr>
								))
							: data.map((item) => (
									<tr key={item.label}>
										<td>
											<span
												className="issue-distribution-dot"
												style={{
													background: item.color,
												}}
											/>
											{SEVERITY_LABELS[item.label]}
										</td>
										<td
											className="issue-distribution-count"
											style={{ color: item.color }}
										>
											{item.value}
										</td>
									</tr>
								))}
					</tbody>
				</table>
			)}
		</DashboardWidget>
	);
};

export default IssueDistributionWidget;
