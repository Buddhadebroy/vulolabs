import React from 'react';
import { __ } from '@wordpress/i18n';
import { ColumnComponent, AnalyticsComponent } from '@zyra/components';

export type Priority = 'all' | 'high' | 'medium' | 'low';

const PRIORITY_ORDER: Priority[] = ['all', 'high', 'medium', 'low'];

interface IssuesSummaryCardsProps {
	total: number;
	priorityCounts: { high: number; medium: number; low: number };
	isLoading: boolean;
	activePriority: Priority;
	onSelectPriority: (priority: Priority) => void;
}

const IssuesSummaryCards: React.FC<IssuesSummaryCardsProps> = ({
	total,
	priorityCounts,
	isLoading,
	activePriority,
	onSelectPriority,
}) => {
	const handleClick = (item: any) => {
		// Find the priority based on the item's text/label
		const index = PRIORITY_ORDER.findIndex(
			priority => priority === item.text?.toString().toLowerCase()
		);
		
		if (index !== -1) {
			onSelectPriority(PRIORITY_ORDER[index]);
		}
	};

	const data = [
		{
			icon: 'ai',
			iconClass: `admin-color2`,
			number: total,
			text: __('All Issues', 'vulopilot'),
			onClick: isLoading ? undefined : handleClick,
		},
		{
			icon: 'error',
			iconClass: `admin-color2`,
			colorClass: activePriority === 'high' ? 'primary-color' : '',
			
			number: priorityCounts.high,
			text: __('High', 'vulopilot'),
			onClick: isLoading ? undefined : handleClick,
		},
		{
			icon: 'refresh',
			iconClass: activePriority === 'medium' ? 'active' : '',
			colorClass: activePriority === 'medium' ? 'primary-color' : '',
			number: priorityCounts.medium,
			text: __('Medium', 'vulopilot'),
			onClick: isLoading ? undefined : handleClick,
		},
		{
			icon: 'info',
			iconClass: activePriority === 'low' ? 'active' : '',
			colorClass: activePriority === 'low' ? 'primary-color' : '',
			number: priorityCounts.low,
			text: __('Low', 'vulopilot'),
			onClick: isLoading ? undefined : handleClick,
		},
	];

	return (
		<div className={`issues-summary-cards active-priority-${activePriority}`}>
			<AnalyticsComponent
				data={data}
				variant="default"
				cols={4}
				isLoading={isLoading}
			/>
		</div>
	);
};

export default IssuesSummaryCards;