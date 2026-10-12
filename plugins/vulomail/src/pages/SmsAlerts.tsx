import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent, ContainerComponent, ModuleGuardComponent, NavigatorHeaderComponent } from '@zyra/components';
import { InputRenderer } from '@zyra/inputs';
import { SettingProvider, useSetting } from '../contexts/SettingContext';
import { notificationsSchema as schema } from '../components/Settings';
import RequiredPluginPopup from '../components/RequiredPluginPopup';
import { apiGet } from '../services/api';
import { errorMessage } from '../services/notify';
import type { Settings as StoredSettings } from '../services/types';
import { schemaValues } from './Settings';

const Form = ({ values }: { values: Record<string, unknown> }) => {
	const { setting, settingName, setSetting, updateSetting } = useSetting();

	useEffect(() => {
		setSetting(schema.id, values);
	}, []);

	if (settingName !== schema.id) {
		return null;
	}

	return (
		<InputRenderer
			settings={schema}
			setting={setting}
			updateSetting={updateSetting}
			Popup={RequiredPluginPopup}
			groupBySections={schema.groupBySections}
		/>
	);
};

/**
 * SMS Alerts: every alert and the message it sends. The same auto-saving form the
 * Settings sub-tabs use, on a screen of its own.
 */
const SmsAlerts = () => {
	const [values, setValues] = useState<Record<string, unknown> | null>(null);
	const [error, setError] = useState('');

	useEffect(() => {
		apiGet<StoredSettings>('settings')
			.then((stored) => setValues(schemaValues(schema, stored)))
			.catch((e) => setError(errorMessage(e)));
	}, []);

	let content = <CardComponent title={schema.headerTitle} titleIcon={schema.headerIcon} isLoading />;

	if (error) {
		content = (
			<CardComponent title={schema.headerTitle} titleIcon="error">
				<ModuleGuardComponent icon="error" title={__('Could not load SMS alerts', 'vulomail')} desc={error} />
			</CardComponent>
		);
	} else if (values) {
		content = (
			<SettingProvider>
				<Form values={values} />
			</SettingProvider>
		);
	}

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon={schema.headerIcon}
				headerTitle={schema.headerTitle}
				headerDescription={schema.headerDescription}
			/>
			<ContainerComponent general>
				{values && !error ? (
					<div className="settings-wrapper admin-settings vulomail-screen-form">
						<div className="tab-content">{content}</div>
					</div>
				) : (
					content
				)}
			</ContainerComponent>
		</>
	);
};

export default SmsAlerts;
