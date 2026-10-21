import { ContainerComponent, NavigatorHeaderComponent, ModuleGridComponent } from '@zyra/components';
import { __ } from '@wordpress/i18n';
import modulesConfig from '../../modules-config';

/**
 * Settings → Modules sub-tab. `hideSettingHeader: true` in `settings/Modules.ts` skips the generic tab header of
 * Settings.tsx, so this component draws its own `NavigatorHeaderComponent`.
 *
 * It uses `ModuleGridComponent`, which reads the active state from zyra's `useModules()` store (seeded by
 * `initializeModules()` in src/index.tsx) and POSTs `{ id, action }` to `apiLink` when a card is toggled
 * (classes/RestAPI/Controllers/Modules.php).
 */
const ModulesPanel = () => {
	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="module"
				headerTitle={ __( 'Modules', 'vulocart' ) }
				headerDescription={ __(
					'Enable or disable VuloCart features. Turning a module on activates its settings and REST routes; turning it off hides them.',
					'vulocart'
				) }
			/>
			<ContainerComponent general>
				<ModuleGridComponent
					modulesArray={ modulesConfig }
					apiLink="modules"
					pluginName="vulocart"
				/>
			</ContainerComponent>
		</>
	);
};

export default ModulesPanel;
