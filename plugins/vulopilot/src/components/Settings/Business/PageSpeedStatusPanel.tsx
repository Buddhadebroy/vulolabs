/* global appLocalizer */
import { useEffect, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import { ButtonInput, TextInput } from '@zyra/inputs';
import { FormGroupComponent, FormGroupWrapperComponent, NoticeComponent, NoticeManager } from '@zyra/components';
import CardHeader from '../../CardHeader';
import { formatWpDate } from '../../../services/formatWpDate';
import { useSetting } from '../../../contexts/SettingContext';

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
 * Settings → Connections' own PageSpeed Insights section — the mockup's
 * "Connection Status" pill, "Daily API Usage" bar, "Test Connection"
 * button, and (per direct instruction, when this folder's 5 separate
 * sub-tabs were merged into one "Connections" tab) the real "API Key"/
 * "Daily API Limit" fields and the "how this data is used" notice that
 * used to be rendered separately by InputRenderer against this tab's own
 * `modal` array — now fully self-contained, same "one real component per
 * section" shape ConnectionsPanel.tsx composes GoogleServicesPanel.tsx/
 * SiteVerificationPanel.tsx/AiProvidersPanel.tsx from.
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
const AUTOSAVE_DEBOUNCE_MS = 1000;

const PageSpeedStatusPanel = () => {
	const { setting, updateSetting } = useSetting();
	const [status, setStatus] = useState<PsiStatus | null>(null);
	const [isTesting, setIsTesting] = useState(false);
	const [apiKey, setApiKey] = useState((setting.psi_api_key as string) || '');
	const [dailyLimit, setDailyLimit] = useState((setting.psi_daily_limit as string) || '');
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const scheduleSave = (key: string, value: string) => {
		if (saveTimerRef.current) {
			clearTimeout(saveTimerRef.current);
		}
		saveTimerRef.current = setTimeout(() => {
			updateSetting(key, value);
			sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'settings'), {
				setting: { [key]: value },
			});
		}, AUTOSAVE_DEBOUNCE_MS);
	};

	const handleApiKeyChange = (value: string) => {
		setApiKey(value);
		scheduleSave('psi_api_key', value);
	};

	const handleDailyLimitChange = (value: string) => {
		setDailyLimit(value);
		scheduleSave('psi_daily_limit', value);
	};

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
					icon="analytics green"
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
									icon: 'refresh',
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
			<FormGroupComponent cols={6} label={__('API Key', 'vulopilot')} htmlFor="psi-api-key-input">
				<TextInput
					id="psi-api-key-input"
					type="password"
					value={apiKey}
					onChange={(value) => handleApiKeyChange(String(value))}
				/>
			</FormGroupComponent>
			<FormGroupComponent cols={6} label={__('Daily API Limit', 'vulopilot')} htmlFor="psi-daily-limit-input">
				<TextInput
					id="psi-daily-limit-input"
					type="number"
					value={dailyLimit}
					onChange={(value) => handleDailyLimitChange(String(value))}
				/>
			</FormGroupComponent>
			<NoticeComponent
				displayPosition="inline-notice"
				type="info"
				message={__(
					'VuloPilot uses PageSpeed Insights API data to show speed reports under Improve My Speed. We only read performance data and never make changes to your site.',
					'vulopilot'
				)}
			/>
		</FormGroupWrapperComponent>
	);
};

export default PageSpeedStatusPanel;
