import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { COLOR_PALETTE } from '@zyra/core';
import { ChartComponent, BadgeComponent, TypographyComponent } from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { useLastScanTime } from '../services/useLastScanTime';
import { formatWpDate } from '../services/formatWpDate';
import { WidgetProps } from './types';

/**
 * "Vital Pulse" — the Dashboard's hero status ring: one real 0-100
 * `overall_score`, colored by its own real rating band via
 * `ratingColorFor()`, with a single real critical-findings badge ("No
 * critical issues" / "N critical issues") and a real "Last scanned"
 * timestamp (`useLastScanTime()`'s own most-recently-completed scan,
 * called with no category filter since this score is a sitewide rollup)
 * below it — per a newer reference mockup.
 *
 * Split out from the per-category score breakdown (now `ScoreBreakdownWidget.tsx`,
 * its own separate widget) per direct instruction ("separate this with 2
 * DashboardWidget") — the two used to share one `ContainerComponent` row
 * inside a single widget; each is now independently
 * hideable/reorderable via "Customize dashboard" instead.
 */
export const getRating = (score: number): string => {
	if (score >= 90) {
		return __('Excellent', 'vulopilot');
	}
	if (score >= 70) {
		return __('Good', 'vulopilot');
	}
	if (score >= 50) {
		return __('Fair', 'vulopilot');
	}
	return __('Needs work', 'vulopilot');
};

/** Same real 4-tier `getRating()` bands above, mapped to real palette color names — feeds the ring's own stroke color and (duplicated in `ScoreBreakdownWidget.tsx`, same "duplicate small logic across scopes" precedent this codebase already uses elsewhere, e.g. EntityExtractor.php's own `CONTACT_SLUGS`/`ABOUT_SLUGS`) each row's own score number color there. */
export const ratingColorFor = (score: number): string => {
	if (score >= 90) {
		return 'green';
	}
	if (score >= 70) {
		return 'blue';
	}
	if (score >= 50) {
		return 'yellow';
	}
	return 'red';
};

const getRatingSummary = (score: number): string => {
	if (score >= 90) {
		return __('Your site is in excellent shape.', 'vulopilot');
	}
	if (score >= 70) {
		return __(
			'Your site is healthy and needs minimal work.',
			'vulopilot'
		);
	}
	if (score >= 50) {
		return __('Your site could use some improvement.', 'vulopilot');
	}
	return __('Your site needs attention in several areas.', 'vulopilot');
};

const OverallScoreWidget: React.FC<WidgetProps> = ({
	summary,
	isLoading,
	onHide,
	isCustomizing,
}) => {
	// Real most-recent completed scan across every category — same real
	// `useLastScanTime()` hook CrawlRobotsSitemapSection.tsx's own "Last
	// Checked" tile already uses, called here with no category filter
	// since this widget's own score is a sitewide rollup, not scoped to
	// one category.
	const { lastScanAt } = useLastScanTime();

	return (
		<DashboardWidget
			// title={__('Vital Pulse', 'vulopilot')}
			// icon="analytics"
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
		>
			<div className='overall-score-summary'>
				<ChartComponent
					type="ring"
					isLoading={isLoading}
					height={240}
					color={
						COLOR_PALETTE[
						ratingColorFor(summary.overall_score) as keyof typeof COLOR_PALETTE
						]
					}
					centerLabel={
						<>
							<span className="score-ring-number">
								{summary.overall_score}
							</span>
							<span className="score-ring-label">
								{getRating(summary.overall_score)}
							</span>
						</>
					}
					data={[{ label: __('Score', 'vulopilot'), value: summary.overall_score }]}
				/>

				<TypographyComponent variant={"h3"} color="text-green">
					{__('Overall Score', 'vulopilot')}
				</TypographyComponent>
				<div className="desc">
					{getRatingSummary(summary.overall_score)}
				</div>
				<div className="buttons-wrapper">
					<BadgeComponent
						color={0 === summary.critical_findings ? 'green' : 'red'}
						icon={0 === summary.critical_findings ? 'check' : 'error'}
						text={
							0 === summary.critical_findings
								? __('No critical issues', 'vulopilot')
								: sprintf(
									/* translators: %d: number of open critical-severity findings. */
									__('%d critical issues', 'vulopilot'),
									summary.critical_findings
								)
						}
					/>
				</div>
				{lastScanAt && (
					<p className="desc overall-score-last-scanned">
						{sprintf(
							/* translators: %s: real formatted date+time of the most recent completed scan. */
							__('Last scanned: %s', 'vulopilot'),
							`${formatWpDate(lastScanAt)}, ${new Date(
								lastScanAt
							).toLocaleTimeString(undefined, {
								hour: 'numeric',
								minute: '2-digit',
							})}`
						)}
					</p>
				)}
			</div>
		</DashboardWidget>
	);
};

export default OverallScoreWidget;
