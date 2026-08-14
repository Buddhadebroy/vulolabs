/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import { CardComponent, NoticeManager } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { formatWpDate } from '../../services/formatWpDate';

interface FailedRunRow {
	id: number;
	automation_id: number;
	automation_name: string;
	started_at: string;
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

interface AutomationAttentionCardProps {
	onViewAll: () => void;
}

/**
 * "Needs your attention" — real failed automation runs, via
 * `GET /automation-runs?status=failed` (same Pro-only endpoint
 * AutomationActivityCard.tsx already reads, just filtered to failures
 * rather than everything — its own raw-fetch-not-useApiList reasoning
 * applies here too: Pro inactive should silently degrade to an empty
 * section, not show a misleading error card). The mockup's own two
 * example rows ("Website check couldn't finish"/"Monthly report has no
 * recipient") don't correspond to real tracked failure reasons — no
 * per-check-type failure classification or report-recipient validation
 * exists in the Automation Engine's data model — so each row shows the
 * real automation name and real run time instead. "Try Again" is a real
 * re-run, `POST /automations/{id}/run` (the same action
 * ManageAutomationsSection.tsx's own "Run now" row action already calls),
 * not a fabricated retry.
 */
const AutomationAttentionCard = ({ onViewAll }: AutomationAttentionCardProps) => {
	const [rows, setRows] = useState<FailedRunRow[] | null>(null);
	const [total, setTotal] = useState(0);
	const [retryingId, setRetryingId] = useState<number | null>(null);

	const fetchFailedRuns = () => {
		const baseUrl = getApiLink(appLocalizer, 'automation-runs');
		const url = `${baseUrl}${baseUrl.includes('?') ? '&' : '?'}status=failed&per_page=3`;

		getApiResponse<{ data: FailedRunRow[]; total: number }>(url, nonceHeaders)
			.then((response) => {
				setRows(response?.data ?? []);
				setTotal(response?.total ?? 0);
			})
			.catch(() => setRows([]));
	};

	useEffect(fetchFailedRuns, []);

	if (null === rows || 0 === rows.length) {
		return null;
	}

	const retry = (row: FailedRunRow) => {
		setRetryingId(row.automation_id);

		sendApiResponse<{ success: boolean }>(
			appLocalizer,
			getApiLink(appLocalizer, `automations/${row.automation_id}/run`),
			{}
		)
			.then((response) => {
				if (response?.success) {
					NoticeManager.add({
						uniqueKey: 'vulopilot-automation-retry',
						type: 'success',
						position: 'float',
						message: sprintf(
							/* translators: %s is the automation's name. */
							__('%s ran again.', 'vulopilot'),
							row.automation_name
						),
					});
					fetchFailedRuns();
				} else {
					NoticeManager.add({
						uniqueKey: 'vulopilot-automation-retry-failed',
						type: 'error',
						position: 'float',
						message: __('Could not run this automation again.', 'vulopilot'),
					});
				}
			})
			.catch(() => {
				NoticeManager.add({
					uniqueKey: 'vulopilot-automation-retry-failed',
					type: 'error',
					position: 'float',
					message: __('Could not run this automation again.', 'vulopilot'),
				});
			})
			.finally(() => setRetryingId(null));
	};

	return (
		<CardComponent className="automation-attention-card">
			<div className="automation-attention-header">
				<h3>
					{__('Needs your attention', 'vulopilot')}
					<span className="automation-attention-count">{total}</span>
				</h3>
			</div>
			<div className="automation-attention-list">
				{rows.map((row) => (
					<div className="automation-attention-row" key={row.id}>
						<i className="adminfont-error" />
						<div className="automation-attention-body">
							<strong>
								{sprintf(
									/* translators: %s is the automation's name. */
									__('%s failed to run', 'vulopilot'),
									row.automation_name
								)}
							</strong>
							<div className="desc">
								{sprintf(
									/* translators: %s is a formatted date. */
									__('Last attempt: %s', 'vulopilot'),
									formatWpDate(row.started_at)
								)}
							</div>
						</div>
						<ButtonInput
							buttons={{
								text:
									retryingId === row.automation_id
										? __('Retrying…', 'vulopilot')
										: __('Try Again', 'vulopilot'),
								disabled: retryingId === row.automation_id,
								onClick: () => retry(row),
							}}
						/>
					</div>
				))}
			</div>
			<span
				className="automation-attention-view-all"
				role="button"
				tabIndex={0}
				onClick={onViewAll}
			>
				{__('View all issues →', 'vulopilot')}
			</span>
		</CardComponent>
	);
};

export default AutomationAttentionCard;
