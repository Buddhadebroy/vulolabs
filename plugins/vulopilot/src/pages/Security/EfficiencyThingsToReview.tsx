import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent, BadgeComponent, ListComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
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
		titleIcon="review"
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
				<ListComponent
					className="mini-card report"
					items={reviewItems.map((item) => ({
						id: String(item.id),
						icon: 'error red',
						title: item.review_title,
						desc: item.review_description,
						tags: (
							<BadgeComponent
								color="green"
								text={__('Open', 'vulopilot')}
							/>
						),
					}))}
				/>
				{summary && (
					<ButtonInput
						position="full-width"
						buttons={{
							text: sprintf(
								/* translators: %d is the total number of efficiency checks. */
								__('View all efficiency checks (%d) →', 'vulopilot'),
								summary.total
							),
							color: 'border-purple',
							onClick: onViewAll,
						}}
					/>
				)}
			</>
		)}
	</CardComponent>
);

export default EfficiencyThingsToReview;
