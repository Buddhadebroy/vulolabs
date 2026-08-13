import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';
import { CardComponent, ColumnComponent, ContainerComponent } from '@zyra/components';
import FindingsTable from '../../components/FindingsTable';
import AccessibilityHeroCard from './AccessibilityHeroCard';
import AccessibilityChecksGrid from './AccessibilityChecksGrid';
import AccessibilityPriorityList from './AccessibilityPriorityList';
import AccessibilityManualTestingPanel from './AccessibilityManualTestingPanel';
import AccessibilityWcagNotice from './AccessibilityWcagNotice';
import { ACCESSIBILITY_CHECKS, ACCESSIBILITY_SCANNER_IDS, sectionAnchorId } from './accessibilityChecks';

/** Anchor id "Review Important Issues"/the empty state scroll to. */
const PRIORITY_LIST_ID = 'protect-my-site-a11y-priority';
/** Anchor id "View All N Findings"/"View all N findings" scroll to — the combined section appended last, below. */
const ALL_FINDINGS_ID = sectionAnchorId('all-findings');

const AccessibilityDashboardCard = applyFilters(
	'vulopilot_accessibility_dashboard_card',
	null
) as ComponentType | null;

const AccessibilityHistoryPanel = applyFilters(
	'vulopilot_accessibility_history_panel',
	null
) as ComponentType | null;

const scrollTo = (id: string) => () =>
	document
		.getElementById(id)
		?.scrollIntoView({ behavior: 'smooth', block: 'start' });

/**
 * "Accessibility" tab of "Protect My Site" — rebuilt to match the
 * reference mockup: hero card (real score + real open-issue/high-
 * priority/pages-affected counts), the "Accessibility Checks" 5-tile
 * grid, "What should I fix first?" (the 3 highest-risk open findings),
 * a Pro dashboard-stats slot (unchanged filter, same as before), the
 * "Some accessibility checks need a person" manual-testing panel, a WCAG
 * scope notice, then — appended last, same "hero/summary first, full
 * drill-down tables last" shape ClassicSecurityTab.tsx's own Security tab
 * already establishes — the detailed FindingsTable section per check
 * (ACCESSIBILITY_CHECKS.tsx's 5 buckets, same `layout="compact"` rows
 * every other section on this page uses) plus one combined "All
 * Accessibility Findings" section every tile's own scanner ids roll up
 * into, so "View All N Findings" has one real destination the way
 * Security's own "Security Findings" section already does.
 */
const AccessibilityTab = () => (
	<ContainerComponent general>
		<ColumnComponent>
			<AccessibilityHeroCard
				onReviewIssues={scrollTo(PRIORITY_LIST_ID)}
				onViewAll={scrollTo(ALL_FINDINGS_ID)}
			/>
			<AccessibilityChecksGrid />
			{AccessibilityDashboardCard && <AccessibilityDashboardCard />}
			<AccessibilityPriorityList
				id={PRIORITY_LIST_ID}
				onViewAll={scrollTo(ALL_FINDINGS_ID)}
			/>
			<AccessibilityManualTestingPanel />
			<AccessibilityWcagNotice />
			{ACCESSIBILITY_CHECKS.map((check) => (
				<CardComponent
					key={check.key}
					id={sectionAnchorId(check.key)}
					title={check.title}
					desc={check.description}
				>
					<FindingsTable
						title={check.title}
						description={check.emptyMessage}
						scannerIds={check.scannerIds}
						layout="compact"
					/>
				</CardComponent>
			))}
			<CardComponent
				id={ALL_FINDINGS_ID}
				title={__('All Accessibility Findings', 'vulopilot')}
				desc={__(
					'Every check above, combined.',
					'vulopilot'
				)}
			>
				<FindingsTable
					title={__('All Accessibility Findings', 'vulopilot')}
					description={__(
						'No accessibility findings yet — run a scan to check.',
						'vulopilot'
					)}
					scannerIds={ACCESSIBILITY_SCANNER_IDS}
					layout="compact"
				/>
			</CardComponent>
			{AccessibilityHistoryPanel && <AccessibilityHistoryPanel />}
		</ColumnComponent>
	</ContainerComponent>
);

export default AccessibilityTab;
