import { __ } from '@wordpress/i18n';

export type HistoryFilter = 'all' | 'conversation' | 'scan' | 'change' | 'automation';

export interface ScanDetail {
	id: number;
	scanner_id: string;
	label: string;
	status: string;
	trigger_type: string;
	duration_ms: number | null;
	by_severity: Record<string, number>;
	total: number;
}

export interface ChangeDetail {
	id: number;
	action_id: string;
	label: string;
	status: 'pending_approval' | 'executed' | 'failed' | 'rejected' | 'rolled_back';
	before: string | null;
	after: string | null;
	format: 'text' | 'html' | 'json';
	error_message: string | null;
	page: string | null;
}

export interface HistoryRow {
	id: number | string;
	event_type: string;
	category: 'scan' | 'change';
	message: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
	created_at: string;
	scan: ScanDetail | null;
	change: ChangeDetail | null;
}

export const FILTER_TABS: { id: HistoryFilter; label: string }[] = [
	{ id: 'all', label: __('All', 'vulopilot') },
	{ id: 'conversation', label: __('Conversations', 'vulopilot') },
	{ id: 'scan', label: __('Scans', 'vulopilot') },
	{ id: 'change', label: __('Changes', 'vulopilot') },
	{ id: 'automation', label: __('Automations', 'vulopilot') },
];

/**
 * Every real row title comes straight from its real scan/change label —
 * never invented copy. `scan` rows always carry a real ScanDetail (their
 * REST enrichment only ever fails silently to `null` if the source scan
 * row was deleted after the fact — genuinely rare, and there's no honest
 * title to show for a vanished source row either way).
 */
export const rowTitle = (row: HistoryRow): string => {
	if (row.scan) {
		return row.scan.label;
	}

	if (row.change) {
		return row.change.label;
	}

	return row.message;
};

const CHANGE_ICON_BY_EVENT: Record<string, string> = {
	'ai_action.proposed': 'clock',
	'ai_action.executed': 'check',
	'ai_action.failed': 'error',
	'ai_action.rejected': 'close',
	'ai_action.rolled_back': 'undo',
};

export const rowIcon = (row: HistoryRow): string =>
	'scan' === row.category
		? 'search'
		: (CHANGE_ICON_BY_EVENT[row.event_type] ?? 'update');

/**
 * The mockup's bottom-left pale category tag ("Conversation"/"Scan"/
 * "Change"/"Automation") — always shown, one per row, real category only
 * (never "Scan Result"/"Automation" for a row that's actually a plain
 * scan/change, since those extra mockup categories aren't real event
 * types this table has — see Controllers/History.php's own docblock).
 */
export const rowTag = (row: HistoryRow): { text: string; className: string } =>
	'scan' === row.category
		? { text: __('Scan', 'vulopilot'), className: 'blue' }
		: { text: __('Change', 'vulopilot'), className: 'green' };

const CHANGE_STATUS_BADGE_BY_EVENT: Record<string, string> = {
	'ai_action.proposed': __('Proposed', 'vulopilot'),
	'ai_action.executed': __('Applied', 'vulopilot'),
	'ai_action.failed': __('Failed', 'vulopilot'),
	'ai_action.rejected': __('Rejected', 'vulopilot'),
	'ai_action.rolled_back': __('Rolled back', 'vulopilot'),
};

/**
 * The mockup's top-right status pill ("Applied") — change rows only, no
 * scan-row equivalent (a scan's own real outcome is its issue count,
 * shown via rowMeta() instead, matching the mockup's own "24 issues
 * found" placement there rather than a redundant pill). Reflects what
 * happened AT this specific timeline event (its own `event_type`), not
 * the joined run's current status — a "proposed" entry for a run that
 * was later executed still honestly reads "Proposed" here, since that's
 * what this row is a record of.
 */
export const rowStatusBadge = (
	row: HistoryRow
): { text: string; className: string } | null => {
	if ('change' !== row.category) {
		return null;
	}

	const text = CHANGE_STATUS_BADGE_BY_EVENT[row.event_type] ?? row.event_type;
	const classByEvent: Record<string, string> = {
		'ai_action.proposed': 'yellow',
		'ai_action.executed': 'green',
		'ai_action.failed': 'red',
		'ai_action.rejected': 'grey',
		'ai_action.rolled_back': 'grey',
	};

	return { text, className: classByEvent[row.event_type] ?? 'grey' };
};

/**
 * Real time-of-day, matching the mockup's own "10:24 AM" per-row display
 * — the day heading already carries the date, so the row itself only
 * needs the time.
 */
export const rowTime = (createdAt: string): string =>
	new Date(createdAt).toLocaleTimeString(undefined, {
		hour: 'numeric',
		minute: '2-digit',
	});

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "Today"/"Yesterday"/a real formatted date — same local-time-from-a-
 * MySQL-datetime-string handling formatWpDate.ts already relies on
 * (`new Date('2026-08-10 07:40:56')` parses as local time, no 'T'/'Z').
 */
export const dayLabel = (createdAt: string): string => {
	const date = new Date(createdAt);
	const today = new Date();
	const startOfToday = new Date(
		today.getFullYear(),
		today.getMonth(),
		today.getDate()
	);
	const startOfRow = new Date(
		date.getFullYear(),
		date.getMonth(),
		date.getDate()
	);
	const diffDays = Math.round(
		(startOfToday.getTime() - startOfRow.getTime()) / DAY_MS
	);

	if (0 === diffDays) {
		return __('Today', 'vulopilot');
	}

	if (1 === diffDays) {
		return __('Yesterday', 'vulopilot');
	}

	return date.toLocaleDateString(undefined, {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
};

/**
 * Groups already-desc-sorted rows into consecutive day buckets — the
 * grouping itself is done client-side (same precedent as
 * HealthTimelineWidget.tsx's own client-side day-grouping of snapshot
 * rows), since the REST endpoint stays a flat, ordinary paginated list.
 */
export const groupByDay = (
	rows: HistoryRow[]
): { label: string; rows: HistoryRow[] }[] => {
	const groups: { label: string; rows: HistoryRow[] }[] = [];

	rows.forEach((row) => {
		const label = dayLabel(row.created_at);
		const lastGroup = groups[groups.length - 1];

		if (lastGroup && lastGroup.label === label) {
			lastGroup.rows.push(row);
		} else {
			groups.push({ label, rows: [row] });
		}
	});

	return groups;
};
