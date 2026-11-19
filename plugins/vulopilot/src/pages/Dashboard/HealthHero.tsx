import React from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ButtonInput } from '@zyra/inputs';
import { Delta, Skeleton, scoreTone } from '../../components/ui';
import { formatWpDate } from '../../services/formatWpDate';
import { useLastScanTime } from '../../services/useLastScanTime';
import { getAreaScores, getRating, getRatingSummary } from './scoring';
import type { DashboardSummary } from '../../dashboard-widgets/types';

export interface HeroAction {
	label: string;
	icon: string;
	onClick: () => void;
}

/** The score as a ring: one track, one arc in the score's colour. */
const ScoreRing = ({ score }: { score: number }) => {
	const radius = 52;
	const length = 2 * Math.PI * radius;
	const clamped = Math.max(0, Math.min(100, score));

	return (
		<div className={`vp-ring is-${scoreTone(score)}`}>
			<svg viewBox="0 0 120 120" aria-hidden="true">
				<circle cx="60" cy="60" r={radius} className="vp-ring-track" />
				<circle
					cx="60"
					cy="60"
					r={radius}
					className="vp-ring-arc"
					strokeDasharray={length}
					strokeDashoffset={length * (1 - clamped / 100)}
				/>
			</svg>
			<span className="vp-ring-label">
				<strong>{score}</strong>
				<span>{__('of 100', 'vulopilot')}</span>
			</span>
		</div>
	);
};

/**
 * The dashboard's opening answer to "how is my site doing, and what should I do about it?": the score with its
 * meaning, the week's biggest change, and the one action that matters most right now. Area scores on the right
 * each open the page that improves them.
 */
const HealthHero: React.FC<{
	summary: DashboardSummary;
	isLoading: boolean;
	primary: HeroAction | null;
}> = ({ summary, isLoading, primary }) => {
	const { lastScanAt } = useLastScanTime();

	if (isLoading) {
		return (
			<section className="vp-hero is-loading" aria-busy="true">
				<Skeleton size="hero" />
				<Skeleton size="block" />
			</section>
		);
	}

	const areas = getAreaScores(summary);
	const worst = areas.reduce((a, b) => (b.delta < a.delta ? b : a));
	const best = areas.reduce((a, b) => (b.delta > a.delta ? b : a));

	let trend: React.ReactNode = __('Your scores held steady this week.', 'vulopilot');
	let trendTone = 'is-flat';

	if (worst.delta < 0) {
		trendTone = 'is-down';
		trend = (
			<>
				{sprintf(
					/* translators: 1: area name such as "Health", 2: points lost. */
					_n('%1$s dropped %2$d point this week.', '%1$s dropped %2$d points this week.', Math.abs(worst.delta), 'vulopilot'),
					worst.label,
					Math.abs(worst.delta)
				)}{' '}
				<a href={worst.href}>{__('See why', 'vulopilot')}</a>
			</>
		);
	} else if (best.delta > 0) {
		trendTone = 'is-up';
		trend = sprintf(
			/* translators: 1: area name such as "Performance", 2: points gained. */
			_n('%1$s improved %2$d point this week.', '%1$s improved %2$d points this week.', best.delta, 'vulopilot'),
			best.label,
			best.delta
		);
	}

	return (
		<section className="vp-hero" aria-label={__('Site health', 'vulopilot')}>
			<div className="vp-hero-main">
				<ScoreRing score={summary.overall_score} />
				<div className="vp-hero-copy">
					<span className={`vp-hero-eyebrow is-${scoreTone(summary.overall_score)}`}>
						{sprintf(
							/* translators: %s: rating such as "Excellent". */
							__('Site health · %s', 'vulopilot'),
							getRating(summary.overall_score)
						)}
					</span>
					<h2>{getRatingSummary(summary.overall_score)}</h2>
					<p className={`vp-hero-trend ${trendTone}`}>
						<i className={`adminfont-arrow-${'is-down' === trendTone ? 'down' : 'up'}`} aria-hidden="true" />
						<span>{trend}</span>
					</p>
					<ul className="vp-hero-facts">
						<li>
							<strong>{summary.fixed_findings_this_week}</strong> {__('fixed this week', 'vulopilot')}
						</li>
						<li>
							<strong>{summary.new_findings_this_week}</strong> {__('new this week', 'vulopilot')}
						</li>
						{lastScanAt && (
							<li>
								{sprintf(
									/* translators: %s: date and time of the last completed scan. */
									__('Last scan %s', 'vulopilot'),
									formatWpDate(lastScanAt)
								)}
							</li>
						)}
					</ul>
					{primary && (
						<div className="vp-hero-cta">
							<ButtonInput
								buttons={{
									text: primary.label,
									icon: primary.icon,
									color: 'purple-bg',
									onClick: primary.onClick,
								}}
							/>
						</div>
					)}
				</div>
			</div>

			<div className="vp-hero-areas">
				<span className="vp-hero-areas-title">{__('Scores by area', 'vulopilot')}</span>
				<ul>
					{areas.map((area) => (
						<li key={area.key}>
							<a href={area.href}>
								<i className={`adminfont-${area.icon}`} aria-hidden="true" />
								<span className="vp-area-name">{area.label}</span>
								<span className="vp-area-bar" aria-hidden="true">
									<i className={`is-${scoreTone(area.score)}`} style={{ width: `${Math.max(0, Math.min(100, area.score))}%` }} />
								</span>
								<span className="vp-area-score">{area.score}</span>
								<span className="vp-area-delta">
									<Delta change={area.delta} suffix="" />
								</span>
							</a>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
};

export default HealthHero;
