import { __, _n, sprintf } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import type { EfficiencySummary } from './efficiencyChecks';

interface EfficiencyHeroCardProps {
	summary: EfficiencySummary | null;
	isLoading: boolean;
	onReviewImprovements: () => void;
}

/**
 * The mockup's own hero card — real counts from `GET /efficiency-checks`'s
 * `summary` (Controllers\EfficiencyChecks.php), not the mockup's own
 * literal "2 Need attention / 4 Working normally" example numbers, which
 * only apply to that one screenshot's own site. `summary.total` is
 * whatever this plugin can genuinely detect (4 real checks — Page
 * caching, Browser caching, Persistent object cache, PHP acceleration —
 * see that controller's own docblock), not the mockup's own "6"; the
 * "Working correctly" bucket further only counts real passing checks,
 * `not_applicable` (e.g. a persistent object cache the site's own size
 * doesn't even warrant recommending) is its own separate real bucket, not
 * folded into either.
 */
const EfficiencyHeroCard = ({
	summary,
	isLoading,
	onReviewImprovements,
}: EfficiencyHeroCardProps) => {
	const needAttention = summary?.need_attention ?? 0;
	const working = summary?.working ?? 0;
	const allGood = !isLoading && needAttention === 0;

	return (
		<CardComponent isLoading={isLoading} className="efficiency-hero">
			{!isLoading && (
				<>
					<div className={`efficiency-hero-icon ${allGood ? 'is-good' : 'is-attention'}`}>
						<i className="adminfont-analytics" />
					</div>
					<p className="efficiency-hero-title">
						{allGood
							? __('Everything is running efficiently.', 'vulopilot')
							: sprintf(
									/* translators: %d is the number of efficiency checks that need attention. */
									_n(
										'%d thing could be improved.',
										'%d things could be improved.',
										needAttention,
										'vulopilot'
									),
									needAttention
								)}
					</p>
					<p className="efficiency-hero-desc">
						{allGood
							? __(
									'WordPress is set up to avoid unnecessary processing.',
									'vulopilot'
								)
							: __(
									'Most of the basics are working correctly, but WordPress could avoid some unnecessary processing.',
									'vulopilot'
								)}
					</p>
					<div className="efficiency-hero-stats">
						<div className="efficiency-hero-stat is-attention">
							<span className="efficiency-hero-stat-value">
								{needAttention}
							</span>
							<span className="efficiency-hero-stat-label">
								{__('Need attention', 'vulopilot')}
							</span>
						</div>
						<div className="efficiency-hero-stat is-good">
							<span className="efficiency-hero-stat-value">{working}</span>
							<span className="efficiency-hero-stat-label">
								{__('Working normally', 'vulopilot')}
							</span>
						</div>
					</div>
					{needAttention > 0 && (
						<div className="efficiency-hero-actions">
							<ButtonInput
								buttons={{
									text: sprintf(
										/* translators: %d is the number of efficiency checks that need attention. */
										__('Review %d Improvements', 'vulopilot'),
										needAttention
									),
									rightIcon: 'pagination-right-arrow',
									color: 'purple-bg',
									onClick: onReviewImprovements,
								}}
							/>
						</div>
					)}
				</>
			)}
		</CardComponent>
	);
};

export default EfficiencyHeroCard;
