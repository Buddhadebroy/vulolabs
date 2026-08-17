import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ListComponent, ModuleGuardComponent, BadgeComponent } from '@zyra/components';
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
				<BadgeComponent
					color="green"
					text={sprintf('%d enabled', summary.automation_status.enabled)}
				/>
				<BadgeComponent
					color="red"
					text={sprintf('%d disabled', summary.automation_status.disabled)}
				/>
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

export default AutomationStatusWidget;
