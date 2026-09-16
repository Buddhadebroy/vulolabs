/* global appLocalizer */
import { useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import {
	FormGroupComponent,
	FormGroupWrapperComponent,
	NoticeComponent,
} from '@zyra/components';
import { TextInput, TextAreaInput } from '@zyra/inputs';
import { useSetting } from '../../../contexts/SettingContext';
import { SectionRow } from './ConnectionsPanel';
import PageSpeedStatusPanel from './PageSpeedStatusPanel';

const AUTOSAVE_DEBOUNCE_MS = 1000;

/**
 * Settings → Get Started → Business Information's own "Preferences"
 * section — the one real field (`site_tone`) that used to render on the
 * Connections sub-tab (ConnectionsPanel.tsx's own former docblock), moved
 * here per direct instruction ("move image 1 settings before image 2
 * settings" — the Preferences/PageSpeed Insights sections, onto this tab,
 * above its own "Business" section). Same debounced-autosave idiom as
 * PageSpeedStatusPanel.tsx's own API Key/Daily Limit fields (and
 * TitleFormatsPanel.tsx before it) — "stop typing, then save," not an
 * explicit Save button.
 */
const PreferencesSection = () => {
	const { setting, updateSetting } = useSetting();
	const [siteTone, setSiteTone] = useState((setting.site_tone as string) || '');
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const handleSiteToneChange = (value: string) => {
		setSiteTone(value);

		if (saveTimerRef.current) {
			clearTimeout(saveTimerRef.current);
		}
		saveTimerRef.current = setTimeout(() => {
			updateSetting('site_tone', value);
			sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'settings'), {
				setting: { site_tone: value },
			});
		}, AUTOSAVE_DEBOUNCE_MS);
	};

	return (
		<FormGroupWrapperComponent>
			<FormGroupComponent
				label={__('Site tone', 'vulopilot')}
				desc={__(
					'A short description of how this site should sound (e.g. "Friendly and casual" or "Formal and technical") — included with every AI request.',
					'vulopilot'
				)}
				htmlFor="site-tone-input"
			>
				<TextInput
					id="site-tone-input"
					size={30}
					value={siteTone}
					placeholder={__('e.g. Friendly and casual', 'vulopilot')}
					onChange={(value) => handleSiteToneChange(String(value))}
				/>
			</FormGroupComponent>
		</FormGroupWrapperComponent>
	);
};

/**
 * Settings → Get Started → Business Information's own "Business" section
 * — a hand-built `SectionRow` (same real fields the old declarative
 * `BusinessInformation.ts` `modal` array rendered via InputRenderer)
 * rather than a `type: 'section'`/`type: 'text'`/`type: 'textarea'`
 * config, since a tab's `PanelComponent` (needed for Preferences/PageSpeed
 * above) renders in place of InputRenderer entirely, not alongside it
 * (Settings.tsx's own `GetForm()`) — same debounced-autosave idiom as
 * `PreferencesSection` above, one real key per field, no separate "Save"
 * button.
 */
const BusinessSection = () => {
	const { setting, updateSetting } = useSetting();
	const [businessType, setBusinessType] = useState(
		(setting.entity_business_type as string) || ''
	);
	const [servicePages, setServicePages] = useState(
		(setting.entity_service_pages as string) || ''
	);
	const [businessLocations, setBusinessLocations] = useState(
		(setting.entity_business_locations as string) || ''
	);
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const scheduleSave = (key: string, value: string) => {
		if (saveTimerRef.current) {
			clearTimeout(saveTimerRef.current);
		}
		saveTimerRef.current = setTimeout(() => {
			updateSetting(key, value);
			sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'settings'), {
				setting: { [key]: value },
			});
		}, AUTOSAVE_DEBOUNCE_MS);
	};

	return (
		<FormGroupWrapperComponent>
			<FormGroupComponent
				label={__('Business type', 'vulopilot')}
				desc={__(
					'e.g. Software Company, Online Store, Consulting Agency.',
					'vulopilot'
				)}
				htmlFor="entity-business-type-input"
			>
				<TextInput
					id="entity-business-type-input"
					value={businessType}
					onChange={(value) => {
						setBusinessType(String(value));
						scheduleSave('entity_business_type', String(value));
					}}
				/>
			</FormGroupComponent>
			<FormGroupComponent
				label={__('Service pages', 'vulopilot')}
				desc={__(
					'e.g. https://example.com/consulting/ or just the page ID.',
					'vulopilot'
				)}
				htmlFor="entity-service-pages-input"
			>
				<TextAreaInput
					id="entity-service-pages-input"
					value={servicePages}
					onChange={(value) => {
						setServicePages(String(value));
						scheduleSave('entity_service_pages', String(value));
					}}
				/>
			</FormGroupComponent>
			<FormGroupComponent
				label={__('Business locations', 'vulopilot')}
				desc={__(
					'e.g. Downtown Store | 123 Main St, Springfield.',
					'vulopilot'
				)}
				htmlFor="entity-business-locations-input"
			>
				<TextAreaInput
					id="entity-business-locations-input"
					value={businessLocations}
					onChange={(value) => {
						setBusinessLocations(String(value));
						scheduleSave('entity_business_locations', String(value));
					}}
				/>
			</FormGroupComponent>
			{/* Not a real, independently-writable field here — the actual
			enable/threshold live in the real, single nested
			`visibility_alerts.kg` setting (Utill::VULOPILOT_SETTINGS_DEFAULTS),
			edited on its own dedicated Notifications tab instead. Same real
			`type: 'notice'`-pointing-elsewhere reasoning the old declarative
			`kg-health-drop-threshold-note` field already documented. */}
			<NoticeComponent
				displayPosition="inline-notice"
				type="info"
				message={__(
					'Knowledge Graph Health drop alerts (and their threshold) are configured under <a href="?page=vulopilot#&tab=settings&subtab=visibility-alerts">Notifications → Visibility Alerts</a>.',
					'vulopilot'
				)}
			/>
		</FormGroupWrapperComponent>
	);
};

/**
 * Settings → Get Started → Business Information.
 *
 * A real, hand-built `PanelComponent` (like ConnectionsPanel.tsx) rather
 * than InputRenderer's own declarative `modal`, so "Preferences"
 * (`site_tone`) and "PageSpeed Insights" (PageSpeedStatusPanel.tsx) — both
 * moved here from the Connections sub-tab per direct instruction ("move
 * image 1 settings before image 2 settings") — can render above this
 * tab's own real "Business" section (`BusinessSection` above), a
 * `PanelComponent` and InputRenderer's own `modal` never render together
 * (Settings.tsx's own `GetForm()`).
 *
 * `BusinessInformation.ts`'s own `modal` array still lists every real flat
 * key every section below reads/writes (`site_tone`, `psi_api_key`/
 * `psi_daily_limit`, `entity_business_type`/`entity_service_pages`/
 * `entity_business_locations`) purely so Settings.tsx's own per-tab
 * seeding logic (`fieldKeys` from `modal[].key`) populates SettingContext
 * with their current values before these components mount and read them
 * via `useSetting()` — same role every other `PanelComponent` tab's own
 * `modal` array already plays.
 */
const BusinessInformationPanel = () => {
	return (
		<>
			<SectionRow
				icon="ai"
				title={__('Preferences', 'vulopilot')}
				desc={__(
					'Controls how VuloPilot’s AI features sound when writing or rewriting your content.',
					'vulopilot'
				)}
			>
				<PreferencesSection />
			</SectionRow>
			<PageSpeedStatusPanel />
			<SectionRow
				icon="category"
				title={__('Business', 'vulopilot')}
				desc={__(
					'What kind of business this is — shown on the Business Profile card, not written into any structured data.',
					'vulopilot'
				)}
			>
				<BusinessSection />
			</SectionRow>
		</>
	);
};

export default BusinessInformationPanel;
