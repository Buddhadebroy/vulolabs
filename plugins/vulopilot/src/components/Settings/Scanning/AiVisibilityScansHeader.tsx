/* global vulopilotAppLocalizer */
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
 * Settings → Scanning → AI Visibility's own "Restore Defaults" button.
 */
const AiVisibilityScansHeader = () => {
	const { updateSetting } = useSetting();
	const [isResetting, setIsResetting] = useState(false);

	const restoreDefaults = () => {
		setIsResetting(true);

		sendApiResponse<ResetResult>(
			vulopilotAppLocalizer,
			getApiLink(vulopilotAppLocalizer, 'settings/reset-ai-visibility-scans'),
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
