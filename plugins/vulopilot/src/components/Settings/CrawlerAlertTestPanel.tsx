/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import { ButtonInput } from '@zyra/inputs';
import { formatWpDate } from '../../services/formatWpDate';

interface TestAlertResult {
	success: boolean;
	message: string;
}

interface StoredSettings {
	crawler_alert_last_test_sent?: string;
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * Settings → Notifications → AI Crawler Alerts' own "Send Test Alert" row
 * — real `POST /settings/test-crawler-alert` (Controllers\Settings::send_test_crawler_alert(),
 * which itself only fires a filter vulopilot-pro's CrawlerAlertMonitor
 * listens on — see that method's own docblock for why Free's controller
 * can't call Pro's class directly), plus the persisted "Last test alert
 * sent successfully on ..." line. A hand-built component rather than
 * another declarative field type — needed here for the same reason
 * BackupStoragePanel.tsx exists for Backups: a real API call and a value
 * that must still be visible after a page refresh, neither of which a
 * static `type: 'notice'` field's `message` string (evaluated once, at
 * config-definition time) can provide.
 *
 * Unlike BackupStoragePanel.tsx (which Settings.tsx's own GetForm()
 * appends after ALL of its tab's fields), this one is wired straight into
 * AiCrawlerAlerts.ts's own "Notification channels" `type: 'section'`
 * field, via `SectionComponent`'s real `rightContent` slot — see that
 * file's own docblock for why this belongs next to the channels it tests
 * rather than at the bottom of the tab.
 *
 * Reads its own `crawler_alert_last_test_sent` value directly from
 * `GET /settings` on mount rather than through SettingContext — that
 * context only ever seeds the ACTIVE tab's own `modal[].key` list
 * (Settings.tsx's own GetForm()), and this key deliberately isn't one of
 * AiCrawlerAlerts.ts's fields (it's system-set, never user-edited), so it
 * would never be seeded there anyway.
 */
const CrawlerAlertTestPanel = () => {
	const [lastSentAt, setLastSentAt] = useState<string | null>(null);
	const [isSending, setIsSending] = useState(false);
	const [result, setResult] = useState<TestAlertResult | null>(null);

	useEffect(() => {
		getApiResponse<StoredSettings>(getApiLink(appLocalizer, 'settings'), nonceHeaders).then(
			(response) => {
				if (response?.crawler_alert_last_test_sent) {
					setLastSentAt(response.crawler_alert_last_test_sent);
				}
			}
		);
	}, []);

	const sendTestAlert = () => {
		setIsSending(true);
		setResult(null);

		sendApiResponse<TestAlertResult>(
			appLocalizer,
			getApiLink(appLocalizer, 'settings/test-crawler-alert'),
			{}
		)
			.then((response) => {
				if (!response) {
					return;
				}
				setResult(response);
				if (response.success) {
					setLastSentAt(new Date().toISOString());
				}
			})
			.finally(() => setIsSending(false));
	};

	return (
		<div className="crawler-alert-test-panel">
			<ButtonInput
				wrapperClass="crawler-alert-test-button"
				position="left"
				buttons={{
					text: isSending
						? __('Sending…', 'vulopilot')
						: __('Send Test Alert', 'vulopilot'),
					disabled: isSending,
					onClick: sendTestAlert,
				}}
			/>

			{result && (
				<p
					className={`crawler-alert-test-result ${
						result.success ? 'is-success' : 'is-error'
					}`}
				>
					{result.message}
				</p>
			)}

			{!result && lastSentAt && (
				<p className="crawler-alert-test-result is-success">
					{__('Last test alert sent successfully on', 'vulopilot')}{' '}
					{formatWpDate(lastSentAt)}
				</p>
			)}
		</div>
	);
};

export default CrawlerAlertTestPanel;
