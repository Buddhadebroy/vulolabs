import { ModuleGridComponent, FormGroupComponent, FormGroupWrapperComponent } from '@zyra/components';
import { getModuleData } from '../../services/templateService';
import proPopupContent from '../Popup/Popup';

const ModulesPanel = () => {
	const modulesArray = getModuleData();

	return (
		<FormGroupWrapperComponent>
			<FormGroupComponent>
				<ModuleGridComponent
					modulesArray={modulesArray}
					apiLink="modules"
					pluginName="vulopilot"
					proPopupContent={proPopupContent}
				/>
			</FormGroupComponent>
		</FormGroupWrapperComponent>
	);
};

export default ModulesPanel;
