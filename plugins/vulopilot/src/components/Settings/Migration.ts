import { __ } from '@wordpress/i18n';

/**
 * `id`/`priority`/`headerTitle`/`headerIcon` are read by NavigatorComponent to list the tab and
 * route to it. Settings.tsx's own 'migration' escape hatch renders MigrationPanel instead of the
 * InputRenderer form this entry would otherwise produce - same pattern as DeveloperTools.ts.
 */
export default {
	id: 'migration',
	priority: 10,
	headerTitle: __('Migration', 'vulopilot'),
	headerDescription: __(
		'Import SEO data from another SEO plugin into VuloPilot.',
		'vulopilot'
	),
	headerIcon: 'import',
	submitUrl: 'migration',
	modal: [],
};
