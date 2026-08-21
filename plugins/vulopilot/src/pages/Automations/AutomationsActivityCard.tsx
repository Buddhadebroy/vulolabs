/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, BadgeComponent } from '@zyra/components';

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

const STATUS_META: Record<AutomationRunRow['status'], { label: string; color: string }> = {
	completed: { label: __('Completed', 'vulopilot'), color: 'green' },
	failed: { label: __('Failed', 'vulopilot'), color: 'red' },
	running: { label: __('Running', 'vulopilot'), color: 'grey' },
};

/** Real "Today, 9:00 AM"/"Yesterday, 8:00 AM"/"Aug 9, 8:00 AM" — same technique `AutomationStatsRow.tsx`'s own `formatLastCheck()` already established, extended with a real "Yesterday" case since this feed shows several rows spanning more than just today/not-today. */
const formatActivityTime = (isoDate: string): string => {
	const date = new Date(isoDate.replace(' ', 'T') + 'Z');
	const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
	const today = new Date();
	const yesterday = new Date();
	yesterday.setDate(today.getDate() - 1);

	if (date.toDateString() === today.toDateString()) {
		return `${__('Today', 'vulopilot')}, ${time}`;
	}

	if (date.toDateString() === yesterday.toDateString()) {
		return `${__('Yesterday', 'vulopilot')}, ${time}`;
	}

	return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
};

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

	return (
		<CardComponent
			title={__('Recent automation activity', 'vulopilot')}
			isLoading={isLoading}
			action={
				<span className="automation-activity-view-all" onClick={onViewHistory}>
					{__('View automation history →', 'vulopilot')}
				</span>
			}
		>
			<div className="automation-activity-list">
				{rows.map((row) => {
					const status = STATUS_META[row.status];

					return (
						<div className="automation-activity-row" key={row.id}>
							<div className={`automation-activity-icon is-${status.color}`}>
								<i className="adminfont-automation" />
							</div>
							<div className="automation-activity-body">
								<span className="automation-activity-time">
									{formatActivityTime(row.finished_at ?? row.started_at)}
								</span>
								<strong>
									{row.automation_name} {STATUS_META[row.status].label.toLowerCase()}
								</strong>
								<p>{describeOutcome(row)}</p>
							</div>
							<BadgeComponent color={status.color} text={status.label} />
						</div>
					);
				})}
			</div>
		</CardComponent>
	);
};

export default AutomationsActivityCard;
