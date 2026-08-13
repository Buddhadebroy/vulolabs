import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent } from '@zyra/components';
import type { EfficiencyCheck, EfficiencySummary } from './efficiencyChecks';
import { THINGS_TO_REVIEW_ID } from './efficiencyChecks';

interface EfficiencyThingsToReviewProps {
	reviewItems: EfficiencyCheck[];
	summary: EfficiencySummary | null;
	isLoading: boolean;
	onViewAll: () => void;
}

/**
 * The mockup's "Things to review" list — every check currently reporting
 * `status: 'attention'` (real, from `GET /efficiency-checks`'s own
 * `review_items`, already filtered server-side). Each row reuses that
 * check's own `review_title`/`review_description` (written for this
 * context — "Page caching isn't detected" reads better as a to-do than
 * the tile's own "Page caching" + "Not detected" pairing). "Open" is the
 * only real status this list can show — there's no per-check
 * acknowledge/dismiss action (these are live server facts re-checked
 * every load, not a stored Finding row with its own status column).
 */
const EfficiencyThingsToReview = ({
	reviewItems,
	summary,
	isLoading,
	onViewAll,
}: EfficiencyThingsToReviewProps) => (
	<CardComponent
		id={THINGS_TO_REVIEW_ID}
		title={__('Things to review', 'vulopilot')}
		desc={__(
			'These items are affecting WordPress efficiency.',
			'vulopilot'
		)}
		isLoading={isLoading}
	>
		{!isLoading && reviewItems.length === 0 && (
			<ModuleGuardComponent
				icon="check"
				title={__('Nothing to review', 'vulopilot')}
				desc={__(
					'Every efficiency check that applies to this site is passing.',
					'vulopilot'
				)}
			/>
		)}
		{!isLoading && reviewItems.length > 0 && (
			<>
				<div className="efficiency-review-list">
					{reviewItems.map((item) => (
						<div className="efficiency-review-row" key={item.id}>
							<i className="adminfont-error efficiency-review-icon" />
							<div className="efficiency-review-body">
								<span className="efficiency-review-title">
									{item.review_title}
								</span>
								<span className="efficiency-review-desc">
									{item.review_description}
								</span>
							</div>
							<span className="admin-badge badge-open">
								{__('Open', 'vulopilot')}
							</span>
						</div>
					))}
				</div>
				{summary && (
					<button
						type="button"
						className="efficiency-review-view-all"
						onClick={onViewAll}
					>
						{sprintf(
							/* translators: %d is the total number of efficiency checks. */
							__('View all efficiency checks (%d) →', 'vulopilot'),
							summary.total
						)}
					</button>
				)}
			</>
		)}
	</CardComponent>
);

export default EfficiencyThingsToReview;
