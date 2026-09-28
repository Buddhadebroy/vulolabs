/* global vulopilotAppLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { FormGroupWrapperComponent, NoticeManager } from '@zyra/components';
import { ButtonInput, MultiCheckboxInput, ToggleInput } from '@zyra/inputs';
import { useSetting } from '../../contexts/SettingContext';
import CardHeader from '../CardHeader';

/**
 * Hand-built panel (not InputRenderer-driven) for "Keep VuloPilot data after uninstall",
 * "Anonymous usage data" and Reset.
 */
const DeveloperToolsPanel = () => {
	const [isClearing, setIsClearing] = useState(false);
	const [isResetting, setIsResetting] = useState(false);
	const { setting, updateSetting } = useSetting();

	const keepDataUninstall = (setting.keep_data_uninstall as string) || 'keep_data';
	const anonymousUsageData = (setting.anonymous_usage_data as string) || 'disabled';

	// Moved from Settings → General's own "Basic Preferences" section (General.ts).
	const handleSettingChange = (key: string, value: string) => {
		updateSetting(key, value);
		sendApiResponse(vulopilotAppLocalizer, getApiLink(vulopilotAppLocalizer, 'settings'), {
			setting: { [key]: value },
		}).then((response) => {
			NoticeManager.add({
				uniqueKey: 'vulopilot-developer-tools-saved',
				type: response ? 'success' : 'error',
				position: 'float',
				message: response
					? __('Settings saved.', 'vulopilot')
					: __('Could not save settings. Please try again.', 'vulopilot'),
			});
		});
	};

	const handleClearCache = () => {
		setIsClearing(true);

		sendApiResponse(
			vulopilotAppLocalizer,
			getApiLink(vulopilotAppLocalizer, 'settings/clear-cache'),
			{}
		)
			.then((response) => {
				NoticeManager.add({
					uniqueKey: 'vulopilot-clear-cache',
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __('Cache cleared.', 'vulopilot')
						: __(
								'Could not clear the cache. Please try again.',
								'vulopilot'
							),
				});
			})
			.finally(() => setIsClearing(false));
	};

	// Moved from Settings → General's own "Basic Preferences" section (General.ts).
	const handleResetSettings = () => {
		setIsResetting(true);

		sendApiResponse(
			vulopilotAppLocalizer,
			getApiLink(vulopilotAppLocalizer, 'settings/reset'),
			{}
		)
			.then((response) => {
				// Every Settings tab keeps its own copy of the stored values in React state.
				if (response) {
					setTimeout(() => window.location.reload(), 1200);
				}

				NoticeManager.add({
					uniqueKey: 'vulopilot-reset-settings',
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __('Settings reset to defaults.', 'vulopilot')
						: __(
								'Could not reset settings. Please try again.',
								'vulopilot'
							),
				});
			})
			.finally(() => setIsResetting(false));
	};

	return (
		<>
			<FormGroupWrapperComponent>
				<CardHeader
					icon="setting pink"
					title={__('Anonymous usage data', 'vulopilot')}
					desc={__(
						'Help improve VuloPilot by sharing anonymous information about how its features are used. Not yet collected - this stores your preference for when usage reporting ships. No website content, passwords, customer information, or personal data is collected.',
						'vulopilot'
					)}
				>
					<MultiCheckboxInput
						look="toggle"
						options={[
							{ key: 'enabled', value: 'enabled', label: '' },
						]}
						value={'enabled' === anonymousUsageData ? ['enabled'] : []}
						onChange={(value) =>
							handleSettingChange(
								'anonymous_usage_data',
								(value as string[]).includes('enabled')
									? 'enabled'
									: 'disabled'
							)
						}
						toggleStatusLabel={{
							on: __('Enabled', 'vulopilot'),
							off: __('Disabled', 'vulopilot'),
						}}
						modules={[]}
					/>
				</CardHeader>
				<CardHeader
					icon="refresh pink"
					title={__('Cache', 'vulopilot')}
					desc={__(
						'Clears every real cached result VuloPilot computes - the Knowledge Graph’s extracted entities, the Schema Coverage snapshot, the robots.txt bot-access parse, and any cached Knowledge Graph recommendations. Everything is rebuilt fresh automatically the next time it’s needed - nothing is deleted permanently.',
						'vulopilot'
					)}
				>
					<ButtonInput
						buttons={{
							text: isClearing
								? __('Clearing…', 'vulopilot')
								: __('Clear cache', 'vulopilot'),
							icon: 'refresh',
							onClick: handleClearCache,
							disabled: isClearing,
						}}
					/>
				</CardHeader>
				<CardHeader
					icon="refresh pink"
					title={__('Reset VuloPilot', 'vulopilot')}
					desc={__(
						'Restore VuloPilot settings to their original defaults. Your existing scan reports and history will not be deleted.',
						'vulopilot'
					)}
				>
					<ButtonInput
						buttons={{
							text: isResetting
								? __('Resetting…', 'vulopilot')
								: __('Reset settings', 'vulopilot'),
							icon: 'refresh',
							onClick: handleResetSettings,
							disabled: isResetting,
						}}
					/>
				</CardHeader>
			</FormGroupWrapperComponent>
			<FormGroupWrapperComponent className="danger-zone">
				<h3 className="danger-zone-title">{__('Danger Zone', 'vulopilot')}</h3>
				<CardHeader
					icon="setting pink"
					title={__('Keep VuloPilot data after uninstall', 'vulopilot')}
					desc={__(
						"Choose what happens to VuloPilot's settings and saved data if the plugin is removed. 1. Keep data - Your settings, scan history, and reports remain available if you reinstall VuloPilot. 2. Delete everything - Permanently removes VuloPilot settings and stored data when the plugin is uninstalled.",
						'vulopilot'
					)}
				>
					<ToggleInput
						value={keepDataUninstall}
						modules={[]}
						options={[
							{ key: 'keep_data', label: __('Keep data', 'vulopilot'), value: 'keep_data' },
							{ key: 'delete_everything', label: __('Delete everything', 'vulopilot'), value: 'delete_everything' },
						]}
						onChange={(value) =>
							handleSettingChange('keep_data_uninstall', value as string)
						}
					/>
				</CardHeader>
			</FormGroupWrapperComponent>
		</>
	);
};

export default DeveloperToolsPanel;
