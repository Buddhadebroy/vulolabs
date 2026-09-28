import React from 'react';
import { __ } from '@wordpress/i18n';
import { AnalyticsComponent } from '@zyra/components';

// `'all'` no longer has its own tile (removed) - it's kept as a real state value only.
export type Priority = 'all' | 'high' | 'medium' | 'low';

interface IssuesSummaryCardsProps {
	priorityCounts: { high: number; medium: number; low: number };
	isLoading: boolean;
	activePriority: Priority;
	// eslint-disable-next-line no-unused-vars
	onSelectPriority: (priority: Priority) => void;
}

interface SummaryTile {
	priority: Priority;
	colorClass: string;
	icon: string;
	number: number;
	text: string;
	linkText: string;
}

const IssuesSummaryCards: React.FC<IssuesSummaryCardsProps> = ({
	priorityCounts,
	isLoading,
	activePriority,
	onSelectPriority,
}) => {
	// Reads the real `priority` field carried on each tile rather than reverse-parsing it from the
	// tile's own translated display text (`item.text`).
	const handleClick = (item: SummaryTile) => {
		onSelectPriority(item.priority);
	};

	// eslint-disable-next-line no-unused-vars
	const data: (SummaryTile & { onClick?: (item: SummaryTile) => void })[] = [
		{
			priority: 'high',
			colorClass: 'red',
			icon: 'error',
			number: priorityCounts.high,
			text: __('High priority', 'vulopilot'),
			linkText: __('View issues', 'vulopilot'),
			onClick: isLoading ? undefined : handleClick,
		},
		{
			priority: 'medium',
			colorClass: 'orange',
			icon: 'error',
			number: priorityCounts.medium,
			text: __('Medium priority', 'vulopilot'),
			linkText: __('View issues', 'vulopilot'),
			onClick: isLoading ? undefined : handleClick,
		},
		{
			priority: 'low',
			colorClass: 'green',
			icon: 'check',
			number: priorityCounts.low,
			text: __('Low priority', 'vulopilot'),
			linkText: __('View issues', 'vulopilot'),
			onClick: isLoading ? undefined : handleClick,
		},
	];

	// Real controlled active tile - this component's own `activePriority` prop.
	const activeIndex = data.findIndex((tile) => tile.priority === activePriority);

	return (
		<div className="issues-summary-cards">
			<div className="details-wrapper">
				<div className="title">{__('Filter by priority', 'vulopilot')}</div>
				<div className="desc">{__('Click a priority level to view matching issues', 'vulopilot')}</div>
			</div>
			<AnalyticsComponent
				data={data}
				activeIndex={activeIndex}
				variant="small-card"
				cols={3}
				isLoading={isLoading}
			/>
		</div>
	);
};

export default IssuesSummaryCards;