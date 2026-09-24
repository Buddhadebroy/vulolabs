/* global vulopilotAppLocalizer */
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
import { formatWpDate } from '../../services/formatWpDate';
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
/** Real backend module id (Settings → Modules) - same id `vulopilot-pro`'s `modules/AccessibilityAudits` own directory name resolves to, used both for the "which module to deep-link to" popup and for resolving its real display name for the dummy card's badge below. */
const ACCESSIBILITY_MODULE_ID = 'accessibility-checks';

/** Fabricated 7-day score trend - same "obviously fake, never mistaken for a real scan result" reasoning BrandVisibilityProDummies.tsx's own `DUMMY_AUTHORITY_HISTORY` documents; no real fetch behind this, ever. */
const DUMMY_ACCESSIBILITY_SCORES = [62, 66, 65, 71, 74, 78, 82];

/** Last 7 days ending today, labeled with the site's own date format ("August 26, 2026") - same `formatWpDate()` every real trend chart's x-axis uses - instead of a generic "Day N". Noon UTC so the site-timezone shift inside `formatWpDate()` can't push a label onto the neighboring day. */
const DUMMY_ACCESSIBILITY_HISTORY = DUMMY_ACCESSIBILITY_SCORES.map(
	(score, index) => {
		const date = new Date();
		date.setDate(
			date.getDate() - (DUMMY_ACCESSIBILITY_SCORES.length - 1 - index)
		);

		return {
			date: formatWpDate(`${date.toISOString().slice(0, 10)} 12:00:00`),
			score,
		};
	}
);

/** Purely decorative on this dummy card (no real per-period fetch behind it, ever - see `DUMMY_ACCESSIBILITY_HISTORY`'s own docblock) - same real `PERIOD_OPTIONS`/`ToggleInput` "pill" shape SecurityTrendCard.tsx's own real trend chart uses, kept here only so this teaser reads as a faithful preview of what the real, unlocked card looks like. */
type PeriodDays = '7' | '30' | '90';
const PERIOD_OPTIONS = [
	{ key: '7', value: '7', label: __('7D', 'vulopilot') },
	{ key: '30', value: '30', label: __('30D', 'vulopilot') },
	{ key: '90', value: '90', label: __('90D', 'vulopilot') },
];

/**
 * `ACCESSIBILITY_CHECKS` minus its synthetic `'all'` tile -
 * SectionedIssuesTable.tsx already synthesizes its own "All" tab, so
 * passing that tile through too would render two.
 */
const ISSUES_TABLE_SECTIONS = ACCESSIBILITY_CHECKS.filter(
	(check) => 'all' !== check.key
);

/**
 * Visible teaser for the history-trend slot above, using the shared
 * blurred "Upgrade to Pro" overlay (`BlurredProContent`/
 * `UpgradeToProOverlay`, ../../components/UpgradeToProOverlay.tsx).
 * `isProInstalled` still gates which popup state opens (`ShowProPopup`'s
 * `moduleName` prop vs none), even though no badge shows that distinction
 * visually anymore.
 */
const AccessibilityHistoryDummy = () => {
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);
	const [period, setPeriod] = useState<PeriodDays>('30');
	const isProInstalled = Boolean(vulopilotAppLocalizer.khali_dabba);

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
						xKey="date"
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
 * "Accessibility" top-level page (WP menu slug `accessibility`,
 * `classes/Admin.php`'s `$submenus`). Hero card, "Accessibility Checks"
 * grid, manual-testing panel, then one unified issues table
 * (SectionedIssuesTable.tsx, imported from `../Security/` - shared across
 * several top-level pages) with a built-in "All" tab.
 *
 * Promoted to its own top-level page rather than a Modules-system entry
 * or a "Protect My Site" tab: its checks (page structure, images, forms,
 * keyboard use, readability, WCAG findings) are content-quality concepts,
 * not security ones, and it's core always-on functionality like
 * Performance/SEO & Visibility (no `modules/Accessibility/Module.php`).
 *
 * The history-trend slot (`vulopilot_accessibility_history_panel`)
 * renders a fallback teaser (AccessibilityHistoryDummy) instead of
 * nothing when `accessibility-audits` isn't active. Read via
 * `useFilterSlot()`, not a one-time `applyFilters()` call - Pro's
 * `addFilter()` registration runs after this component's first render on
 * a fresh page load, so a one-time read would permanently miss it (see
 * useFilterSlot.ts).
 *
 * The history-trend slot and WhyAccessibilityMattersCard each sit in
 * their own `ColumnComponent`, not stacked in one shared column:
 * `.admin-tag.pro-tag` is `position: absolute`, anchored to its nearest
 * `position: relative` ancestor (`.card-wrapper`) as a corner ribbon -
 * sharing a column pins the ribbon to the column's bounding box (the
 * first card) rather than the card actually rendering it. Same issue
 * KeywordsTab.tsx's `.keywords-locked` documents. PluginOverlapCard sits
 * in its own full-width row below for the same reason.
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
						label={__('Run Accessibility Audit', 'vulopilot')}
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
