import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ChartComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useApiList } from '../../services/useApiList';
import './ProtectMySite.scss';

interface FindingRow {
	id: number;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

interface FindingsHeroCardProps {
	/** adminfont- icon name for the hero's own icon circle. */
	icon: string;
	/** Used in the headline, e.g. "Site Health"/"Files & Plugins". */
	label: string;
	/** Combined scanner ids across every section this tab shows — same list SiteHealthTab.tsx/FilesPluginsTab.tsx already build for their own SectionedFindingsTab sections. */
	scannerIds: string[];
	/** Scrolls to the tab's own first section. */
	onReviewFirst: () => void;
}

/**
 * Shared hero card for SiteHealthTab.tsx/FilesPluginsTab.tsx — same "start
 * with a summary card + a real chart" shape ClassicSecurityTab.tsx's
 * SecurityMockupHeader and PerformanceTab.tsx's EfficiencyHeroCard/
 * EfficiencyOverviewChart already establish for their own tabs, which
 * these two tabs previously went straight past into their section list
 * without. Unlike Security's own `/findings/attention-summary` (a fixed,
 * security-specific endpoint), this fetches the combined open-findings
 * list directly and folds severities client-side — the same
 * critical→high/info→low fold VulnerabilityHeroCard's own attention
 * summary already applies, just computed here since no equivalent
 * endpoint exists for an arbitrary scanner_id list. Bounded to the 100
 * most recent open findings for the severity breakdown/chart (same
 * tradeoff AccessibilityHeroCard.tsx's own docblock documents) — `total`
 * itself is the real, uncapped count from the API response.
 */
const FindingsHeroCard = ({
	icon,
	label,
	scannerIds,
	onReviewFirst,
}: FindingsHeroCardProps) => {
	const { data, total, isLoading } = useApiList<FindingRow>('findings', {
		scanner_id: scannerIds.join(','),
		status: 'open',
		per_page: 100,
	});

	const high = data.filter(
		(row) => row.severity === 'critical' || row.severity === 'high'
	).length;
	const medium = data.filter((row) => row.severity === 'medium').length;
	const low = data.filter(
		(row) => row.severity === 'low' || row.severity === 'info'
	).length;

	return (
		<CardComponent isLoading={isLoading} className="findings-hero">
			{!isLoading && (
				<>
					<div className="findings-hero-top">
						<div
							className={`findings-hero-icon ${total > 0 ? 'is-attention' : 'is-good'}`}
						>
							<i className={`adminfont-${icon}`} />
						</div>
						<div className="findings-hero-headline">
							<p className="findings-hero-title">
								{total > 0
									? sprintf(
											/* translators: 1: number of open findings, 2: section label, e.g. "Site Health". */
											__('I found %1$d %2$s issue(s).', 'vulopilot'),
											total,
											label
										)
									: sprintf(
											/* translators: %s is the section label, e.g. "Site Health". */
											__(
												"You're all caught up — no open %s issues.",
												'vulopilot'
											),
											label
										)}
							</p>
							{high > 0 && (
								<p className="findings-hero-subtitle">
									{sprintf(
										/* translators: %d is the number of high-priority findings. */
										__('%d should be reviewed first.', 'vulopilot'),
										high
									)}
								</p>
							)}
						</div>
					</div>
					{total > 0 && (
						<div className="findings-hero-chart-row">
							<div className="findings-hero-chart">
								<ChartComponent
									type="pie"
									height={140}
									centerLabel={
										<>
											<span className="findings-hero-chart-number">
												{total}
											</span>
											<span className="findings-hero-chart-label">
												{__('Open', 'vulopilot')}
											</span>
										</>
									}
									data={[
										{
											label: __('High', 'vulopilot'),
											value: high,
											color: '#dc2626',
										},
										{
											label: __('Medium', 'vulopilot'),
											value: medium,
											color: '#d97706',
										},
										{
											label: __('Low', 'vulopilot'),
											value: low,
											color: '#2563eb',
										},
									]}
								/>
							</div>
							<ul className="efficiency-overview-legend">
								<li>
									<span
										className="efficiency-overview-dot"
										style={{ background: '#dc2626' }}
									/>
									{__('High', 'vulopilot')}
									<span className="efficiency-overview-count">{high}</span>
								</li>
								<li>
									<span
										className="efficiency-overview-dot"
										style={{ background: '#d97706' }}
									/>
									{__('Medium', 'vulopilot')}
									<span className="efficiency-overview-count">{medium}</span>
								</li>
								<li>
									<span
										className="efficiency-overview-dot"
										style={{ background: '#2563eb' }}
									/>
									{__('Low', 'vulopilot')}
									<span className="efficiency-overview-count">{low}</span>
								</li>
							</ul>
						</div>
					)}
					{total > 0 && (
						<div className="findings-hero-actions">
							<ButtonInput
								buttons={{
									text: __('Review Issues', 'vulopilot'),
									rightIcon: 'pagination-right-arrow',
									color: 'purple-bg',
									onClick: onReviewFirst,
								}}
							/>
						</div>
					)}
				</>
			)}
		</CardComponent>
	);
};

export default FindingsHeroCard;
