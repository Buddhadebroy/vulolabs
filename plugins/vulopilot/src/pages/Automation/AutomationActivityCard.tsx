/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	ActivityListComponent,
	CardComponent,
	ModuleGuardComponent,
	BadgeComponent,
} from '@zyra/components';
import { formatWpDate } from '../../services/formatWpDate';
import { ACTION_TYPE_LABELS } from './automationLabels';

interface RunResultEntry {
	success: boolean;
	action_id: string;
	message: string;
}

interface AutomationRunRow {
	id: number;
	automation_name: string;
	status: 'running' | 'completed' | 'failed';
	result_log: string | null;
	started_at: string;
}

interface ActivityRow {
	id: string;
	title: string;
	desc: string;
	timestamp: string;
	success: boolean;
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

const UNDO_DISABLED_REASON = __(
	"Undo isn't available yet for this change.",
	'vulopilot'
);

/**
 * "Automation Activity" — real, via GET /automation-runs (Pro), flattened
 * per result-log entry (one row per action a run actually executed) rather
 * than the mockup's fabricated specific captions ("Optimized 128 images",
 * "Updated 9 plugins" — neither is a real automation action; see
 * ActionRegistry's real 4: send-email/resolve-finding/create-notification/
 * run-ai-action). Undo is honestly disabled with a tooltip, same exact
 * convention Free's own Dashboard RecentChangesWidget.tsx already
 * established for AI/automation-attributed activity.
 *
 * A raw fetch (not useApiList) on purpose: automation-runs is Pro-only, and
 * useApiList's own error-with-Retry card would misleadingly imply a
 * transient failure when Pro simply isn't active — same graceful-
 * degradation shape AutomationStatusCard.tsx/RevenueInsightsCard.tsx use
 * for other Pro-only endpoints (silently falls back to the honest empty
 * state instead).
 */
const AutomationActivityCard = () => {
	const [runs, setRuns] = useState<AutomationRunRow[] | null>(null);

	useEffect(() => {
		const baseUrl = getApiLink(appLocalizer, 'automation-runs');
		const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}per_page=10`;

		getApiResponse<{ data: AutomationRunRow[] } | AutomationRunRow[]>(
			url,
			nonceHeaders
		).then((response) => {
			const list = Array.isArray(response)
				? response
				: (response?.data ?? []);
			setRuns(list);
		});
	}, []);

	if (runs === null) {
		return null;
	}

	const rows: ActivityRow[] = runs.flatMap((run) => {
		let entries: RunResultEntry[] = [];
		try {
			entries = run.result_log ? JSON.parse(run.result_log) : [];
		} catch {
			entries = [];
		}

		if (entries.length === 0) {
			return [
				{
					id: String(run.id),
					title: sprintf(
						/* translators: %s: automation name */
						__('%s ran', 'vulopilot'),
						run.automation_name
					),
					desc:
						run.status === 'failed'
							? __('This run failed.', 'vulopilot')
							: __('No actions were executed.', 'vulopilot'),
					timestamp: formatWpDate(run.started_at),
					success: run.status !== 'failed',
				},
			];
		}

		return entries.map((entry, index) => ({
			id: `${run.id}-${index}`,
			title: entry.message,
			desc: sprintf(
				/* translators: 1: automation name, 2: action type label */
				__('%1$s · %2$s', 'vulopilot'),
				run.automation_name,
				ACTION_TYPE_LABELS[entry.action_id] ?? entry.action_id
			),
			timestamp: formatWpDate(run.started_at),
			success: entry.success,
		}));
	});

	return (
		<CardComponent
			className="automation-activity-card"
			titleIcon="update"
			title={__('Automation Activity', 'vulopilot')}
		>
			{rows.length === 0 ? (
				<ModuleGuardComponent
					icon="update"
					title={__('No automation activity yet', 'vulopilot')}
					desc={__(
						'Actions your automations take will show up here once one runs.',
						'vulopilot'
					)}
				/>
			) : (
				<ActivityListComponent
					cols={2}
					items={rows.map((row) => ({
						id: row.id,
						icon: row.success ? 'check' : 'close',
						title: row.title,
						badge: <BadgeComponent color="blue" text="AI" />,
						desc: row.desc,
						timestamp: row.timestamp,
						action: {
							label: __('Undo', 'vulopilot'),
							icon: 'undo',
							disabled: true,
							disabledReason: UNDO_DISABLED_REASON,
						},
					}))}
				/>
			)}
		</CardComponent>
	);
};

export default AutomationActivityCard;
