import { __, _n, sprintf } from '@wordpress/i18n';
import { ButtonInput } from '@zyra/inputs';
import { ScoreRing, Skeleton, scoreTone } from '../../components/ui';
import type { FindingGroup } from '../../components/Issues/issuesTypes';
import { getRating } from '../Dashboard/scoring';
import { SECURITY_AREAS } from './securityAreas';

const SEVERITY_RANK: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

const SEVERITY_WORD: Record<string, string> = {
	critical: __('critical', 'vulopilot'),
	high: __('high', 'vulopilot'),
	medium: __('medium', 'vulopilot'),
	low: __('low', 'vulopilot'),
	info: __('info', 'vulopilot'),
};

/** How an area looks: clear, or its issue count in its worst issue's colour. */
const areaStatus = (groups: FindingGroup[]): { tone: 'good' | 'bad' | 'warn' | 'info'; text: string } => {
	if (0 === groups.length) {
		return { tone: 'good', text: __('Clear', 'vulopilot') };
	}

	const worst = groups.reduce((a, b) => ((SEVERITY_RANK[b.severity] ?? 4) < (SEVERITY_RANK[a.severity] ?? 4) ? b : a));
	const rank = SEVERITY_RANK[worst.severity] ?? 4;

	return {
		tone: rank <= 1 ? 'bad' : 2 === rank ? 'warn' : 'info',
		text: sprintf(
			/* translators: 1: number of issues, 2: worst severity, e.g. "critical". */
			_n('%1$d issue · %2$s', '%1$d issues · %2$s', groups.length, 'vulopilot'),
			groups.length,
			SEVERITY_WORD[worst.severity] ?? worst.severity
		),
	};
};

interface SecurityHeroProps {
	score: number | null;
	groups: FindingGroup[];
	isLoading: boolean;
	/** Shows one area's issues in the list below (`all` for every area). */
	// eslint-disable-next-line no-unused-vars -- parameter name in a type signature.
	onReview: (area: string) => void;
}

/**
 * The Security page's opening answer: the security score and what it means, how many issues are open and how many
 * are urgent, and every protection area with its state. An area opens its issues in the list below.
 */
const SecurityHero = ({ score, groups, isLoading, onReview }: SecurityHeroProps) => {
	if (isLoading) {
		return (
			<section className="vp-hero is-loading" aria-busy="true">
				<Skeleton size="hero" />
				<Skeleton size="block" />
			</section>
		);
	}

	const urgent = groups.filter((group) => (SEVERITY_RANK[group.severity] ?? 4) <= 1).length;
	const areas = SECURITY_AREAS.map((area) => ({
		...area,
		status: areaStatus(groups.filter((group) => area.scannerIds.includes(group.scanner_id))),
	}));
	const clear = areas.filter((area) => 'good' === area.status.tone).length;
	const shown = score ?? 0;

	let headline = __('No open security issues. Your site is well protected.', 'vulopilot');
	let next = __('Every security check passed on the last scan.', 'vulopilot');
	let nextTone = 'is-up';

	if (groups.length > 0) {
		headline = sprintf(
			/* translators: %d: number of open security issues. */
			_n('%d security issue is open.', '%d security issues are open.', groups.length, 'vulopilot'),
			groups.length
		);
		nextTone = urgent > 0 ? 'is-down' : 'is-flat';
		next =
			urgent > 0
				? sprintf(
						/* translators: %d: number of critical or high issues. */
						_n('%d needs your attention first.', '%d need your attention first.', urgent, 'vulopilot'),
						urgent
				  )
				: __('Nothing urgent. Fix the rest when you have a moment.', 'vulopilot');
	}

	return (
		<section className="vp-hero vp-sec-hero" aria-label={__('Security', 'vulopilot')}>
			<div className="vp-hero-main">
				<ScoreRing score={shown} />
				<div className="vp-hero-copy">
					<span className={`vp-hero-eyebrow is-${scoreTone(shown)}`}>
						{sprintf(
							/* translators: %s: rating such as "Excellent". */
							__('Security · %s', 'vulopilot'),
							getRating(shown)
						)}
					</span>
					<h2>{headline}</h2>
					<p className={`vp-hero-trend ${nextTone}`}>
						<i className={`adminfont-${'is-down' === nextTone ? 'error' : 'check'}`} aria-hidden="true" />
						<span>{next}</span>
					</p>
					<ul className="vp-hero-facts">
						<li>
							<strong>
								{clear}/{areas.length}
							</strong>{' '}
							{__('areas clear', 'vulopilot')}
						</li>
						<li>
							<strong>{urgent}</strong> {__('critical or high', 'vulopilot')}
						</li>
					</ul>
					{groups.length > 0 && (
						<div className="vp-hero-cta">
							<ButtonInput
								buttons={{
									text: __('Review issues', 'vulopilot'),
									icon: 'arrow-down',
									color: 'purple-bg',
									onClick: () => onReview('all'),
								}}
							/>
						</div>
					)}
				</div>
			</div>

			<div className="vp-hero-areas">
				<span className="vp-hero-areas-title">{__('Protection by area', 'vulopilot')}</span>
				<ul className="vp-sec-areas">
					{areas.map((area) => (
						<li key={area.id}>
							<button
								type="button"
								className={`is-${area.status.tone}`}
								disabled={'good' === area.status.tone}
								onClick={() => onReview(area.id)}
							>
								<i className={`adminfont-${area.icon}`} aria-hidden="true" />
								<span className="vp-area-name">{area.label}</span>
								<span className="vp-sec-area-state">
									{'good' === area.status.tone && <i className="adminfont-check" aria-hidden="true" />}
									{area.status.text}
								</span>
							</button>
						</li>
					))}
				</ul>
			</div>
		</section>
	);
};

export default SecurityHero;
