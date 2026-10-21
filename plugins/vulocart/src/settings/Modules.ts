import { __ } from '@wordpress/i18n';

/**
 * Moved inside Settings as its own subtab, same migration vulopilot's own
 * Modules.ts/ModulesPanel.tsx already made (components/Settings/Modules.ts:
 * "'modules' used to sit here too" at the top-level menu). Only
 * `id`/`priority`/`headerTitle`/`headerIcon` are actually read by
 * Settings.tsx/NavigatorComponent - the rest exists for shape-parity with
 * every other `src/settings/*.ts` tab file.
 */
export default {
	id: 'modules',
	// Last among this plugin's own first-party tabs - after Advanced's 4 -
	// same "tucked at the end" placement vulopilot's own Modules.ts (10,
	// its own highest/last priority) uses.
	priority: 9,
	headerTitle: __( 'Modules', 'vulocart' ),
	headerDescription: __(
		'Enable or disable VuloCart features. Turning a module on activates its settings and REST routes; turning it off hides them.',
		'vulocart'
	),
	hideSettingHeader: true,
	headerIcon: 'module',
	submitUrl: 'settings',
	modal: [],
};
