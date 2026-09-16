import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { SectionComponent } from '@zyra/components';
import AiProvidersPanel from './AiProvidersPanel';
import GoogleServicesPanel from './GoogleServicesPanel';
import SiteVerificationPanel from './SiteVerificationPanel';

/** One `SectionComponent` (left) + arbitrary content (right) row — the same real `.settings-section-group`/`.settings-left-section`/`.settings-right-section` markup/CSS InputRenderer's own `groupBySections: true` layout uses (NavigatorComponent.scss), and that BackupStoragePanel.tsx/SecurityPanel.tsx already hand-replicate for their own `PanelComponent` tabs — "section, then content," left-to-right, not a title stacked directly on top of its own fields. Exported — BusinessInformationPanel.tsx's own "Preferences"/"Business" sections reuse this same layout rather than a second copy. */
export const SectionRow = ({
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
 * GoogleServicesPanel.tsx/SiteVerificationPanel.tsx unchanged). No real
 * setting/backend changed shape; only where the UI for it lives.
 *
 * "Preferences" (`site_tone`) and "PageSpeed Insights"
 * (PageSpeedStatusPanel.tsx) moved out to BusinessInformationPanel.tsx per
 * direct instruction ("move image 1 settings before image 2 settings") —
 * both now render on the Business Information sub-tab, above its own
 * "Business" section, instead of here.
 *
 * Each remaining section is `SectionRow` above (real
 * `.settings-section-group` two-column layout — icon/title/desc on the
 * left, that section's own real component on the right), per direct
 * instruction ("make this tab design good like section then content") —
 * replacing an earlier pass that stacked a plain `CardHeader` title
 * directly above each panel in one column.
 *
 * `Connections.ts`'s own `modal` array still lists every real flat key
 * every section below reads/writes (Google Services' 4 tracking toggles,
 * Site Verification's 10 webmaster keys) purely so Settings.tsx's own
 * per-tab seeding logic (`fieldKeys` from `modal[].key`) populates
 * SettingContext with their current values before any of these
 * components mount and read them via `useSetting()` — same role every
 * other `PanelComponent` tab's own `modal` array already plays.
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
				icon="check"
				title={__('Webmaster Tools', 'vulopilot')}
				desc={__(
					'Enter verification codes for third-party webmaster tools. Each one is rendered as its own <meta> tag on every page.',
					'vulopilot'
				)}
			>
				<SiteVerificationPanel />
			</SectionRow>
		</>
	);
};

export default ConnectionsPanel;
