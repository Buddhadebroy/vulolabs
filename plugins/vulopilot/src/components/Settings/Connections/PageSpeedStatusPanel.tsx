/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import { ButtonInput } from '@zyra/inputs';
import { FormGroupComponent, FormGroupWrapperComponent, NoticeManager } from '@zyra/components';
import CardHeader from '../../CardHeader';
import { formatWpDate } from '../../../services/formatWpDate';

interface PsiStatus {
	connected: boolean;
	mobile: number | null;
	desktop: number | null;
	checked_at: string | null;
	requests_today: number;
	daily_limit: number;
}

interface TestResult {
	success: boolean;
	message: string;
	mobile: number | null;
	desktop: number | null;
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * Settings → Connections → PageSpeed Insights' own status header — the
 * mockup's "Connection Status" pill, "Daily API Usage" bar, and
 * "Test Connection" button. Rendered BEFORE this tab's own `modal` fields
 * (Settings.tsx's own GetForm(), same interleaving `isGeoTabSplit` already
 * does for llms.txt) since the mockup places this row above the API Key
 * field, not after it like CrawlerAlertTestPanel/BackupStoragePanel's own
 * "appended after" escape hatches.
 *
 * Reads real state from `GET /settings/test-pagespeed`
 * (Services\PageSpeedInsightsFetcher::get_status() — no live API call) on
 * mount, and re-reads it after a real `POST /settings/test-pagespeed`
 * (::test_connection(), the same class the daily cron itself uses).
 *
 * The mockup's own "Default Strategy" and "Analysis Location" controls
 * aren't reproduced anywhere in this tab: Google's real PageSpeed Insights
 * API v5 always scores both Mobile AND Desktop together (there's no
 * "default" that changes what gets fetched — see PerformanceScoreCard.tsx,
 * which already shows both), and has no parameter for choosing where the
 * test runs from (only `locale`, for the report's own language — a
 * different thing than the mockup's "closest location improves accuracy"
 * claim). Same "no real backend, don't build a fake control" posture
 * Reports.ts's own docblock already documents for "Report Branding".
 */
const PageSpeedStatusPanel = () => {
	const [status, setStatus] = useState<PsiStatus | null>(null);
	const [isTesting, setIsTesting] = useState(false);

	const loadStatus = () => {
		getApiResponse<PsiStatus>(getApiLink(appLocalizer, 'settings/test-pagespeed'), nonceHeaders).then(
			(response) => {
				if (response) {
					setStatus(response);
				}
			}
		);
	};

	useEffect(loadStatus, []);

	const testConnection = () => {
		setIsTesting(true);

		sendApiResponse<TestResult>(
			appLocalizer,
			getApiLink(appLocalizer, 'settings/test-pagespeed'),
			{}
		)
			.then((response) => {
				if (!response) {
					return;
				}
				// Floating notice (NoticeReceiverComponent position="float",
				// already mounted app-wide by zyra's own HeaderComponent) —
				// per direct instruction, not the inline <p> this used to
				// render in the card body.
				NoticeManager.add({
					message: response.message,
					type: response.success ? 'success' : 'error',
					position: 'float',
				});
				if (response.success) {
					loadStatus();
				}
			})
			.finally(() => setIsTesting(false));
	};

	const usagePercent =
		status && status.daily_limit > 0
			? Math.min(100, Math.round((status.requests_today / status.daily_limit) * 100))
			: 0;

	return (
		<FormGroupWrapperComponent>
			<FormGroupComponent>
				<CardHeader
					icon="analytics"
					className='compact'
					title={__('PageSpeed Insights', 'vulopilot')}
					desc={__(
						'Get real-performance data and optimization insights directly from Google PageSpeed Insights.',
						'vulopilot'
					)}
					badge={
						<span className={`admin-badge ${status?.connected ? 'green' : 'red'}`}>
							{status?.connected ? __('Connected', 'vulopilot') : __('Not Connected', 'vulopilot')}
						</span>
					}
					action={
						<>
							<ButtonInput
								wrapperClass="psi-test-connection-button"
								buttons={{
									text: isTesting ? __('Testing…', 'vulopilot') : __('Test Connection', 'vulopilot'),
									icon: 'update',
									disabled: isTesting,
									onClick: testConnection,
								}}
							/>
						</>
					}
				>
					<div className="ai-provider-card-body">
						{status && status.daily_limit > 0 && (
							<div className="psi-usage">
								<div className="psi-usage-label">
									<span>{__('Daily API Usage', 'vulopilot')}</span>
									<span>{usagePercent}%</span>
								</div>
								<div className="psi-usage-bar">
									<div className="psi-usage-bar-fill" style={{ width: `${usagePercent}%` }} />
								</div>
								<div className="desc">
									{sprintf(
										/* translators: 1: requests made today, 2: the site's own configured daily limit. */
										__('%1$s / %2$s requests used', 'vulopilot'),
										status.requests_today.toLocaleString(),
										status.daily_limit.toLocaleString()
									)}
								</div>
							</div>
						)}

						{status?.connected && status.checked_at && (
							<div className="desc psi-last-checked">
								{sprintf(
									/* translators: %s is a formatted date/time. */
									__('Last checked on %s.', 'vulopilot'),
									formatWpDate(status.checked_at)
								)}
								{'number' === typeof status.mobile && 'number' === typeof status.desktop && (
									<>
										{' '}
										{sprintf(
											/* translators: 1: mobile score, 2: desktop score, both 0-100. */
											__('Mobile %1$d/100, Desktop %2$d/100.', 'vulopilot'),
											status.mobile,
											status.desktop
										)}
									</>
								)}
							</div>
						)}
					</div>
				</CardHeader>
			</FormGroupComponent>
		</FormGroupWrapperComponent>
	);
};

export default PageSpeedStatusPanel;
