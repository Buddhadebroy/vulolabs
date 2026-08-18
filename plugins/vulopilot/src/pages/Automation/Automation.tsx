import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation, Link } from 'react-router-dom';
import {
	NavigatorComponent,
	NavigatorHeaderComponent,
} from '@zyra/components';
import AutomationOverviewTab from './AutomationOverviewTab';
import ManageAutomationsSection from './ManageAutomationsSection';
import './AutomateWork.scss';

const TAB_IDS = ['overview', 'automations'] as const;

const TAB_META: Record<
	(typeof TAB_IDS)[number],
	{ headerTitle: string; headerIcon: string }
> = {
	overview: { headerTitle: __('Overview', 'vulopilot'), headerIcon: 'bar-chart' },
	automations: { headerTitle: __('Automations', 'vulopilot'), headerIcon: 'automation' },
};

/**
 * "Automate Work" — a tab shell over two views. Tab bar/body are
 * `NavigatorComponent` (`variant="tab"`) rather than a bare `TabsComponent`
 * — same real settings-navigator AIAssistant.tsx's/Reports.tsx's own tab
 * shells already use. "Overview" (AutomationOverviewTab.tsx) is the new
 * dashboard-style view merging the latest mockup with this page's real
 * cards; "Automations" is today's real list/create/enable/run management
 * UI (ManageAutomationsSection.tsx, unchanged, just given its own tab
 * instead of sitting at the bottom of one long page). Restores the
 * two-tab shape this page briefly moved away from for its previous
 * single-page rebuild — the new mockup itself shows an "Overview"/
 * "Automations" tab bar, so this isn't a new pattern, it's this page
 * catching back up to it.
 *
 * `headerTitle`/`headerDescription` are deliberately left unset on
 * `NavigatorComponent` — this page's own `NavigatorHeaderComponent` above
 * already renders the page header, and passing them here would render a
 * second, duplicate one. Each tab's `hideSettingHeader: true` suppresses
 * `NavigatorComponent`'s own per-tab title/description section, since
 * `AutomationOverviewTab`/`ManageAutomationsSection` already render their
 * own. `activeTab`'s setter is still needed (unlike Reports.tsx's own
 * conversion) — `AutomationOverviewTab`'s "Manage automations" action
 * jumps to the Automations tab programmatically via `goToAutomationsTab`,
 * same cross-tab-trigger case AIAssistant.tsx's own `goToTab` handles.
 */
const Automation = () => {
	const hashParams = new URLSearchParams(useLocation().hash.substring(1));
	const subtab = hashParams.get('subtab');
	const initialTab = (
		subtab && (TAB_IDS as readonly string[]).includes(subtab)
			? subtab
			: 'overview'
	) as (typeof TAB_IDS)[number];

	const [activeTab, setActiveTab] = useState<(typeof TAB_IDS)[number]>(
		initialTab
	);

	// AI Copilot's Chat tab (ChatTab.tsx's own AutomationTemplatesCard
	// preview) deep-links here as `&automation_template=<id>` — same
	// `subtab=` URL-param routing convention this file already reads
	// above, extended one param further. `useState` initializer only reads
	// it once (on mount); ManageAutomationsSection.tsx reads it from here
	// via a prop rather than re-parsing the URL itself.
	const [initialAutomationTemplateId] = useState<string | null>(() =>
		hashParams.get('automation_template')
	);

	const goToAutomationsTab = () => setActiveTab('automations');

	const settingContent = TAB_IDS.map((tabId) => ({
		type: 'file' as const,
		content: {
			id: tabId,
			headerTitle: TAB_META[tabId].headerTitle,
			headerIcon: TAB_META[tabId].headerIcon,
			hideSettingHeader: true,
		},
	}));

	const getForm = (tabId: string) => {
		switch (tabId) {
			case 'overview':
				return (
					<AutomationOverviewTab
						onManageAutomations={goToAutomationsTab}
					/>
				);
			case 'automations':
				return (
					<ManageAutomationsSection
						initialTemplateId={initialAutomationTemplateId}
					/>
				);
			default:
				return <div></div>;
		}
	};

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="automation"
				headerTitle={__('Automate Work', 'vulopilot')}
				headerDescription={__(
					'Let AI continuously improve your website while you focus on growing your business.',
					'vulopilot'
				)}
			/>
			<NavigatorComponent
				className="automate-work-tabs"
				settingContent={settingContent}
				currentSetting={activeTab}
				getForm={getForm}
				prepareUrl={(subTab: string) =>
					`?page=vulopilot#&tab=automation&subtab=${subTab}`
				}
				Link={Link}
				variant="tab"
			/>
		</>
	);
};

export default Automation;
