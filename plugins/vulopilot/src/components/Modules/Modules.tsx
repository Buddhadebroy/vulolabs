import { __ } from '@wordpress/i18n';
import {
	ContainerComponent,
	ModuleGridComponent,
	NavigatorHeaderComponent,
	FormGroupWrapperComponent
} from '@zyra/components';
import { getModuleData } from '../../services/templateService';
import proPopupContent from '../Popup/Popup';

/**
 * No longer reachable — its own route (`tab: 'modules'`, src/routes.ts)
 * was removed per direct instruction once every real deep-link to it
 * (Popup.tsx's "Enable Now", AiCopilotGuard.tsx, GettingStartedCard.tsx,
 * searchIndex.ts's own module search results) had been repointed at the
 * real current home instead, Settings → Modules
 * (components/Settings/ModulesPanel.tsx, same real `getModuleData()`/
 * `ModuleGridComponent` this file still renders below). Kept in place
 * unwired rather than deleted, same "supersede, don't delete" posture
 * this codebase already applies elsewhere (e.g. AISuggestionsWidget.tsx/
 * TodaysTasksWidget.tsx, dashboard-widgets/registry.ts's own docblock).
 *
 * Mirrors the free vulolabs plugin's own
 * `components/Modules/Modules.tsx` exactly — same
 * NavigatorHeaderComponent + ContainerComponent + zyra's shared
 * `ModuleGridComponent`, which already renders the mockup's whole shape
 * (search box, category pill bar sourced from ./index.ts's own
 * `{type:'separator'}` entries, card grid, free/pro feature lists, toggle
 * switch) on its own — it also owns the enable/disable REST round-trip
 * (apiLink="modules", see Controllers\Settings::set_modules()/
 * get_modules()), search, and category filtering internally (confirmed by
 * reading its real source via its own shipped sourcemap — it takes no
 * `appLocalizer` prop at all, reading khali_dabba/module state via zyra's
 * own ZyraVariable/zustand store instead, already configured once at this
 * plugin's own bootstrap). See ./index.ts's own docblock for why every
 * card's `id` has to be a real backend module id, not display text.
 */
const Modules = () => {
	const modulesArray = getModuleData();

	return (
		<>
			<ModuleGridComponent
				modulesArray={modulesArray}
				apiLink="modules"
				pluginName="vulopilot"
				proPopupContent={proPopupContent}
			/>
		</>
	);
};

export default Modules;
