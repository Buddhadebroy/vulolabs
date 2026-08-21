/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import { CardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import type { AutomationRow } from './ManageAutomationsSection';

interface AutomationAttentionCardProps {
	onViewAll: () => void;
	/** Bumped by the host after something changes elsewhere on the page (a new automation created, a status toggled) — this card fetches its own copy of the list (small, per-file fetch, same convention `AutomationSuggestions.tsx` already established), so it needs to know when to refetch. */
	refetchSignal: number;
}

/**
 * "Needs your attention" — real currently-enabled automations whose most
 * recent run actually failed (`last_run_status === 'failed'`, already
 * returned by `GET /automations` — no new endpoint). Deliberately doesn't
 * include the mockup's own second example, "Monthly report has no
 * recipient": confirmed against `SendEmailAction.php` that a `send-email`
 * action always resolves a real recipient (`config.recipient` → the
 * `notification_email` setting → WordPress's own `admin_email`, which
 * every site has) — there is no real "nothing configured anywhere"
 * condition to detect, so surfacing that example here would be a fabricated
 * alert with nothing behind it. "Try Again" re-runs the real automation
 * (`POST /automations/{id}/run`, the same action `ManageAutomationsSection.tsx`'s
 * own row-level "Run now" already performs).
 */
const AutomationAttentionCard = ({ onViewAll, refetchSignal }: AutomationAttentionCardProps) => {
	const [failing, setFailing] = useState<AutomationRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [retryingId, setRetryingId] = useState<number | null>(null);

	useEffect(() => {
		setIsLoading(true);

		getApiResponse<{ data: AutomationRow[] } | AutomationRow[]>(
			`${getApiLink(appLocalizer, 'automations')}?per_page=100`,
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				const list = Array.isArray(response) ? response : (response?.data ?? []);
				setFailing(
					list.filter(
						(row) => 'enabled' === row.status && 'failed' === row.last_run_status
					)
				);
			})
			.finally(() => setIsLoading(false));
	}, [refetchSignal]);

	const handleRetry = (row: AutomationRow) => {
		setRetryingId(row.id);

		sendApiResponse(appLocalizer, getApiLink(appLocalizer, `automations/${row.id}/run`), {})
			.then((response) => {
				if (response) {
					setFailing((current) => current.filter((item) => item.id !== row.id));
				}
			})
			.finally(() => setRetryingId(null));
	};

	return (
		<CardComponent
			title={
				<>
					{__('Needs your attention', 'vulopilot')}
					{failing.length > 0 && (
						<span className="automation-attention-count">{failing.length}</span>
					)}
				</>
			}
			isLoading={isLoading}
		>
			{!isLoading && 0 === failing.length && (
				<div className="automation-attention-empty">
					<i className="adminfont-check" />
					<p>{__("You're all caught up — nothing needs attention right now.", 'vulopilot')}</p>
				</div>
			)}
			<div className="automation-attention-list">
				{failing.map((row) => (
					<div className="automation-attention-row" key={row.id}>
						<i className="adminfont-warning" />
						<div className="automation-attention-body">
							<strong>
								{sprintf(
									/* translators: %s is the real automation's own name whose last run failed. */
									__('%s couldn\'t finish', 'vulopilot'),
									row.name
								)}
							</strong>
							<p>{__('The last scheduled run didn\'t complete successfully.', 'vulopilot')}</p>
						</div>
						<ButtonInput
							buttons={{
								text:
									retryingId === row.id
										? __('Retrying…', 'vulopilot')
										: __('Try Again', 'vulopilot'),
								onClick: () => handleRetry(row),
								disabled: null !== retryingId,
							}}
						/>
					</div>
				))}
			</div>
			{failing.length > 0 && (
				<span className="automation-attention-view-all" onClick={onViewAll}>
					{__('View all issues →', 'vulopilot')}
				</span>
			)}
		</CardComponent>
	);
};

export default AutomationAttentionCard;
