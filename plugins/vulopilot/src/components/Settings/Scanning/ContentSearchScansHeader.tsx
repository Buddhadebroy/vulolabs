/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { ButtonInput } from '@zyra/inputs';
import { useSetting } from '../../../contexts/SettingContext';

interface ResetResult {
	success: boolean;
	content_search_scans?: Record<string, unknown>;
}

/**
 * Settings → Scanning → Content & Search's own "Restore Defaults" button —
 * scoped to just the `content_search_scans` field (the 5-row scan-category
 * panel this tab's `modal` renders directly below), not the sitewide
 * `POST /settings/reset` General.ts's own "Reset all settings" button
 * already uses. Real, new REST route
 * (Controllers\Settings::reset_content_search_scans()) that only touches
 * this one nested setting, leaving every other tab's settings untouched.
 *
 * Rendered BEFORE this tab's own fields (Settings.tsx's own GetForm(),
 * same "before, not after" placement AiVisibilityScansHeader.tsx uses) so
 * it sits above the scan-category rows, matching the mockup. Calls
 * `updateSetting('content_search_scans', ...)` on success so the panel
 * below reflects the restored defaults immediately, without a page
 * reload.
 */
const ContentSearchScansHeader = () => {
	const { updateSetting } = useSetting();
	const [isResetting, setIsResetting] = useState(false);

	const restoreDefaults = () => {
		setIsResetting(true);

		sendApiResponse<ResetResult>(
			appLocalizer,
			getApiLink(appLocalizer, 'settings/reset-content-search-scans'),
			{}
		)
			.then((response) => {
				if (response?.success && response.content_search_scans) {
					updateSetting('content_search_scans', response.content_search_scans);
				}
			})
			.finally(() => setIsResetting(false));
	};

	return (
		<div className="ai-visibility-scans-header">
			<ButtonInput
				wrapperClass="ai-visibility-restore-defaults"
				buttons={{
					text: isResetting ? __('Restoring…', 'vulopilot') : __('Restore Defaults', 'vulopilot'),
					icon: 'refresh',
					color: 'border-purple',
					disabled: isResetting,
					onClick: restoreDefaults,
				}}
			/>
		</div>
	);
};

export default ContentSearchScansHeader;
