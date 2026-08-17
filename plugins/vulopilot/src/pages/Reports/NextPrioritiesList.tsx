import { __ } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent, BadgeComponent } from '@zyra/components';
import { humanizeCategory } from '../../services/useFindingsTable';
import { getCategoryTabLink } from '../../services/getCategoryTabLink';
import type { NextPriority } from './reportsOverview';

interface NextPrioritiesListProps {
	priorities: NextPriority[];
	isLoading: boolean;
}

const SEVERITY_LABEL: Record<string, string> = {
	critical: __('High', 'vulopilot'),
	high: __('High', 'vulopilot'),
	medium: __('Medium', 'vulopilot'),
	low: __('Low', 'vulopilot'),
	info: __('Low', 'vulopilot'),
};

/**
 * "Your next priorities" — the 3 real highest-severity currently-open
 * findings site-wide (`GET /reports-overview`'s `next_priorities`,
 * FindingRepository::get_top_open_findings()). "Review" navigates to that
 * finding's own category page, same real `getCategoryTabLink.ts` mapping
 * every other cross-page "go review this" link in this codebase already
 * uses.
 */
const NextPrioritiesList = ({
	priorities,
	isLoading,
}: NextPrioritiesListProps) => (
	<CardComponent
		className="reports-priorities-card"
		title={__('Your next priorities', 'vulopilot')}
		isLoading={isLoading}
	>
		{!isLoading && priorities.length === 0 && (
			<ModuleGuardComponent
				icon="check"
				title={__("You're all caught up", 'vulopilot')}
				desc={__('No open findings need attention right now.', 'vulopilot')}
			/>
		)}
		{!isLoading && priorities.length > 0 && (
			<ol className="reports-priorities-list">
				{priorities.map((priority, index) => (
					<li key={priority.id} className="reports-priority-row">
						<span className="reports-priority-index">
							{index + 1}
						</span>
						<div className="reports-priority-body">
							<span className="reports-priority-title">
								{priority.title}
							</span>
							<span className="reports-priority-desc">
								{humanizeCategory(priority.category)}
							</span>
						</div>
						<BadgeComponent
							color={`badge-${priority.severity}`}
							text={SEVERITY_LABEL[priority.severity] || priority.severity}
						/>
						<a
							className="reports-priority-review"
							href={getCategoryTabLink(priority.category)}
						>
							{__('Review', 'vulopilot')}
						</a>
					</li>
				))}
			</ol>
		)}
	</CardComponent>
);

export default NextPrioritiesList;
