/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import {
	CardComponent,
	ChartComponent,
	ColumnComponent,
	ContainerComponent,
	NavigatorHeaderComponent,
	PopupComponent,
} from '@zyra/components';
import { ToggleInput } from '@zyra/inputs';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import ShowProPopup from '../../components/Popup/Popup';
import { BlurredProContent } from '../../components/UpgradeToProOverlay';
import DummyDataNotice from '../../components/DummyDataNotice';
import { useFilterSlot } from '../../services/useFilterSlot';
import './Accessibility.scss';
import SectionedIssuesTable, {
	SectionedIssuesTab,
} from '../Security/SectionedIssuesTable';
import PluginOverlapCard from '../Security/PluginOverlapCard';
import AccessibilityHeroCard from './AccessibilityHeroCard';
import AccessibilityManualTestingPanel from './AccessibilityManualTestingPanel';
import WhyAccessibilityMattersCard from './WhyAccessibilityMattersCard';
import { ACCESSIBILITY_CHECKS } from './accessibilityChecks';

/** DOM anchor id the merged issues table below carries. */
const ISSUES_TABLE_ID = 'accessibility-a11y-issues-table';
/** Real backend module id (Settings → Modules) — same id `vulopilot-pro`'s `modules/AccessibilityAudits` own directory name resolves to, used both for the "which module to deep-link to" popup and for resolving its real display name for the dummy card's badge below. */
const ACCESSIBILITY_MODULE_ID = 'accessibility-audits';

/** Fabricated 7-day score trend — same "obviously fake, never mistaken for a real scan result" reasoning BrandVisibilityProDummies.tsx's own `DUMMY_AUTHORITY_HISTORY` documents; no real fetch behind this, ever. */
const DUMMY_ACCESSIBILITY_HISTORY = [
	{ day: __('Day 1', 'vulopilot'), score: 62 },
	{ day: __('Day 2', 'vulopilot'), score: 66 },
	{ day: __('Day 3', 'vulopilot'), score: 65 },
	{ day: __('Day 4', 'vulopilot'), score: 71 },
	{ day: __('Day 5', 'vulopilot'), score: 74 },
	{ day: __('Day 6', 'vulopilot'), score: 78 },
	{ day: __('Day 7', 'vulopilot'), score: 82 },
];

/** Purely decorative on this dummy card (no real per-period fetch behind it, ever — see `DUMMY_ACCESSIBILITY_HISTORY`'s own docblock) — same real `PERIOD_OPTIONS`/`ToggleInput` "pill" shape SecurityTrendCard.tsx's own real trend chart uses, kept here only so this teaser reads as a faithful preview of what the real, unlocked card looks like. */
type PeriodDays = '7' | '30' | '90';
const PERIOD_OPTIONS = [
	{ key: '7', value: '7', label: __('7D', 'vulopilot') },
	{ key: '30', value: '30', label: __('30D', 'vulopilot') },
	{ key: '90', value: '90', label: __('90D', 'vulopilot') },
];

/**
 * `ACCESSIBILITY_CHECKS` minus its synthetic `'all'` tile (AccessibilityChecksGrid.tsx's
 * own 6th grid tile, not a real per-scanner bucket) — SectionedIssuesTable.tsx
 * already synthesizes its own "All" tab above whatever `sections` it's
 * given (see that component's own docblock), so passing that tile through
 * too would render two.
 */
const ISSUES_TABLE_SECTIONS = ACCESSIBILITY_CHECKS.filter(
	(check) => 'all' !== check.key
);

/**
 * Visible teaser for the history-trend slot above — same real blurred
 * "Upgrade to Pro" overlay every other Pro-gated fabricated-content card
 * in this plugin uses (`BlurredProContent`/`UpgradeToProOverlay`,
 * ../../components/UpgradeToProOverlay.tsx — shared, not reimplemented
 * per file), replacing this card's former lock-icon/"Unlock with Pro"
 * button-only teaser, then a later plain click-through-div-with-no-blur
 * version. The PRO/module-name badge that used to sit above this card
 * (distinguishing "Pro not installed" from "installed, module just not
 * toggled on yet") was removed per direct instruction — `isProInstalled`
 * still gates which of those 2 real states the popup below opens to
 * (`ShowProPopup`'s own `moduleName` prop vs none), just with no badge
 * surfacing that distinction visually above the card anymore; the shared
 * overlay's own fixed "Upgrade to Pro" copy doesn't distinguish the two
 * either, same as it doesn't anywhere else it's used.
 */
const AccessibilityHistoryDummy = () => {
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);
	const [period, setPeriod] = useState<PeriodDays>('30');
	const isProInstalled = Boolean(appLocalizer.khali_dabba);

	return (
		<>
			<CardComponent
				title={__('Accessibility Score History', 'vulopilot')}
				titleIcon="analytics"
				desc={__(
					'Real historical accessibility score trend over time, so you can see whether things are actually improving.',
					'vulopilot'
				)}
				action={
					<ToggleInput
						options={PERIOD_OPTIONS}
						value={period}
						onChange={(value) => setPeriod(value as PeriodDays)}
						modules={[]}
						variant="pill"
					/>
				}
			>
				<BlurredProContent
					contentClassName="accessibility-history-dummy"
					onClick={() => setIsProPopupOpen(true)}
				>
					<ChartComponent
						type="dynamic-line"
						data={DUMMY_ACCESSIBILITY_HISTORY}
						dataKey="score"
						xKey="day"
						height={220}
						yDomain={[0, 100]}
					/>
				</BlurredProContent>
				<DummyDataNotice />
			</CardComponent>
			<PopupComponent
				open={isProPopupOpen}
				onClose={() => setIsProPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{isProInstalled ? (
					<ShowProPopup moduleName={ACCESSIBILITY_MODULE_ID} />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</>
	);
};

/**
 * "Accessibility" — VuloPilot's own top-level page (WP menu slug
 * `accessibility`, `classes/Admin.php`'s `$submenus` entry), matching the
 * reference mockup: hero card (real score + real open-issue/high-
 * priority/pages-affected counts) side by side (grid={8}/grid={4}, per
 * direct instruction) with the "Accessibility Checks" 5-tile grid, the
 * "Some accessibility checks need a person" manual-testing panel, then one
 * real, unified issues table (SectionedIssuesTable.tsx, imported from
 * `../Security/` —
 * a generic component several top-level pages share, same merge pattern
 * WooCommerce's own "All WooCommerce Issues" already established) —
 * replacing what used to be 5 separate `layout="compact"` FindingsTable
 * cards (one per ACCESSIBILITY_CHECKS bucket) plus a 6th, separately-
 * rendered "All Accessibility Findings" combined section: that combined
 * section is now just the merged table's own built-in "All" tab, so it no
 * longer needs its own card.
 *
 * "What should I fix first?" (formerly AccessibilityPriorityList.tsx) —
 * removed per direct instruction; the issues table below already covers
 * the same ground, and the file itself is deleted (no other importer). The
 * hero card's own "Review Important Issues" button now scrolls to that
 * table (`goToIssuesTable('all')`) instead of the removed panel's own
 * now-gone anchor.
 *
 * The closing WCAG scope notice (formerly AccessibilityWcagNotice.tsx) was
 * already commented out of this render and had no other importer either —
 * deleted as part of the same dead-file cleanup rather than left as an
 * unused import + a permanently-commented-out JSX line.
 *
 * Was a 4th tab inside "Protect My Site" (`pages/Security/AccessibilityTab.tsx`)
 * until moved out per direct instruction — its checks (page structure,
 * images, forms, keyboard use, readability, WCAG findings) are
 * content-quality concepts, not security/protection ones, so bundling
 * them into "Protect My Site" made that page's own architecture harder to
 * read for no real technical reason. Promoted to its own top-level page
 * the same way "Performance"/"SEO & Visibility" already are, rather than
 * a togglable Modules-system entry — like those two pages, it's core,
 * always-on functionality, not an optional feature (confirmed: no
 * `modules/Accessibility/Module.php` exists, and none of the other core
 * pages go through that loader either).
 *
 * The history-trend slot (`vulopilot_accessibility_history_panel`) renders
 * a real fallback teaser (AccessibilityHistoryDummy) instead of nothing
 * when `accessibility-audits` isn't active — previously `{Slot && <Slot
 * />}` left this page's richest content silently invisible with no way to
 * discover it existed at all. AccessibilityHistoryDummy matches
 * BrandVisibilityProDummies.tsx's own "still show the section, PRO/
 * module-name-tagged, with fabricated content behind a click-through
 * popup" convention. Read via `useFilterSlot()`, not a one-time
 * module-scope `applyFilters()` call — Pro's own `addFilter()`
 * registration always runs strictly after this component's first render
 * on a fresh page load (a script-loading race, not a logic bug — see
 * useFilterSlot.ts's own docblock), so a one-time read would permanently
 * miss it and show the fallback teaser even with the module genuinely
 * active.
 *
 * There used to be a 2nd Pro slot here (`vulopilot_accessibility_dashboard_card`,
 * a severity-breakdown/last-scan/schedule card) with its own
 * AccessibilityDashboardLockedCard teaser — both were dead code (defined,
 * never actually rendered in this component's own return) and have been
 * removed rather than wired up, per direct instruction.
 * vulopilot-pro's own AccessibilityDashboardCard.tsx (modules/
 * AccessibilityAudits) still registers that filter; nothing in Free reads
 * it anymore.
 *
 * The history-trend slot is paired grid={6}/grid={6} (50/50, per direct
 * instruction) with WhyAccessibilityMattersCard — static explainer copy,
 * not license-gated like the chart beside it, since there's no real data
 * behind those 4 points to withhold. Each now sits in its own
 * `ColumnComponent`, not stacked together in one shared column as before —
 * `.admin-tag.pro-tag` (zyra's own theme/src/common.scss) is `position:
 * absolute`, anchoring to its nearest `position: relative` ancestor
 * (`ColumnComponent`'s own `.card-wrapper` root div) as a corner ribbon; 3
 * cards sharing one column meant that ribbon anchored to the *column's*
 * bounding box — i.e. visually pinned to the first card
 * (WhyAccessibilityMattersCard) even though AccessibilityHistoryDummy was
 * the one rendering it. Splitting them into 2 columns fixes the badge back
 * onto the real card it belongs to, same reasoning KeywordsTab.tsx's own
 * `.keywords-locked` docblock documents for the identical anchor issue.
 *
 * PluginOverlapCard (`../Security/`) — real cross-sell (e.g. WP
 * Accessibility active → VuloPilot's own Accessibility Guard) — moved to
 * its own full-width row below the 2 columns above (previously stacked
 * between them in the same shared column) so it isn't caught inside either
 * column's own `position: relative` anchor.
 */
const Accessibility = () => {
	const [activeTab, setActiveTab] = useState<SectionedIssuesTab>('all');
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
		<>
			<NavigatorHeaderComponent
				headerIcon="support"
				headerTitle={__('Accessibility', 'vulopilot')}
				headerDescription={__(
					'Make sure everyone can use your website.',
					'vulopilot'
				)}
				headerCustomContent={
					<RunScanHeaderExtra
						categories={['accessibility']}
						settingsSubtab="modules"
					/>
				}
			/>
			<ContainerComponent general>
				<ColumnComponent fullHeight grid={7}>
					<AccessibilityHeroCard
						onReviewIssues={() => goToIssuesTable('all')}
					/>
				</ColumnComponent>

				<ColumnComponent fullHeight grid={5}>

					<PluginOverlapCard category="accessibility" />
					{AccessibilityHistoryPanel ? (
						<AccessibilityHistoryPanel />
					) : (
						<AccessibilityHistoryDummy />
					)}
				</ColumnComponent>

				<ColumnComponent fullHeight grid={6}>
					<WhyAccessibilityMattersCard />

				</ColumnComponent>
				<ColumnComponent fullHeight grid={6}>
					<AccessibilityManualTestingPanel />
				</ColumnComponent>
				<ColumnComponent>
					<SectionedIssuesTable
						id={ISSUES_TABLE_ID}
						title={__('All Accessibility Findings', 'vulopilot')}
						sections={ISSUES_TABLE_SECTIONS}
						activeTab={activeTab}
						onTabChange={setActiveTab}
					/>
				</ColumnComponent>
			</ContainerComponent>
		</>
	);
};

export default Accessibility;
