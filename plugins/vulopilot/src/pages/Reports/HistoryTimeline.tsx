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
} from '../../services/historyTypes';

interface HistoryTimelineProps {
	rows: HistoryRow[];
	total: number;
	selectedRow: HistoryRow | null;
	onSelectRow: (row: HistoryRow) => void;
	isLoadingMore: boolean;
	onLoadMore: () => void;
	/** Overrides what the trailing arrow does - HistoryTab.tsx's own real use (select the row, open the side detail panel) is the default when this is omitted. */
	onArrowClick?: (row: HistoryRow) => void;
}

/**
 * The real, day-grouped activity timeline HistoryTab.tsx's own "History" tab renders.
 */
const HistoryTimeline = ({
	rows,
	total,
	selectedRow,
	onSelectRow,
	isLoadingMore,
	onLoadMore,
	onArrowClick,
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
						const title = rowTitle(row);
						// `rowTitle()` already falls back to `row.message` when there's no real
						// `scan`/`change` detail to title itself with.
						const showDesc = row.message !== title;
						const showBeforeAfter =
							row.change &&
							null !== row.change.after &&
							row.change.after.length <= 40 &&
							(null === row.change.before ||
								row.change.before.length <= 40);


						return (
							<div
								key={row.id}
								id={`vulopilot-history-row-${row.id}`}
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
										<div className="history-row-title-wrapper">
											<span className='history-row-title'>{title}</span>
											<BadgeComponent
												color={tag.className}
												text={tag.text}
											/>
										</div>
										{showDesc && (
											<div className="desc">
												{row.message}
											</div>
										)}
									</div>
									<div className="history-row-issue-details">
										{row.scan && (
											<span className="history-row-meta-value">
												{sprintf(
													/* translators: %d: real number of issues this scan found. */
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
													/* translators: 1: real value before the change, 2: real value after the change. */
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
									{/* Same "More Details" / "Viewing" toggle the issues tables use for their row action; the click still selects the row (or runs `onArrowClick`). */}
									<span
										className="history-row-action"
										onClick={(event) => event.stopPropagation()}
									>
										<ButtonInput
											buttons={
												selectedRow?.id === row.id
													? {
															text: __('Viewing', 'vulopilot'),
															icon: 'eye',
															color: 'text-green',
															onClick: () => (onArrowClick ?? onSelectRow)(row),
														}
													: {
															text: __('More Details', 'vulopilot'),
															rightIcon: 'pagination-next-arrow',
															color: 'text-purple',
															onClick: () => (onArrowClick ?? onSelectRow)(row),
													}
											}
										/>
									</span>
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
						rightIcon:  'arrow-right',
						text: isLoadingMore
							? __('Loading…', 'vulopilot')
							: __('Load more', 'vulopilot'),
						color: 'text-purple',
						onClick: onLoadMore,
						disabled: isLoadingMore,
					}}
				/>
			)}
		</div>
	);
};

export default HistoryTimeline;
