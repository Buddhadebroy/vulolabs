import { __, _n, sprintf } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { getCategoryTabLink } from '../../services/getCategoryTabLink';
import type { ReportsSummary, Highlight } from './reportsOverview';

interface ReportsHeroCardProps {
	summary: ReportsSummary | null;
	highlights: Highlight[];
	isLoading: boolean;
}

const formatDelta = (pct: number | null): string => {
	if (pct === null) {
		return '';
	}
	return `${pct > 0 ? '+' : ''}${pct}%`;
};

/**
 * The mockup's "Your website is improving 🎉" hero — real
 * fixed/new/still-open counts and their real period-over-period percent
 * change (`GET /reports-overview`, Controllers\ReportsOverview.php's own
 * docblock explains how each is computed from real created_at/resolved_at
 * timestamps, no stored snapshot needed). The headline/description and
 * each highlight row's direction word are derived honestly from those
 * same real deltas — no narrative/prose-generation capability exists
 * anywhere in this codebase to write the mockup's own free-form sentence
 * ("Search visibility and website health improved..."), so this composes
 * one from the real per-category direction instead (same reasoning the
 * previous version of this card already documented for dropping
 * fabricated prose).
 */
const ReportsHeroCard = ({
	summary,
	highlights,
	isLoading,
}: ReportsHeroCardProps) => {
	const improving = highlights.filter((h) => h.direction === 'up').length;
	const worsening = highlights.filter((h) => h.direction === 'down').length;
	const isImproving = improving >= worsening;

	const worseningLabels = highlights
		.filter((h) => h.direction === 'down')
		.map((h) => h.label.replace(/ (needs attention|down|remained stable)$/i, ''));

	return (
		<CardComponent isLoading={isLoading} className="reports-hero-card">
			{!isLoading && summary && (
				<>
					<div
						className={`reports-hero-icon ${isImproving ? 'is-good' : 'is-attention'}`}
					>
						<i className={`adminfont-${isImproving ? 'active' : 'error'}`} />
					</div>
					<h2 className="reports-hero-title">
						{isImproving
							? __('Your website is improving', 'vulopilot')
							: __('Your website needs attention', 'vulopilot')}
					</h2>
					<p className="reports-hero-subtitle">
						{sprintf(
							/* translators: %d is the number of issues fixed. */
							_n(
								'%d issue fixed since your last report.',
								'%d issues fixed since your last report.',
								summary.fixed,
								'vulopilot'
							),
							summary.fixed
						)}
					</p>
					<p className="reports-hero-desc">
						{worseningLabels.length > 0
							? sprintf(
									/* translators: %s is a comma-separated list of areas that got worse, e.g. "Security, Search visibility". */
									__(
										'%s still need attention this period.',
										'vulopilot'
									),
									worseningLabels.join(', ')
								)
							: __(
									'Every tracked area held steady or improved this period.',
									'vulopilot'
								)}
					</p>
					<div className="reports-hero-stats">
						<div className="reports-hero-stat is-good">
							<span className="reports-hero-stat-value">
								{summary.fixed}
							</span>
							<span className="reports-hero-stat-label">
								{__('Fixed', 'vulopilot')}
							</span>
							{summary.fixed_delta_pct !== null && (
								<span className="reports-hero-stat-delta">
									{formatDelta(summary.fixed_delta_pct)}
								</span>
							)}
						</div>
						<div className="reports-hero-stat is-attention">
							<span className="reports-hero-stat-value">
								{summary.new}
							</span>
							<span className="reports-hero-stat-label">
								{__('New', 'vulopilot')}
							</span>
							{summary.new_delta_pct !== null && (
								<span className="reports-hero-stat-delta">
									{formatDelta(summary.new_delta_pct)}
								</span>
							)}
						</div>
						<div className="reports-hero-stat is-neutral">
							<span className="reports-hero-stat-value">
								{summary.still_open}
							</span>
							<span className="reports-hero-stat-label">
								{__('Still need attention', 'vulopilot')}
							</span>
							{summary.still_open_delta_pct !== null && (
								<span className="reports-hero-stat-delta">
									{formatDelta(summary.still_open_delta_pct)}
								</span>
							)}
						</div>
					</div>
					<div className="reports-hero-highlights">
						{highlights.map((highlight) => (
							<a
								className="reports-hero-highlight-row"
								key={highlight.key}
								href={getCategoryTabLink(highlight.key)}
							>
								<i
									className={`adminfont-${
										highlight.direction === 'up'
											? 'arrow-up'
											: highlight.direction === 'down'
												? 'arrow-down'
												: 'minus'
									} reports-hero-highlight-icon is-${highlight.direction}`}
								/>
								<span className="reports-hero-highlight-label">
									{highlight.label}
								</span>
							</a>
						))}
					</div>
				</>
			)}
		</CardComponent>
	);
};

export default ReportsHeroCard;
