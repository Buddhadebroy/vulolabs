/* global vulobackupAppLocalizer */
import { useLocation, Link } from 'react-router-dom';
import { NavigatorComponent } from '@zyra/components';
import schemas from '../components/Settings';

/**
 * Settings: zyra's sub-tab navigator, the same shell VuloPilot's Settings screen uses. Every change
 * is saved a moment after it is made; there is no Save button.
 */
const Settings = () => {
	const requested = new URLSearchParams(useLocation().hash.substring(1)).get('subtab');
	const current = schemas.some((schema) => schema.id === requested) ? (requested as string) : schemas[0].id;

	const getForm = (currentTab: string | null) => {
		const schema = schemas.find((item) => item.id === currentTab);

		if (!schema) {
			return null;
		}

		const Panel = schema.PanelComponent;

		// Keyed, so each sub-tab loads its own fresh copy of the settings.
		return <Panel key={schema.id} />;
	};

	return (
		<NavigatorComponent
			settingContent={schemas.map((schema) => ({ type: 'file' as const, content: schema }))}
			currentSetting={current}
			getForm={getForm}
			prepareUrl={(subTab: string) => `?page=vulobackup#&tab=settings&subtab=${subTab}`}
			appLocalizer={vulobackupAppLocalizer}
			Link={Link}
			settingName={'Settings'}
			className="admin-settings"
			menuIcon
		/>
	);
};

export default Settings;
