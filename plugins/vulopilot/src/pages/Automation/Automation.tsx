import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { Link } from 'react-router-dom';
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
const readTabFromHash = (hash: string): (typeof TAB_IDS)[number] => {
	const subtab = new URLSearchParams(hash.substring(1)).get('subtab');

	return (
		subtab && (TAB_IDS as readonly string[]).includes(subtab)
			? subtab
			: 'overview'
	) as (typeof TAB_IDS)[number];
};

const Automation = () => {
	const [activeTab, setActiveTab] = useState<(typeof TAB_IDS)[number]>(() =>
		readTabFromHash(window.location.hash)
	);

	// react-router-dom's `useLocation()` (tried first here) never actually
	// changes on a hash-only URL update in this app — confirmed live: a
	// `history.pushState`/real browser Back that only changes `subtab`
	// updates `window.location.hash` correctly but never re-renders this
	// component via `useLocation()`, so `activeTab` was permanently stuck
	// on whatever tab was showing at mount. Listening to the native
	// `popstate` event directly (Back/Forward) and reading
	// `window.location.hash` straight from the browser sidesteps
	// react-router's own location tracking for this hash-only case. A
	// plain tab-bar click already updates `activeTab` synchronously itself
	// (NavigatorComponent's own handler) and calls `history.pushState`,
	// which doesn't fire `popstate` — so this listener never fights that
	// click, it only ever has real work to do on Back/Forward.
	useEffect(() => {
		const syncFromHash = () => setActiveTab(readTabFromHash(window.location.hash));

		// 'popstate' covers Back/Forward; 'hashchange' covers a same-page
		// anchor (or any other `location.hash =`/`href =` assignment) to a
		// different `subtab` while already mounted here — neither of those
		// fires the other event.
		window.addEventListener('popstate', syncFromHash);
		window.addEventListener('hashchange', syncFromHash);

		return () => {
			window.removeEventListener('popstate', syncFromHash);
			window.removeEventListener('hashchange', syncFromHash);
		};
	}, []);

	// AI Copilot's Chat tab (ChatTab.tsx's own AutomationTemplatesCard
	// preview) deep-links here as `&automation_template=<id>` — same
	// `subtab=` URL-param routing convention this file already reads
	// above, extended one param further. `useState` initializer only reads
	// it once (on mount); ManageAutomationsSection.tsx reads it from here
	// via a prop rather than re-parsing the URL itself.
	const [initialAutomationTemplateId] = useState<string | null>(() =>
		new URLSearchParams(window.location.hash.substring(1)).get(
			'automation_template'
		)
	);

	// Same `subtab=` URL shape NavigatorComponent's own `prepareUrl` below
	// builds — shared so a programmatic switch (goToAutomationsTab) pushes
	// the exact same URL a real tab-bar click would, not just React state.
	const prepareUrl = (subTab: string) =>
		`?page=vulopilot#&tab=automation&subtab=${subTab}`;

	// Every "Manage Automations"/"Create New Automation"/"View All
	// Automations"/etc. action throughout AutomationOverviewTab.tsx's own
	// cards routes through this one function. NavigatorComponent's own
	// tab-bar click keeps the URL in sync via `history.pushState` (its own
	// docblock) — this needs to do the same explicitly, since it changes
	// `activeTab` from *outside* that click handler; without it the address
	// bar was left showing `subtab=overview` while the Automations tab was
	// actually visible, so refreshing the page (or sharing the URL) landed
	// back on Overview, and there was no real history entry for Back to
	// return to either.
	const goToAutomationsTab = () => {
		setActiveTab('automations');
		window.history.pushState(null, '', prepareUrl('automations'));
	};

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
				prepareUrl={prepareUrl}
				Link={Link}
				variant="tab"
			/>
		</>
	);
};

export default Automation;
