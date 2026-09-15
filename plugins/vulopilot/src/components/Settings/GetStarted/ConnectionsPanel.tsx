/* global appLocalizer */
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { FormGroupComponent, FormGroupWrapperComponent, SectionComponent } from '@zyra/components';
import { TextInput } from '@zyra/inputs';
import { useSetting } from '../../../contexts/SettingContext';
import AiProvidersPanel from './AiProvidersPanel';
import GoogleServicesPanel from './GoogleServicesPanel';
import PageSpeedStatusPanel from './PageSpeedStatusPanel';
import SiteVerificationPanel from './SiteVerificationPanel';

const AUTOSAVE_DEBOUNCE_MS = 1000;

/**
 * Settings → Get Started → Connections' own "Preferences" section — the
 * one real field (`site_tone`) the old standalone Preferences.ts tab
 * carried, small enough that it doesn't need its own Panel component file
 * the way AiProviders/GoogleServices/SiteVerification/PageSpeed each do.
 * Same debounced-autosave idiom as PageSpeedStatusPanel.tsx's own API
 * Key/Daily Limit fields (and TitleFormatsPanel.tsx before it) — "stop
 * typing, then save," not an explicit Save button.
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

/** One `SectionComponent` (left) + arbitrary content (right) row — the same real `.settings-section-group`/`.settings-left-section`/`.settings-right-section` markup/CSS InputRenderer's own `groupBySections: true` layout uses (NavigatorComponent.scss), and that BackupStoragePanel.tsx/SecurityPanel.tsx already hand-replicate for their own `PanelComponent` tabs — "section, then content," left-to-right, not a title stacked directly on top of its own fields. */
const SectionRow = ({
	icon,
	title,
	desc,
	children,
}: {
	icon: string;
	title: string;
	desc: string;
	children: ReactNode;
}) => (
	<div className="settings-section-group">
		<div className="settings-left-section">
			<SectionComponent icon={icon} title={title} desc={desc} />
		</div>
		<div className="settings-right-section">{children}</div>
	</div>
);

/**
 * Settings → Get Started → Connections.
 *
 * Merges this folder's previous 5 separate sub-tabs (AI Providers, Google
 * Services, PageSpeed Insights, Site Verification, Preferences) into this
 * one tab per direct instruction ("merge all tabs into one tab under get
 * started called connections") — each section below is the same real
 * component its own old standalone tab already used (AiProvidersPanel.tsx/
 * GoogleServicesPanel.tsx/SiteVerificationPanel.tsx unchanged;
 * PageSpeedStatusPanel.tsx extended to also render its own API Key/Daily
 * Limit fields, previously rendered separately by InputRenderer against
 * PageSpeedInsights.ts's own `modal` — see that component's own
 * docblock), just laid out on one page instead of split across five. No
 * real setting/backend changed shape; only where the UI for it lives.
 *
 * Each section is `SectionRow` above (real `.settings-section-group`
 * two-column layout — icon/title/desc on the left, that section's own
 * real component on the right), per direct instruction ("make this tab
 * design good like section then content") — replacing an earlier pass
 * that stacked a plain `CardHeader` title directly above each panel in
 * one column.
 *
 * `Connections.ts`'s own `modal` array still lists every real flat key
 * every section below reads/writes (Google Services' 4 tracking toggles,
 * PageSpeed's `psi_api_key`/`psi_daily_limit`, Site Verification's 10
 * webmaster keys, `site_tone`) purely so Settings.tsx's own per-tab
 * seeding logic (`fieldKeys` from `modal[].key`) populates SettingContext
 * with their current values before any of these components mount and
 * read them via `useSetting()` — same role every other `PanelComponent`
 * tab's own `modal` array already plays.
 */
const ConnectionsPanel = () => {
	return (
		<>
			<SectionRow
				icon="ai"
				title={__('AI Providers', 'vulopilot')}
				desc={__(
					'Configure and manage your AI provider connections. Add API keys to enable AI features across VuloPilot.',
					'vulopilot'
				)}
			>
				<AiProvidersPanel />
			</SectionRow>
			<SectionRow
				icon="search-discovery"
				title={__('Google Services', 'vulopilot')}
				desc={__(
					'Connect your Google account to allow VuloPilot to fetch real data from Google services.',
					'vulopilot'
				)}
			>
				<GoogleServicesPanel />
			</SectionRow>
			<SectionRow
				icon="analytics"
				title={__('PageSpeed Insights', 'vulopilot')}
				desc={__(
					'Connect PageSpeed Insights API to analyze your site speed, Core Web Vitals, and get actionable optimization suggestions.',
					'vulopilot'
				)}
			>
				<PageSpeedStatusPanel />
			</SectionRow>
			<SectionRow
				icon="check"
				title={__('Site Verification', 'vulopilot')}
				desc={__(
					'Verify your website ownership on different platforms. This helps VuloPilot access more data and provide better insights.',
					'vulopilot'
				)}
			>
				<SiteVerificationPanel />
			</SectionRow>
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
		</>
	);
};

export default ConnectionsPanel;
