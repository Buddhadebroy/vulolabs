import { __, _n, sprintf } from '@wordpress/i18n';
import { BadgeComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import {
	HistoryRow,
	groupByDay,
	rowIcon,
	rowStatusBadge,
	rowTag,
	rowTime,
	rowTitle,
} from '../AIAssistant/historyTypes';

interface HistoryTimelineProps {
	rows: HistoryRow[];
	total: number;
	selectedRow: HistoryRow | null;
	onSelectRow: (row: HistoryRow) => void;
	isLoadingMore: boolean;
	onLoadMore: () => void;
}

/**
 * The real, day-grouped activity timeline HistoryTab.tsx's own "History"
 * tab renders — extracted here verbatim so it's a real, reusable component
 * rather than markup only that one tab can render, per direct instruction.
 * Still HistoryRow-shaped (`historyTypes.ts`'s own `GET /history` row —
 * scan/change objects, a real `tag`/status per row) — every real per-row
 * field (`rowTag`/`rowStatusBadge`/`rowIcon`/`rowTitle`/`rowTime`,
 * `row.scan`/`row.change`) still comes from that same shape, so this only
 * ever renders `HistoryRow[]`, not an arbitrary activity feed.
 *
 * This codebase has several other "activity"/"recent activity" surfaces
 * (ActivityTab.tsx's own flat `vulopilot_activity_logs` table,
 * RecentActivityCard.tsx, AutomationsActivityCard.tsx) — none of them are
 * switched to this component. Each reads its own real, differently-shaped
 * row (`ActivityLogRow`'s `event_type`/`actor_type`/`severity`,
 * `AutomationRunRow`'s `status`/`actions_executed`/…) with no real `scan`/
 * `change`/history `tag` fields to feed this timeline's own per-row
 * rendering — forcing them through this component would mean either
 * fabricating those fields or silently dropping real functionality each
 * already has (ActivityTab.tsx's own real search/sort/pagination/actor
 * filter via TableCard, in particular). HistoryTab.tsx's own docblock
 * already documents ActivityTab.tsx as "a different, narrower view, kept
 * as its own separate tab rather than merged with this one" — a past
 * direct instruction this component doesn't reverse.
 */
const HistoryTimeline = ({
	rows,
	total,
	selectedRow,
	onSelectRow,
	isLoadingMore,
	onLoadMore,
}: HistoryTimelineProps) => {
	const dayGroups = groupByDay(rows);

	return (
		<div className="history-timeline">
			{dayGroups.map((group) => (
				<div
					className="history-day-group"
					key={group.rows[0]?.id ?? group.label}
				>
					<div className="history-day title">{group.label}</div>
					{group.rows.map((row) => {
						const tag = rowTag(row);
						const statusBadge = rowStatusBadge(row);
						const showBeforeAfter =
							row.change &&
							null !== row.change.after &&
							row.change.after.length <= 40 &&
							(null === row.change.before ||
								row.change.before.length <= 40);

						return (
							<div
								key={row.id}
								className={`history-row ${selectedRow?.id === row.id ? 'selected' : ''}`}
								role="button"
								tabIndex={0}
								onClick={() => onSelectRow(row)}
							>
								<span className="history-row-time">
									{rowTime(row.created_at)}
								</span>

								<div className="history-details">
									<i
										className={`history-row-icon adminfont-${rowIcon(row)}`}
									/>
									<div className="history-row-text">
										<div className="history-row-title title">
											{rowTitle(row)}
											<BadgeComponent
												color={tag.className}
												text={tag.text}
											/>
										</div>
										<div className="desc">
											{row.message}
										</div>
									</div>
									<div className="history-row-meta">
										{row.scan && (
											<span className="history-row-meta-value">
												{sprintf(
													_n(
														'%d issue found',
														'%d issues found',
														row.scan.total,
														'vulopilot'
													),
													row.scan.total
												)}
											</span>
										)}
										{showBeforeAfter && (
											<span className="history-row-meta-value">
												{sprintf(
													__(
														'Before: %1$s · After: %2$s',
														'vulopilot'
													),
													row.change?.before ||
														__(
															'(new content)',
															'vulopilot'
														),
													row.change?.after
												)}
											</span>
										)}
										{statusBadge && (
											<BadgeComponent
												color={statusBadge.className}
												text={statusBadge.text}
											/>
										)}
									</div>
									<i
										className="adminfont-arrow-right history-row-arrow"
										role="button"
										tabIndex={0}
										onClick={(event) => {
											event.stopPropagation();
											onSelectRow(row);
										}}
									/>
								</div>
							</div>
						);
					})}
				</div>
			))}

			{rows.length < total && (
				<ButtonInput
					position="center"
					buttons={{
						text: isLoadingMore
							? __('Loading…', 'vulopilot')
							: __('Load more', 'vulopilot'),
						color: 'purple-bg',
						onClick: onLoadMore,
						disabled: isLoadingMore,
					}}
				/>
			)}
		</div>
	);
};

export default HistoryTimeline;
