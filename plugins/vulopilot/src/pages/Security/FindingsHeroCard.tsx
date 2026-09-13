import { __, sprintf } from '@wordpress/i18n';
import { COLOR_PALETTE } from '@zyra/core';
import {
	CardComponent,
	ChartComponent,
	LegendComponent,
	TypographyComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useApiList } from '../../services/useApiList';
import { getSeverityColor } from '../../services/getSeverityClass';
import './ProtectMySite.scss';
import SiteHealthStatusCard from './SiteHealthStatusCard';

interface FindingRow {
	id: number;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
}

/**
 * Same canonical weighted-severity formula this codebase's own SEO/Content/
 * Brand scores already use (`100 - critical*15 - high*8 - medium*3 -
 * low*1`, clamped 0-100) — just without a separate `critical` term, since
 * this card's own `high` already folds critical+high together (see this
 * file's own docblock). A real, derived number from the same counts
 * already fetched here, not a fabricated one.
 */
const calculateScore = (high: number, medium: number, low: number): number =>
	Math.max(0, Math.min(100, 100 - high * 8 - medium * 3 - low * 1));

/** Same real 3-tier band shape `PerformanceScoreCard.tsx`'s own `Rating` interface uses — kept structurally identical so both files' ring colors read from the same kind of map. */
interface Rating {
	label: string;
	className: 'good' | 'needs-improvement' | 'poor';
}

/**
 * Same 3-tier 0-100 thresholds seoRating.ts's own `getRating()` already
 * establishes elsewhere in this codebase — kept local here rather than
 * imported since this component lives outside GEO. Returns the real
 * `Rating` object (label + className) rather than just the label string,
 * matching `PerformanceScoreCard.tsx`'s own `getScoreRating()` shape so
 * both files' ring colors can read from the same kind of map.
 */
const getScoreRating = (score: number): Rating => {
	if (score >= 70) {
		return { label: __('Good', 'vulopilot'), className: 'good' };
	}
	if (score >= 40) {
		return { label: __('Needs Attention', 'vulopilot'), className: 'needs-improvement' };
	}
	return { label: __('Poor', 'vulopilot'), className: 'poor' };
};

/**
 * Real zyra palette hex (`@zyra/core`'s `COLOR_PALETTE`) — same real
 * source `PerformanceScoreCard.tsx`'s own `RATING_COLOR` reads. The ring's
 * own `data[].color` needs a literal CSS color, not a palette class name,
 * so this reads the shared source rather than a second hardcoded copy.
 */
const RATING_COLOR: Record<Rating['className'], string> = {
	good: COLOR_PALETTE.green,
	'needs-improvement': COLOR_PALETTE.yellow,
	poor: COLOR_PALETTE.red,
};

/** Same real bands as `getScoreRating()` above, mapped to the real palette class name the ring color map is keyed by. */
const ratingClass = (score: number): Rating['className'] => {
	return getScoreRating(score).className;
};

interface FindingsHeroCardProps {
	/** adminfont- icon name for the hero's own icon circle. */
	icon: string;
	/** Used in the headline, e.g. "Site Health". */
	label: string;
	/** Combined scanner ids across every section this tab shows — same list SiteHealthTab.tsx builds for its own SectionedFindingsTab sections. */
	scannerIds: string[];
	/** Scrolls to the tab's own first section. */
	onReviewFirst: () => void;
}

/**
 * Shared hero card, currently only consumed by SiteHealthTab.tsx (also
 * used by the now-removed FilesPluginsTab.tsx, which this component was
 * originally built alongside — kept generic/reusable rather than folded
 * into SiteHealthTab.tsx itself, since nothing else about it is
 * Site-Health-specific) — same "start with a summary card + a real chart"
 * shape SecurityTab.tsx's SecurityMockupHeader and PerformanceTab.tsx's
 * EfficiencyHeroCard/EfficiencyOverviewChart already establish for their
 * own tabs, which this tab previously went straight past into its section
 * list without. Unlike Security's own `/findings/attention-summary` (a fixed,
 * security-specific endpoint), this fetches the combined open-findings
 * list directly and folds severities client-side — the same
 * critical→high/info→low fold VulnerabilityHeroCard's own attention
 * summary already applies, just computed here since no equivalent
 * endpoint exists for an arbitrary scanner_id list. Bounded to the 100
 * most recent open findings for the severity breakdown/chart (same
 * tradeoff AccessibilityHeroCard.tsx's own docblock documents) — `total`
 * itself is the real, uncapped count from the API response.
 *
 * The hero gauge is now a real ring (matching `PerformanceScoreCard.tsx`'s
 * own `ChartComponent type="ring"` structure) — same real 0-100
 * weighted-severity score, same real Good/Needs Attention/Poor bands, just
 * one consistent ring shape across every hero card in this plugin instead
 * of the older gauge variant this file used to render.
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
	const score = calculateScore(high, medium, low);

	return (
		<CardComponent
			isLoading={isLoading}
			titleIcon={icon}
			title={
				total > 0
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
					)
			}
			desc={
				high > 0 && (
					<>
						{sprintf(
							/* translators: %d is the number of high-priority findings. */
							__('%d should be reviewed first.', 'vulopilot'),
							high
						)}
					</>
				)
			}
			className="findings-hero"
		>
			{!isLoading && (
				<>
					<div className='overall-score-wrapper'>
						{total > 0 && (
							<div className="overall-score-summary">
								<ChartComponent
									type="ring"
									height={200}
									centerLabel={
										<>
											<TypographyComponent variant={'h1'}>
												{score}
											</TypographyComponent>
											<TypographyComponent variant={'h4'}>
												{getScoreRating(score).label}
											</TypographyComponent>
										</>
									}
									data={[
										{
											label: __('Score', 'vulopilot'),
											value: score,
											color: RATING_COLOR[ratingClass(score)],
										},
										{
											label: __('Remaining', 'vulopilot'),
											value: 100 - score,
											color: '#e5e7eb',
										},
									]}
								/>
								<LegendComponent
									className="efficiency-overview-legend"
									items={[
										{
											key: 'high',
											label: __('High', 'vulopilot'),
											value: high,
											color: getSeverityColor('high'),
										},
										{
											key: 'medium',
											label: __('Medium', 'vulopilot'),
											value: medium,
											color: getSeverityColor('medium'),
										},
										{
											key: 'low',
											label: __('Low', 'vulopilot'),
											value: low,
											color: getSeverityColor('low'),
										},
									]}
								/>
							</div>
						)}
						<div className='overall-score-summary'>
							<SiteHealthStatusCard />
						</div>
					</div>
					{total > 0 && (
						<ButtonInput
							positive="full-width"
							buttons={{
								text: __('Review Issues', 'vulopilot'),
								rightIcon: 'pagination-right-arrow',
								color: 'border-purple',
								onClick: onReviewFirst,
							}}
						/>
					)}
				</>
			)}
		</CardComponent>
	);
};

export default FindingsHeroCard;