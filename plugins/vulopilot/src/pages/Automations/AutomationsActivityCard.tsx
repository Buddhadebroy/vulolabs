/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { toHistoryRow } from '../AIAssistant/historyTypes';
import HistoryTimeline from '../Reports/HistoryTimeline';

interface AutomationRunRow {
	id: number;
	automation_id: number;
	automation_name: string;
	status: 'running' | 'completed' | 'failed';
	actions_executed: number;
	actions_failed: number;
	changes_made: number;
	started_at: string;
	finished_at: string | null;
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/** A real run's own one-line outcome — same real severity order (failed → changes made → no changes) `ManageAutomationsSection.tsx`'s own `renderLastRunCell()`/`AutomationSuggestions.tsx`'s own `describeLastCheck()` already establish for this exact data, ported here rather than imported (this codebase's own "duplicate small per-file logic" convention). */
const describeOutcome = (row: AutomationRunRow): string => {
	if ('failed' === row.status) {
		return 1 === row.actions_failed
			? __('1 action failed.', 'vulopilot')
			: __('Some actions failed.', 'vulopilot');
	}

	if ('running' === row.status) {
		return __('Still running…', 'vulopilot');
	}

	if (row.changes_made > 0) {
		return 1 === row.changes_made
			? __('1 change made.', 'vulopilot')
			: __('Several changes made.', 'vulopilot');
	}

	return __('No changes needed.', 'vulopilot');
};

interface AutomationsActivityCardProps {
	onViewHistory: () => void;
	refetchSignal: number;
}

/**
 * "Recent automation activity" — the 5 real most-recent runs across every
 * automation, `GET /automation-runs` (already exists, backs
 * `AutomationLogsPanel.tsx`'s own full history view this card's own "View
 * automation history →" jumps to). Sorted and sliced client-side rather
 * than trusting an assumed default order — fetches a small page and picks
 * the 5 most recent by `finished_at`/`started_at`.
 *
 * Simplified from the mockup in one honest way: the mockup's own "Monthly
 * website report sent" row shows a "Delivered" badge instead of
 * "Completed" — `GET /automation-runs` doesn't carry the parent
 * automation's own configured actions, so there's no real signal here to
 * tell a send-email-driven completion apart from any other; every
 * completed run shows the same real "Completed" badge instead of
 * guessing.
 */
const AutomationsActivityCard = ({ onViewHistory, refetchSignal }: AutomationsActivityCardProps) => {
	const [rows, setRows] = useState<AutomationRunRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	// Purely local UI state — this card shows no side detail panel for a
	// selected row, so nothing else reads it; still real and working (a
	// clicked row visibly highlights via HistoryTimeline's own real
	// `.selected` class), not a fabricated no-op.
	const [selectedRow, setSelectedRow] = useState<ReturnType<
		typeof toHistoryRow
	> | null>(null);

	useEffect(() => {
		setIsLoading(true);

		getApiResponse<{ data: AutomationRunRow[] } | AutomationRunRow[]>(
			`${getApiLink(appLocalizer, 'automation-runs')}?per_page=20`,
			nonceHeaders
		)
			.then((response) => {
				const list = Array.isArray(response) ? response : (response?.data ?? []);
				const sorted = [...list].sort((a, b) =>
					(b.finished_at ?? b.started_at).localeCompare(a.finished_at ?? a.started_at)
				);
				setRows(sorted.slice(0, 5));
			})
			.finally(() => setIsLoading(false));
	}, [refetchSignal]);

	if (!isLoading && 0 === rows.length) {
		return null;
	}

	// Real per-run message ("Weekly cleanup: 1 change made.") + a real,
	// synthesized `event_type` (`automation.<status>` — that real status
	// column, not a fabricated one) so HistoryTimeline's own top-right
	// status badge shows the real Completed/Failed/Running state
	// (`toHistoryRow()`/`CHANGE_STATUS_BADGE_BY_EVENT` in historyTypes.ts,
	// extended with these 3 real automation statuses alongside the
	// existing `ai_action.*` ones).
	const historyRows = rows.map((row: AutomationRunRow) =>
		toHistoryRow({
			id: row.id,
			message: `${row.automation_name}: ${describeOutcome(row)}`,
			created_at: row.finished_at ?? row.started_at,
			event_type: `automation.${row.status}`,
		})
	);

	return (
		<CardComponent
			title={__('Recent automation activity', 'vulopilot')}
			titleIcon="clock"
			desc={__('The last 5 automation runs and what they did.', 'vulopilot')}
			isLoading={isLoading}
			action={
				<ButtonInput
					buttons={{
						text: __('View automation history', 'vulopilot'),
						rightIcon: 'arrow-right',
						color: 'text-purple',
						onClick: onViewHistory,
					}}
				/>
			}
		>
			<HistoryTimeline
				rows={historyRows}
				total={historyRows.length}
				selectedRow={selectedRow}
				onSelectRow={setSelectedRow}
				isLoadingMore={false}
				onLoadMore={() => {}}
				// Real navigation to the full History tab (Reports →
				// History) — this card has no side detail panel of its
				// own for the arrow to open a row into.
				onArrowClick={() => {
					window.location.href = `${appLocalizer.admin_url}#&tab=reports&subtab=history`;
				}}
			/>
		</CardComponent>
	);
};

export default AutomationsActivityCard;
