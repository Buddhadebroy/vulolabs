import React from 'react';
import { __ } from '@wordpress/i18n';
import { TrendStatComponent } from '@zyra/components';

export type Priority = 'all' | 'high' | 'medium' | 'low';

/** Tile order the stat row is rendered in — index maps 1:1 to PRIORITY_ORDER below, since zyra's real TrendStatComponent renders `.trend-stat-tile`s in item order with no per-item id/onClick of its own to key off instead. */
const PRIORITY_ORDER: Priority[] = ['all', 'high', 'medium', 'low'];

interface IssuesSummaryCardsProps {
	total: number;
	priorityCounts: { high: number; medium: number; low: number };
	isLoading: boolean;
	activePriority: Priority;
	onSelectPriority: (priority: Priority) => void;
}

/**
 * The 4 stat tiles above the Issues table — real open-finding counts from
 * `GET /findings/groups`'s own `priority_counts` (the same real bucketing
 * FindingRepository::get_priority_counts() already backs
 * NeedsAttentionCard.tsx with), reusing zyra's existing TrendStatComponent
 * (already used for WooCommerce's Store Overview/Content's stats cards)
 * rather than a one-off stat-tile layout.
 *
 * TrendStatComponent itself has no per-item onClick/active-state prop
 * (confirmed by reading its real compiled markup: `.trend-stat-list` >
 * `.trend-stat-tile`, order-only, no id), so clicks are delegated from a
 * wrapping element and matched back to a tile by its position among its
 * siblings — the same position PRIORITY_ORDER above assumes — rather than
 * forking the component or hand-rolling a parallel stat-tile layout just to
 * get a click handler.
 */
const IssuesSummaryCards: React.FC<IssuesSummaryCardsProps> = ({
	total,
	priorityCounts,
	isLoading,
	activePriority,
	onSelectPriority,
}) => {
	const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
		const tile = (event.target as HTMLElement).closest(
			'.trend-stat-tile'
		);

		if (!tile || !tile.parentElement) {
			return;
		}

		const index = Array.from(tile.parentElement.children).indexOf(tile);
		const priority = PRIORITY_ORDER[index];

		if (priority) {
			onSelectPriority(priority);
		}
	};

	return (
		<div
			className={`issues-summary-cards active-priority-${activePriority}`}
			onClick={isLoading ? undefined : handleClick}
		>
			<TrendStatComponent
				cols={4}
				isLoading={isLoading}
				items={[
					{
						icon: 'ai',
						label: __('All Issues', 'vulopilot'),
						value: total,
					},
					{
						icon: 'error',
						label: __('High', 'vulopilot'),
						value: priorityCounts.high,
					},
					{
						icon: 'refresh',
						label: __('Medium', 'vulopilot'),
						value: priorityCounts.medium,
					},
					{
						icon: 'info',
						label: __('Low', 'vulopilot'),
						value: priorityCounts.low,
					},
				]}
			/>
		</div>
	);
};

export default IssuesSummaryCards;
