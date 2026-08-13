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
			colorClass: 'admin-bg-color2',
			number: total,
			text: __('All Issues', 'vulopilot'),
			onClick: isLoading ? undefined : handleClick,
		},
		{
			// colorClass: activePriority === 'high' ? 'primary-color' : '',	
			colorClass: 'admin-bg-color3',		
			number: priorityCounts.high,
			text: __('High', 'vulopilot'),
			onClick: isLoading ? undefined : handleClick,
		},
		{
			// colorClass: activePriority === 'medium' ? 'primary-color' : '',
			colorClass: 'admin-bg-color4',
			number: priorityCounts.medium,
			text: __('Medium', 'vulopilot'),
			onClick: isLoading ? undefined : handleClick,
		},
		{
			// colorClass: activePriority === 'low' ? 'primary-color' : '',
			colorClass: 'admin-bg-color5',
			number: priorityCounts.low,
			text: __('Low', 'vulopilot'),
			onClick: isLoading ? undefined : handleClick,
		},
	];

	return (
		<div className={`issues-summary-cards active-priority-${activePriority}`}>
			<AnalyticsComponent
				data={data}
				variant="small-card"
				cols={4}
				isLoading={isLoading}
			/>
		</div>
	);
};

export default IssuesSummaryCards;