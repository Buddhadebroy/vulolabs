/* global vulopilotAppLocalizer */
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import { NoticeComponent, PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { formatWpDate } from '../../services/formatWpDate';
import ShowProPopup from '../Popup/Popup';

interface TestReportResult {
	success: boolean;
	message: string;
}

interface StoredSettings {
	report_last_test_sent?: string;
}

const nonceHeaders = { headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } };

/**
 * Settings → Reports' own "Send Test Report" button.
 */
const SendTestReportButton = () => {
	const isPro = Boolean(vulopilotAppLocalizer.khali_dabba);
	const [lastSentAt, setLastSentAt] = useState<string | null>(null);
	const [isSending, setIsSending] = useState(false);
	const [result, setResult] = useState<TestReportResult | null>(null);
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);

	useEffect(() => {
		getApiResponse<StoredSettings>(getApiLink(vulopilotAppLocalizer, 'settings'), nonceHeaders).then(
			(response) => {
				if (response?.report_last_test_sent) {
					setLastSentAt(response.report_last_test_sent);
				}
			}
		);
	}, []);

	const sendTestReport = () => {
		setIsSending(true);
		setResult(null);

		sendApiResponse<TestReportResult>(
			vulopilotAppLocalizer,
			getApiLink(vulopilotAppLocalizer, 'settings/test-report'),
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
		<div className="send-test-report-button">
			<div className="send-test-report-actions">
				<ButtonInput
					wrapperClass="send-test-report-button-input"
					position="left"
					buttons={{
						color: 'text-purple',
						rightIcon: 'send',
						text: isSending
							? __('Sending…', 'vulopilot')
							: __('Send Test Report', 'vulopilot'),
						disabled: isSending,
						onClick: isPro ? sendTestReport : () => setIsProPopupOpen(true),
					}}
				/>
			</div>

			{/* * Portaled straight to body - this button is rendered as * Reports.ts's `settingAction` (zyra's own `.right-content` * header slot, `translateY(-50%)`-centered). zyra's * PopupComponent doesn't portal itself (renders wherever it * sits in the tree), so left inline here it would mount as a * DESCENDANT of that `transform`-ed `.right-content` - which * CSS spec makes the containing block for any `position: * fixed` element inside it, so the popup's fixed backdrop/ * content would size themselves to that small header row * instead of the viewport (confirmed live: a squashed sliver * instead of a real lightbox). */}
			{createPortal(
				<PopupComponent
					open={isProPopupOpen}
					onClose={() => setIsProPopupOpen(false)}
					width={31.25}
					height="auto"
					position="lightbox"
				>
					<ShowProPopup />
				</PopupComponent>,
				document.body
			)}

			{result && (
				<NoticeComponent
					displayPosition="inline"
					type={result.success ? 'success' : 'error'}
					message={result.message}
				/>
			)}

			{!result && lastSentAt && (
				<NoticeComponent
					displayPosition="inline"
					type="success"
					message={`${__('Last test report sent on', 'vulopilot')} ${formatWpDate(lastSentAt)}`}
				/>
			)}
		</div>
	);
};

export default SendTestReportButton;
