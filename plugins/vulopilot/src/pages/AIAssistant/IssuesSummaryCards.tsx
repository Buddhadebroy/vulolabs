import React from 'react';
import { __ } from '@wordpress/i18n';
import { ColumnComponent, AnalyticsComponent } from '@zyra/components';

// `'all'` no longer has its own tile (removed) — it's kept as a real
// state value only, meaning "no priority filter selected" (the initial
// state before High/Medium/Low is clicked, and what deselecting the
// active one falls back to).
export type Priority = 'all' | 'high' | 'medium' | 'low';

interface IssuesSummaryCardsProps {
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
	priorityCounts,
	isLoading,
	activePriority,
	onSelectPriority,
}) => {
	// Reads the real `priority` field carried on each tile rather than
	// reverse-parsing it from the tile's own translated display text
	// (`item.text`) — text-matching would break for High/Medium/Low the
	// moment their labels are translated to any other language.
	const handleClick = (item: SummaryTile) => {
		onSelectPriority(item.priority);
	};

	const data: (SummaryTile & { onClick?: (item: SummaryTile) => void })[] = [
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
				cols={3}
				isLoading={isLoading}
			/>
		// </div>
	);
};

export default IssuesSummaryCards;