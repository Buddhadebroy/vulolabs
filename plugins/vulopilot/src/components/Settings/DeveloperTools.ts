import { __ } from '@wordpress/i18n';

/**
 * Only `id`/`priority`/`headerTitle`/`headerIcon` are actually used —
 * NavigatorComponent reads these to list the tab and route to it, but
 * Settings.tsx's GetForm() special-cases `currentTab === 'developer-tools'`
 * to render DeveloperToolsPanel.tsx instead of InputRenderer (the same
 * escape hatch 'ai-providers'/'indexnow' already use), so `modal` below is
 * never read — "Clear cache" is a real action, not a persisted field.
 */
export default {
	id: 'developer-tools',
	priority: 8,
	headerTitle: __('Developer Tools', 'vulopilot'),
	headerDescription: __(
		'Diagnostics and maintenance actions for troubleshooting VuloPilot.',
		'vulopilot'
	),
	headerIcon: 'settings',
	submitUrl: 'settings',
	modal: [],
};
