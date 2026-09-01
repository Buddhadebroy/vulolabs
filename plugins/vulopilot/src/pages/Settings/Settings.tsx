/* global appLocalizer */
import React, { useEffect, useRef, useState, JSX } from 'react';
import { __ } from '@wordpress/i18n';
import './Settings.scss';
import { useLocation, Link } from 'react-router-dom';
import { getApiLink, getApiResponse } from '@zyra/core';
import { getAvailableSettings, getSettingById } from '@zyra/core';
import { InputRenderer } from '@zyra/inputs';
import { CardComponent, ModuleGuardComponent, NavigatorComponent } from '@zyra/components';
import { SettingProvider, useSetting } from '../../contexts/SettingContext';
import getTemplateData from '../../services/templateService';
import ModulesPanel from '../../components/Settings/ModulesPanel';
import DeveloperToolsPanel from '../../components/Settings/DeveloperToolsPanel';
import BackupStoragePanel from '../../components/Settings/BackupStoragePanel';
import PageSpeedStatusPanel from '../../components/Settings/Connections/PageSpeedStatusPanel';
import IndexNowPanel from '../../components/Settings/Scanning/IndexNowPanel';
import ShowProPopup from '../../components/Popup/Popup';

/**
 * Built on zyra's real settings framework (`InputRenderer`/
 * `NavigatorComponent`, `getAvailableSettings`/`getSettingById` from
 * @zyra/core) — the same one the free vulolabs plugin's own
 * components/Settings/Settings.tsx uses, replacing this page's previous
 * hand-built form. Tab configs live under ../../components/Settings/*.ts
 * as plain declarative objects (react-frontend.md's business-hours.ts
 * pattern), auto-discovered by templateService.ts's `require.context`.
 *
 * VuloPilot's settings are one flat wp_options row, not per-tab
 * namespaced data — unlike vulolabs's `appLocalizer.admin_settings`,
 * so this page fetches the full flat object once and, per tab, seeds
 * `SettingContext` with just that tab's own field keys (looked up from
 * the tab's own `modal[].key` list) and merges live edits back into a
 * ref so switching tabs and back doesn't lose unsaved-but-in-flight
 * edits. Each field then auto-saves itself via InputRenderer's own
 * built-in debounce, POSTing `{ setting, settingName }` — Controllers\Settings's
 * `update_item()` merges that subset into the stored option rather than
 * replacing it wholesale.
 *
 * The 'import-export' tab is a "special component" escape hatch (same
 * one vulolabs's Settings.tsx uses for StoreStatus/Invoice/etc.) —
 * file download/upload and a destructive reset don't fit the per-field
 * auto-save model, so that one tab id renders ImportExportPanel instead
 * of InputRenderer. 'modules' is the same escape hatch, added per direct
 * instruction ("move the modules tab in settings after general tab") —
 * real enable/disable toggles, not persisted fields, so it renders
 * ModulesPanel.tsx instead; see Modules.ts's own docblock for where its
 * content used to live.
 */
const Settings = () => {
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const settingsRef = useRef<Record<string, unknown>>({});

	const settingsArray = getAvailableSettings(getTemplateData('settings'), []);
	const location = new URLSearchParams(useLocation().hash.substring(1));

	const loadSettings = () => {
		setIsLoading(true);
		setError(null);

		getApiResponse<Record<string, unknown>>(
			getApiLink(appLocalizer, 'settings'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
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
		// Every hook this function uses must run on every call regardless
		// of $currentTab — an early `return null` before useEffect() (the
		// original shape this was ported from also has this same latent
		// issue) makes the number of hooks React sees differ between the
		// render where NavigatorComponent hasn't picked a subtab yet
		// (currentTab === null) and the one right after it does, which is
		// exactly React error #310 ("rendered fewer hooks than expected").
		const { setting, settingName, setSetting, updateSetting } = useSetting();

		const settingModal = currentTab ? getSettingById(settingsArray, currentTab) : null;
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
			if (currentTab && settingName === currentTab) {
				settingsRef.current = { ...settingsRef.current, ...setting };
			}
		}, [setting, settingName, currentTab]);

		if (!currentTab) {
			return null;
		}

		// Modules tab — real enable/disable toggles (ModuleGridComponent's
		// own `apiLink="modules"` round-trip), not persisted-field settings
		// — same escape hatch as the generic `PanelComponent` case below
		// (AI Providers/Licensing use that one instead since their config
		// lives outside this plugin's own hardcoded tab ids). Moved here
		// from a standalone top-level page per direct instruction ("move
		// the modules tab in settings after general tab") — see Modules.ts's
		// own docblock.
		if (currentTab === 'modules') {
			return <ModulesPanel />;
		}

		// Instant Indexing tab's "Submit URLs"/"History" cards are real
		// actions/logs, not persisted-field settings — same escape hatch as
		// 'modules' above (see InstantIndexing.ts's own docblock).
		if (currentTab === 'indexnow') {
			return <IndexNowPanel />;
		}

		// Developer Tools' "Clear cache" is a real action, not a
		// persisted field — same escape hatch as 'indexnow' above.
		if (currentTab === 'developer-tools') {
			return <DeveloperToolsPanel />;
		}

		// Generic version of the three escape hatches above — Connections/
		// AiProviders.ts and Connections/GoogleServices.ts (real OAuth/
		// credential flows, same reasoning as 'indexnow' above) carry
		// their own `PanelComponent` this way instead of a hardcoded
		// `currentTab === '...'` case, the same mechanism vulopilot-pro's
		// Licensing tab already relies on since it's registered into
		// settingsArray via the `vulopilot_settings_context` filter
		// (templateService.ts) rather than a file under this plugin's own
		// components/Settings/ — Free can't hardcode a
		// `currentTab === 'licensing'` case without importing something
		// Pro-specific, so any tab config may carry its own
		// `PanelComponent` and have it rendered here in place of
		// InputRenderer instead, resolved from the config object itself
		// rather than the tab id.
		if (settingModal?.PanelComponent) {
			const PanelComponent = settingModal.PanelComponent;
			return <PanelComponent />;
		}

		return (
			<>
				{settingName === currentTab ? (
					<>
						{'pagespeed-insights' === currentTab && <PageSpeedStatusPanel />}
						{/* `settingModal` is `getSettingById(settingsArray, currentTab)`
						 * (line ~93) — real `null` for a `currentTab` that doesn't
						 * match any entry in `settingsArray` (a stale/unknown
						 * `subtab=` URL param, or a tab gated behind a module
						 * that's since been deactivated). `InputRenderer` itself
						 * unconditionally destructures its own `settings` prop
						 * (zyra's own InputRenderer.tsx) and crashes the whole
						 * page rather than degrading, so this has to stay guarded
						 * here rather than just passing `settingModal` through. */}
						{settingModal ? (
							<InputRenderer
								settings={settingModal}
								setting={setting}
								updateSetting={updateSetting}
								Popup={ShowProPopup}
							/>
						) : (
							<ModuleGuardComponent
								icon="error"
								title={__('This settings section isn’t available', 'vulopilot')}
								desc={__(
									'The tab you linked to doesn’t exist, or the module it belongs to is turned off.',
									'vulopilot'
								)}
							/>
						)}
						{/* BackupStoragePanel.tsx — appended AFTER this
						 * tab's own fields, since S3/Google Drive credentials
						 * only make sense once `backup_storage_destination`
						 * itself has already been picked, the last
						 * field this tab's own `modal` renders. See
						 * Backups.ts's own docblock for why the
						 * credentials themselves can't just be more
						 * fields in that same array. */}
						{'backups' === currentTab && <BackupStoragePanel />}
						{/* AI Crawler Alerts' own "Send Test Alert" button
						 * (CrawlerAlertTestPanel.tsx) is NOT appended here
						 * — unlike Backups above, it's wired straight into
						 * AiCrawlerAlerts.ts's own "Notification channels"
						 * `type: 'section'` field via SectionComponent's
						 * `rightContent` slot, so InputRenderer renders it
						 * inline as part of that tab's own fields. See
						 * that file's own docblock. */}
					</>
				) : (
					<>{__('Loading…', 'vulopilot')}</>
				)}
			</>
		);
	};

	if (error) {
		return (
			<CardComponent
				title={__('Settings', 'vulopilot')}
				titleIcon="setting"
				desc={__('There was a problem loading your settings.', 'vulopilot')}
			>
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
		return <CardComponent title={__('Settings', 'vulopilot')} titleIcon="setting" isLoading />;
	}

	return (
		<SettingProvider>
			<NavigatorComponent
				settingContent={settingsArray}
				currentSetting={location.get('subtab') as string}
				getForm={GetForm}
				prepareUrl={(subTab: string) =>
					`?page=vulopilot#&tab=settings&subtab=${subTab}`
				}
				appLocalizer={appLocalizer}
				Link={Link}
				settingName={'Settings'}
				className="admin-settings"
			/>
		</SettingProvider>
	);
};

export default Settings;
