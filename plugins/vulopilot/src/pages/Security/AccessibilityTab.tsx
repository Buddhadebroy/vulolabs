/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	PopupComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import ShowProPopup from '../../components/Popup/Popup';
import { useFilterSlot } from '../../services/useFilterSlot';
import SectionedIssuesTable, {
	SectionedIssuesTab,
} from './SectionedIssuesTable';
import PluginOverlapCard from './PluginOverlapCard';
import AccessibilityHeroCard from './AccessibilityHeroCard';
import AccessibilityChecksGrid from './AccessibilityChecksGrid';
import AccessibilityPriorityList from './AccessibilityPriorityList';
import AccessibilityManualTestingPanel from './AccessibilityManualTestingPanel';
import AccessibilityWcagNotice from './AccessibilityWcagNotice';
import { ACCESSIBILITY_CHECKS } from './accessibilityChecks';

/** Anchor id "Review Important Issues"/the empty state scroll to. */
const PRIORITY_LIST_ID = 'protect-my-site-a11y-priority';
/** DOM anchor id the merged issues table below carries. */
const ISSUES_TABLE_ID = 'protect-my-site-a11y-issues-table';

const scrollTo = (id: string) => () =>
	document
		.getElementById(id)
		?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/**
 * Visible teaser for the dashboard-stats slot above — shown instead of it
 * when `AccessibilityDashboardCard` isn't registered (the real
 * `accessibility-audits` module inactive), so the feature is discoverable
 * rather than simply absent. Previously both this and
 * AccessibilityHistoryLockedCard rendered `{Slot && <Slot />}` with no
 * fallback at all — the exact "Pro content silently invisible" bug class
 * already fixed this session for WooCommerce's Bulk AI/Store Intelligence
 * panels and the Automation panel. Unlike those two WooCommerce modules,
 * `accessibility-audits` has a real, normal toggle card on the Modules
 * page (src/components/Modules/index.ts), so — same pattern
 * FindingsTable.tsx's own Pro popup already uses — "Enable Now" can safely
 * deep-link to it by real module id when Pro is active.
 */
const AccessibilityDashboardLockedCard = () => {
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);

	return (
		<>
			<CardComponent
				title={__('Accessibility Dashboard', 'vulopilot')}
				desc={__(
					'A real severity breakdown, your last scan time, and your scheduled scan frequency.',
					'vulopilot'
				)}
			>
				<ButtonInput
					buttons={{
						text: __('Unlock with Pro', 'vulopilot'),
						icon: 'lock',
						onClick: () => setIsProPopupOpen(true),
					}}
				/>
			</CardComponent>
			<PopupComponent
				open={isProPopupOpen}
				onClose={() => setIsProPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{appLocalizer.khali_dabba ? (
					<ShowProPopup moduleName="accessibility-audits" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</>
	);
};

/**
 * Visible teaser for the history-trend slot above — same fix as
 * AccessibilityDashboardLockedCard above.
 */
const AccessibilityHistoryLockedCard = () => {
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);

	return (
		<>
			<CardComponent
				title={__('Accessibility Score History', 'vulopilot')}
				desc={__(
					'Real historical accessibility score trend over time, so you can see whether things are actually improving.',
					'vulopilot'
				)}
			>
				<ButtonInput
					buttons={{
						text: __('Unlock with Pro', 'vulopilot'),
						icon: 'lock',
						onClick: () => setIsProPopupOpen(true),
					}}
				/>
			</CardComponent>
			<PopupComponent
				open={isProPopupOpen}
				onClose={() => setIsProPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{appLocalizer.khali_dabba ? (
					<ShowProPopup moduleName="accessibility-audits" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</>
	);
};

/**
 * "Accessibility" tab of "Protect My Site" — rebuilt to match the
 * reference mockup: hero card (real score + real open-issue/high-
 * priority/pages-affected counts) side by side (grid={8}/grid={4}, per
 * direct instruction) with the "Accessibility Checks" 5-tile grid, then
 * "What should I fix first?" (the 3 highest-risk open findings), a
 * Pro dashboard-stats slot, the "Some accessibility checks need a person"
 * manual-testing panel, a WCAG scope notice, then one real, unified
 * issues table (SectionedIssuesTable.tsx, same merge pattern WooCommerce's
 * own "All WooCommerce Issues" already established) — replacing what used
 * to be 5 separate `layout="compact"` FindingsTable cards (one per
 * ACCESSIBILITY_CHECKS bucket) plus a 6th, separately-rendered "All
 * Accessibility Findings" combined section: that combined section is now
 * just the merged table's own built-in "All" tab, so it no longer needs
 * its own card.
 *
 * The two Pro slots (dashboard-stats, history-trend) now render a real
 * locked-state teaser (AccessibilityDashboardLockedCard/
 * AccessibilityHistoryLockedCard) instead of nothing when
 * `accessibility-audits` isn't active — previously `{Slot && <Slot />}`
 * left this tab's richest content silently invisible with no way to
 * discover it existed at all. Both slots are read via `useFilterSlot()`,
 * not a one-time module-scope `applyFilters()` call — Pro's own
 * `addFilter()` registration always runs strictly after this component's
 * first render on a fresh page load (a script-loading race, not a logic
 * bug — see useFilterSlot.ts's own docblock), so a one-time read would
 * permanently miss it and show the locked teaser even with the module
 * genuinely active. Same fix already applied this session to
 * WooCommerceTab.tsx's two panel slots and ManageAutomationsSection.tsx's
 * one.
 *
 * Closes with PluginOverlapCard filtered to `category="accessibility"` —
 * promotes the same real cross-sell FilesPluginsTab.tsx introduced (e.g.
 * WP Accessibility active → VuloPilot's own Accessibility Guard) into the
 * tab a user reading about accessibility is already on.
 */
const AccessibilityTab = () => {
	const [activeTab, setActiveTab] = useState<SectionedIssuesTab>('all');
	const AccessibilityDashboardCard = useFilterSlot(
		'vulopilot_accessibility_dashboard_card'
	);
	const AccessibilityHistoryPanel = useFilterSlot(
		'vulopilot_accessibility_history_panel'
	);

	const goToIssuesTable = (tab: SectionedIssuesTab) => {
		setActiveTab(tab);
		setTimeout(
			() =>
				document
					.getElementById(ISSUES_TABLE_ID)
					?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
			50
		);
	};

	return (
		<ContainerComponent>
			<ColumnComponent>
				<ContainerComponent>
					<ColumnComponent grid={8}>
						<AccessibilityChecksGrid onReview={goToIssuesTable} />
					</ColumnComponent>
					<ColumnComponent grid={4}>
						<AccessibilityHeroCard
							onReviewIssues={scrollTo(PRIORITY_LIST_ID)}
							onViewAll={() => goToIssuesTable('all')}
						/>
					</ColumnComponent>
				</ContainerComponent>
				{AccessibilityDashboardCard ? (
					<AccessibilityDashboardCard />
				) : (
					<AccessibilityDashboardLockedCard />
				)}
				<AccessibilityPriorityList
					id={PRIORITY_LIST_ID}
					onViewAll={() => goToIssuesTable('all')}
					onReviewCheck={goToIssuesTable}
				/>
				<AccessibilityManualTestingPanel />
				<AccessibilityWcagNotice />
				<SectionedIssuesTable
					id={ISSUES_TABLE_ID}
					title={__('All Accessibility Findings', 'vulopilot')}
					sections={ACCESSIBILITY_CHECKS}
					activeTab={activeTab}
					onTabChange={setActiveTab}
				/>
				{AccessibilityHistoryPanel ? (
					<AccessibilityHistoryPanel />
				) : (
					<AccessibilityHistoryLockedCard />
				)}
				<PluginOverlapCard category="accessibility" />
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default AccessibilityTab;
