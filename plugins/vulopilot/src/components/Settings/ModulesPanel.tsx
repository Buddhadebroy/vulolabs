import { ContainerComponent, ModuleGridComponent } from '@zyra/components';
import { getModuleData } from '../../services/templateService';
import proPopupContent from '../Popup/Popup';

/**
 * Settings → Modules tab's own body — the same real zyra
 * ModuleGridComponent the standalone Modules page (../Modules/Modules.tsx)
 * already renders (search box, category pill bar, card grid, free/pro
 * feature lists, toggle switch, and the real `apiLink="modules"`
 * enable/disable round-trip — all owned internally by that component, see
 * that file's own docblock), just without that page's own
 * NavigatorHeaderComponent: this tab's header comes from Modules.ts's own
 * `headerTitle`/`headerDescription`/`headerIcon` instead, the same way
 * every other Settings tab gets its header from NavigatorComponent reading
 * that tab's own config rather than rendering one itself (see
 * AiProvidersPanel.tsx for the same "no header inside the panel body"
 * pattern).
 */
const ModulesPanel = () => {
	const modulesArray = getModuleData();

	return (
		<ContainerComponent general>
			<ModuleGridComponent
				modulesArray={modulesArray}
				apiLink="modules"
				pluginName="vulopilot"
				proPopupContent={proPopupContent}
			/>
		</ContainerComponent>
	);
};

export default ModulesPanel;
