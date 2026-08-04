import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ListComponent, ModuleGuardComponent } from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { useApiList } from '../services/useApiList';
import { WidgetProps } from './types';

interface AutomationRow {
	id: number;
	name: string;
	status: 'enabled' | 'disabled';
}

/**
 * Enabled/disabled counts come straight off the shared summary payload
 * (`summary.automation_status`, Controllers/Dashboard.php) — no extra
 * request needed for those two numbers. The row list underneath is a
 * second, small fetch against the same `/automations` endpoint
 * src/pages/Automation/Automation.tsx already uses, capped to 5 rows.
 */
const AutomationStatusWidget: React.FC<WidgetProps> = ({
	summary,
	isLoading,
	onHide,
	isCustomizing,
}) => {
	const {
		data,
		isLoading: isListLoading,
		error,
		refetch,
	} = useApiList<AutomationRow>('automations', { per_page: 5 });

	return (
		<DashboardWidget
			title={__('Automation status', 'vulopilot')}
			icon="toggle"
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
		>
			<div className='buttons-wrapper'>
				<span className="admin-badge green">
					{sprintf('%d enabled', summary.automation_status.enabled)}
				</span>
				<span className="admin-badge red">
					{sprintf('%d disabled', summary.automation_status.disabled)}
				</span>
			</div>

			{error ? (
				<ModuleGuardComponent
					icon="error"
					title={__('Could not load automations', 'vulopilot')}
					desc={error}
					buttonText={__('Retry', 'vulopilot')}
					onButtonClick={refetch}
				/>
			) : !isListLoading && data.length === 0 ? (
				<ModuleGuardComponent
					icon="automation"
					title={__('No automations yet', 'vulopilot')}
					desc={__(
						'Create one from the Automation page to react to scan findings automatically.',
						'vulopilot'
					)}
				/>
			) : (
				<ListComponent
					items={data.map((row) => ({
						id: String(row.id),
						title: row.name,
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

export default AutomationStatusWidget;
