import { ColumnComponent, ContainerComponent } from '@zyra/components';
import VulnerabilityHeroCard from './VulnerabilityHeroCard';
import SecurityStatusCard from './SecurityStatusCard';
import SecurityMetricsGrid from './SecurityMetricsGrid';

interface SecurityMockupHeaderProps {
	/**
	 * DOM id of the section the hero card's "Review Issues First" button
	 * should scroll to — ClassicSecurityTab.tsx's own "Issues that need
	 * your attention" card. Kept as a prop rather than hardcoded here in
	 * case a future tab reuses this header with a different scroll
	 * target, same as it briefly did while "Old Security" also existed.
	 */
	scrollTargetId: string;
}

/**
 * The mockup's top section — "I found N security issues" (Pro's real
 * severity breakdown when licensed, Free's honest open-count fallback
 * otherwise; see VulnerabilityHeroCard's own docblock), the "What
 * VuloPilot is checking" tile grid, and the "Security Status" score gauge
 * — factored out of ClassicSecurityTab.tsx (Protect My Site's "Security"
 * tab) into its own component since a near-identical version of this
 * same top section briefly also lived on a second "Old Security" tab
 * before that tab was removed. Deliberately the exact same grid={8}/
 * grid={4} nesting OverviewTab.tsx's own hero row uses (SecurityMetricsGrid
 * *inside* the grid={8} column alongside the hero card, not full-width
 * outside it — SecurityMetricsGrid's own 2-tile grid is deliberately
 * sized for that narrower column; getting this nesting wrong once made
 * an earlier pass render 4 tiles per row here instead of the mockup's 2).
 */
const SecurityMockupHeader = ({ scrollTargetId }: SecurityMockupHeaderProps) => {
	const scrollToTarget = () => {
		document
			.getElementById(scrollTargetId)
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	return (
		<ContainerComponent>
			<ColumnComponent grid={8}>
				<VulnerabilityHeroCard onNavigateToSecurityTab={scrollToTarget} />
				<SecurityMetricsGrid />
			</ColumnComponent>
			<ColumnComponent grid={4}>
				<SecurityStatusCard />
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default SecurityMockupHeader;
