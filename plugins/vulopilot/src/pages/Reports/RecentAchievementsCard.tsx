import React from 'react';
import { __ } from '@wordpress/i18n';
import { ActivityListComponent, CardComponent, ModuleGuardComponent, BadgeComponent } from '@zyra/components';
import { useApiList } from '../../services/useApiList';
import { formatWpDate } from '../../services/formatWpDate';

interface ActivityLogRow {
	id: number;
	event_type: string;
	message: string;
	actor_type: 'user' | 'system' | 'automation';
	created_at: string;
}

const UNDO_DISABLED_REASON = __(
	"Undo isn't available yet for this change.",
	'vulopilot'
);

/**
 * "Recent AI Achievements" — real, via `/activity-logs?actor_type=automation`
 * (the same endpoint/filter Free's own Dashboard RecentChangesWidget.tsx
 * already uses). Drops the mockup's fabricated "+N Impact" badge per row —
 * confirmed there's no per-action numeric impact score anywhere in this
 * codebase (the only real `Impact` concept is a static qualitative
 * high/medium/low enum baked into rule definitions, never a computed
 * delta). Undo is honestly disabled with a tooltip, same exact convention
 * already established for AI/automation-attributed activity.
 */
const RecentAchievementsCard = () => {
	const { data, isLoading } = useApiList<ActivityLogRow>('activity-logs', {
		actor_type: 'automation',
		per_page: 6,
	});

	return (
		<CardComponent
			className="recent-achievements-card"
			titleIcon="star"
			title={__('Recent AI Achievements', 'vulopilot')}
			desc={__('Real automated changes AI has made recently.', 'vulopilot')}
		>
			{!isLoading && data.length === 0 ? (
				<ModuleGuardComponent
					icon="star"
					title={__('No AI changes yet', 'vulopilot')}
					desc={__(
						'Changes VuloPilot makes automatically will show up here.',
						'vulopilot'
					)}
				/>
			) : (
				<ActivityListComponent
					cols={2}
					isLoading={isLoading}
					items={data.map((row) => ({
						id: String(row.id),
						icon: 'check',
						title: row.message,
						badge: <BadgeComponent color="blue" text="AI" />,
						timestamp: formatWpDate(row.created_at),
						action: {
							label: __('Undo', 'vulopilot'),
							icon: 'undo',
							disabled: true,
							disabledReason: UNDO_DISABLED_REASON,
						},
					}))}
				/>
			)}
		</CardComponent>
	);
};

export default RecentAchievementsCard;
