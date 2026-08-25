import React from 'react';
import { __ } from '@wordpress/i18n';
import { ColumnComponent, AnalyticsComponent } from '@zyra/components';

export type Priority = 'all' | 'high' | 'medium' | 'low';

interface IssuesSummaryCardsProps {
	total: number;
	priorityCounts: { high: number; medium: number; low: number };
	isLoading: boolean;
	activePriority: Priority;
	onSelectPriority: (priority: Priority) => void;
}

interface SummaryTile {
	priority: Priority;
	colorClass: string;
	number: number;
	text: string;
}

const IssuesSummaryCards: React.FC<IssuesSummaryCardsProps> = ({
	total,
	priorityCounts,
	isLoading,
	activePriority,
	onSelectPriority,
}) => {
	// Reads the real `priority` field carried on each tile rather than
	// reverse-parsing it from the tile's own translated display text
	// (`item.text`) — that used to compare `"All Issues".toLowerCase()`
	// against `PRIORITY_ORDER`'s `'all'`, which never matches (extra
	// word), so clicking the "All Issues" tile silently did nothing; the
	// same text-matching approach would also break for High/Medium/Low
	// the moment their labels are translated to any other language.
	const handleClick = (item: SummaryTile) => {
		onSelectPriority(item.priority);
	};

	const data: (SummaryTile & { onClick?: (item: SummaryTile) => void })[] = [
		{
			priority: 'all',
			colorClass: 'purple',
			number: total,
			text: __('All Issues', 'vulopilot'),
			onClick: isLoading ? undefined : handleClick,
		},
		{
			priority: 'high',
			colorClass: 'green',
			number: priorityCounts.high,
			text: __('High', 'vulopilot'),
			onClick: isLoading ? undefined : handleClick,
		},
		{
			priority: 'medium',
			colorClass: 'pink',
			number: priorityCounts.medium,
			text: __('Medium', 'vulopilot'),
			onClick: isLoading ? undefined : handleClick,
		},
		{
			priority: 'low',
			colorClass: 'green',
			number: priorityCounts.low,
			text: __('Low', 'vulopilot'),
			onClick: isLoading ? undefined : handleClick,
		},
	];

	return (
		// <div className={`issues-summary-cards active-priority-${activePriority}`}>
			<AnalyticsComponent
				data={data}
				className={`active-priority-${activePriority}`}
				variant="small-card"
				cols={4}
				isLoading={isLoading}
			/>
		// </div>
	);
};

export default IssuesSummaryCards;