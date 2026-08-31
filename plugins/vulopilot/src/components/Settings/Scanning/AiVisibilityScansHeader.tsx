/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { ButtonInput } from '@zyra/inputs';
import { useSetting } from '../../../contexts/SettingContext';

interface ResetResult {
	success: boolean;
	ai_visibility_scans?: Record<string, unknown>;
}

/**
 * Settings → Scanning → AI Visibility's own "Restore Defaults" button —
 * scoped to just the `ai_visibility_scans` field (the 5-row scan-category
 * panel this tab's `modal` renders directly below), not the sitewide
 * `POST /settings/reset` General.ts's own "Reset all settings" button
 * already uses. Real, new REST route
 * (Controllers\Settings::reset_ai_visibility_scans()) that only touches
 * this one nested setting, leaving every other tab's settings untouched —
 * a full-site reset would be a much bigger, unrelated blast radius for a
 * button that visually sits on top of one 5-row list.
 *
 * Rendered BEFORE this tab's own fields (Settings.tsx's own GetForm(),
 * same "before, not after" placement PageSpeedStatusPanel.tsx uses) so it
 * sits above the scan-category rows, matching the mockup. Calls
 * `updateSetting('ai_visibility_scans', ...)` on success so the panel
 * below reflects the restored defaults immediately, without a page
 * reload — the plain `type: 'button'` field shape (ButtonInputFieldComponent)
 * doesn't do this on its own, since it never touches SettingContext.
 */
const AiVisibilityScansHeader = () => {
	const { updateSetting } = useSetting();
	const [isResetting, setIsResetting] = useState(false);

	const restoreDefaults = () => {
		setIsResetting(true);

		sendApiResponse<ResetResult>(
			appLocalizer,
			getApiLink(appLocalizer, 'settings/reset-ai-visibility-scans'),
			{}
		)
			.then((response) => {
				if (response?.success && response.ai_visibility_scans) {
					updateSetting('ai_visibility_scans', response.ai_visibility_scans);
				}
			})
			.finally(() => setIsResetting(false));
	};

	return (
		<>
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
		</>
	);
};

export default AiVisibilityScansHeader;
