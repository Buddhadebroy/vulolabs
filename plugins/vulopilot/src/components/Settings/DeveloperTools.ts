import { __ } from '@wordpress/i18n';

/**
 * `id`/`priority`/`headerTitle`/`headerIcon` are read by NavigatorComponent
 * to list the tab and route to it. Settings.tsx's GetForm() special-cases
 * `currentTab === 'developer-tools'` to render DeveloperToolsPanel.tsx
 * instead of InputRenderer (the same escape hatch 'integrations'/'indexnow'
 * already use), so `modal` below is never rendered as real fields - "Clear
 * cache"/"Reset VuloPilot" are real actions, and `keep_data_uninstall`/
 * `anonymous_usage_data` are hand-rendered too (DeveloperToolsPanel.tsx's
 * own `ToggleInput` calls, moved here from General.ts per direct
 * instruction).
 *
 * `modal`'s own field `key`s are still read, though - GetForm() (Settings.tsx)
 * derives `fieldKeys` from `settingModal.modal` for every tab, `currentTab`
 * included, to seed SettingContext with that tab's own current values
 * before ever checking which tab it is. Without an entry for a key here,
 * DeveloperToolsPanel.tsx's own `useSetting()` would never see that field's
 * real stored value at all (SettingContext only ever holds what GetForm()
 * seeded it with) - same reason IndexNowPanel.tsx's own two fields
 * (`indexnow_api_key`/`indexnow_post_types`) are listed on its own sibling
 * tab config despite that tab also being hand-built.
 */
export default {
	id: 'developer-tools',
	priority: 9,
	headerTitle: __('Developer Tools', 'vulopilot'),
	headerDescription: __(
		'Diagnostics and maintenance actions for troubleshooting VuloPilot.',
		'vulopilot'
	),
	headerIcon: 'setting',
	submitUrl: 'settings',
	modal: [
		{ key: 'keep_data_uninstall', type: 'choice-toggle', label: '', options: [] },
		{ key: 'anonymous_usage_data', type: 'choice-toggle', label: '', options: [] },
	],
};
