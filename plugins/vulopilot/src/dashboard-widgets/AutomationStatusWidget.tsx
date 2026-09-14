/* global appLocalizer */
import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { ListComponent, ModuleGuardComponent, BadgeComponent } from '@zyra/components';
import { MultiCheckboxInput } from '@zyra/inputs';
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
 * src/pages/Automations/Automations.tsx already uses, capped to 5 rows.
 */
const AutomationStatusWidget: React.FC<WidgetProps> = ({
	summary,
	isLoading,
	onHide,
	isCustomizing,
	onRefreshSummary,
}) => {
	const {
		data,
		isLoading: isListLoading,
		error,
		refetch,
	} = useApiList<AutomationRow>('automations', { per_page: 5 });

	// Same real `PATCH /automations/{id}` toggle
	// BuiltinAutomationCards.tsx's own `handleToggle` already uses —
	// reused here rather than a second, separate enable/disable path.
	const handleToggle = (row: AutomationRow) => {
		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, `automations/${row.id}`),
			{ status: 'enabled' === row.status ? 'disabled' : 'enabled' }
		).then(() => {
			refetch();
			// `summary.automation_status.enabled`/`.disabled` (the
			// "N Enabled"/"N Disabled" badges above) is a sibling payload
			// this row list's own `refetch` never touches — see
			// `onRefreshSummary`'s own docblock (types.ts).
			onRefreshSummary();
		});
	};

	return (
		<DashboardWidget
			title={__('Automation status', 'vulopilot')}
			desc={__('Which of your automations are enabled and running.', 'vulopilot')}
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
					className='mini-card report'
					items={data.map((row) => ({
						id: String(row.id),
						title: row.name,
						tags: (
							<MultiCheckboxInput
								look="toggle"
								options={[
									{
										key: `automation-${row.id}-enabled`,
										value: 'enabled',
										label: '',
									},
								]}
								value={
									'enabled' === row.status ? ['enabled'] : []
								}
								onChange={() => handleToggle(row)}
							/>
						),
					}))}
				/>
			)}
		</DashboardWidget>
	);
};

export default AutomationStatusWidget;
