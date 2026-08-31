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
			{/* <NavigatorHeaderComponent
				headerIcon="module"
				headerTitle={__('Modules', 'vulopilot')}
				headerDescription={__(
					'Enable or disable optional VuloPilot features.',
					'vulopilot'
				)}
			/> */}
			<FormGroupWrapperComponent>
				<ModuleGridComponent
					modulesArray={modulesArray}
					apiLink="modules"
					pluginName="vulopilot"
					proPopupContent={proPopupContent}
				/>
			</FormGroupWrapperComponent>
		</>
	);
};

export default Modules;
