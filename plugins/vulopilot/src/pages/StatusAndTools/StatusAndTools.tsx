/* global appLocalizer */
import React, { useEffect, useRef, useState, JSX } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation, Link } from 'react-router-dom';

import { getApiLink, getApiResponse, getAvailableSettings, getSettingById, useModules } from '@zyra/core';
import { InputRenderer } from '@zyra/inputs';
import {
	CardComponent,
	ModuleGuardComponent,
	NavigatorComponent,
} from '@zyra/components';

import { SettingProvider, useSetting } from '../../contexts/SettingContext';
import { getTemplateData } from '../../services/templateService';
import ShowProPopup from '../../components/Popup/Popup';

const StatusAndTools: React.FC = () => {
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const settingsRef = useRef<Record<string, any>>({});

	const settingsArray = getAvailableSettings(
		getTemplateData('tools'),
		[]
	);

	const location = new URLSearchParams(
		useLocation().hash.substring(1)
	);

	const loadSettings = () => {
		setIsLoading(true);
		setError(null);

		getApiResponse<Record<string, unknown>>(
			getApiLink(appLocalizer, 'settings'),
			{
				headers: {
					'X-WP-Nonce': appLocalizer.nonce,
				},
			}
		)
			.then((response) => {
				if (!response) {
					setError(__('Could not load settings.', 'vulopilot'));
					return;
				}

				settingsRef.current = response;
			})
			.finally(() => setIsLoading(false));
	};

	useEffect(loadSettings, []);

	const GetForm = (currentTab: string | null): JSX.Element | null => {
		const {
			setting,
			settingName,
			setSetting,
			updateSetting,
		} = useSetting();

		const { modules } = useModules();

		const settingModal = currentTab
			? getSettingById(settingsArray, currentTab)
			: null;

		const fieldKeys: string[] = (settingModal?.modal ?? []).map(
			(field: { key: string }) => field.key
		);


		if (currentTab && settingName !== currentTab) {
			const tabFields: Record<string, unknown> = {};

			fieldKeys.forEach((key) => {
				tabFields[key] = settingsRef.current[key];
			});

			setSetting(currentTab, tabFields);
		}

		useEffect(() => {
			if (!currentTab || settingName !== currentTab) {
				return;
			}

			settingsRef.current = {
				...settingsRef.current,
				...setting,
			};

		}, [setting, settingName, currentTab]);

		if (!currentTab) {
			return null;
		}

		return (
			<>
				{settingName === currentTab ? (
					<InputRenderer
						settings={settingModal}
						setting={setting}
						updateSetting={updateSetting}
						proSetting={appLocalizer.pro_settings_list}
						modules={modules}
						appLocalizer={appLocalizer}
						Popup={ShowProPopup}
					/>
				) : (
					<>{__('Loading...', 'vulopilot')}</>
				)}
			</>
		);
	};

	if (error) {
		return (
			<CardComponent title={__('Status & Tools', 'vulopilot')} titleIcon="error">
				<ModuleGuardComponent
					icon="error"
					title={__('Could not load settings', 'vulopilot')}
					desc={error}
					buttonText={__('Retry', 'vulopilot')}
					onButtonClick={loadSettings}
				/>
			</CardComponent>
		);
	}

	if (isLoading) {
		return (
			<CardComponent
				title={__('Status & Tools', 'vulopilot')}
				titleIcon="tools"
				isLoading
			/>
		);
	}

	return (
		<SettingProvider>
			<NavigatorComponent
				settingContent={settingsArray}
				currentSetting={location.get('subtab') as string}
				getForm={GetForm}
				prepareUrl={(subTab: string) =>
					`?page=vulopilot#&tab=status-tools&subtab=${subTab}`
				}
				appLocalizer={appLocalizer}
				Link={Link}
				settingName="Status & Tools"
				className="admin-settings"
			/>
		</SettingProvider>
	);
};

export default StatusAndTools;