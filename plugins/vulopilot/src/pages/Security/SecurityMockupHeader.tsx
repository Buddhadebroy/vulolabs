import { ColumnComponent, ContainerComponent } from '@zyra/components';
import type { SectionedIssuesTab } from './SectionedIssuesTable';
import VulnerabilityHeroCard from './VulnerabilityHeroCard';
import SecurityStatusCard from './SecurityStatusCard';
import SecurityMetricsGrid from './SecurityMetricsGrid';
import LiveThreatMonitorCard from './LiveThreatMonitorCard';
import RecentActivityCard from './RecentActivityCard';
import SecurityTrendCard from './SecurityTrendCard';

interface SecurityMockupHeaderProps {
	/**
	 * DOM id of the section the hero card's "Review Issues First" button
	 * should scroll to — SecurityTab.tsx's own "Issues that need
	 * your attention" card. Kept as a prop rather than hardcoded here in
	 * case a future tab reuses this header with a different scroll
	 * target, same as it briefly did while "Old Security" also existed.
	 */
	scrollTargetId: string;
	/** Forwarded to SecurityMetricsGrid.tsx's own scanner-backed tiles' "View" buttons — switches the merged issues table below to that tile's own section. */
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onViewSection: (tab: SectionedIssuesTab) => void;
}

/**
 * The mockup's top section — "I found N security issues" (Pro's real
 * severity breakdown when licensed, Free's honest open-count fallback
 * otherwise; see VulnerabilityHeroCard's own docblock), the "What
 * VuloPilot is checking" tile grid, and the "Security Status" score gauge
 * — factored out of SecurityTab.tsx (Protect My Site's "Security"
 * tab) into its own component since a near-identical version of this
 * same top section briefly also lived on a second "Old Security" tab
 * before that tab was removed. Deliberately the exact same grid={8}/
 * grid={4} nesting OverviewTab.tsx's own hero row uses (SecurityMetricsGrid
 * *inside* the grid={8} column alongside the hero card, not full-width
 * outside it — SecurityMetricsGrid's own 2-tile grid is deliberately
 * sized for that narrower column; getting this nesting wrong once made
 * an earlier pass render 4 tiles per row here instead of the mockup's 2).
 *
 * LiveThreatMonitorCard/RecentActivityCard/SecurityTrendCard stack
 * directly below SecurityStatusCard in this same grid={4} sidebar column
 * (per direct instruction — one after another, narrow, not a separate
 * full-width 3-column row) rather than living in SecurityTab.tsx
 * as a standalone row.
 */
const SecurityMockupHeader = ({
	scrollTargetId,
	onViewSection,
}: SecurityMockupHeaderProps) => {
	const scrollToTarget = () => {
		document
			.getElementById(scrollTargetId)
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	return (
		<ContainerComponent>
			<ColumnComponent grid={8}>
				<VulnerabilityHeroCard onNavigateToSecurityTab={scrollToTarget} />
				<SecurityMetricsGrid onViewSection={onViewSection} />
			</ColumnComponent>
			<ColumnComponent grid={4}>
				<SecurityStatusCard />
				<LiveThreatMonitorCard />
				<RecentActivityCard />
				<SecurityTrendCard />
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default SecurityMockupHeader;
