/* global appLocalizer */
import { __ } from '@wordpress/i18n';
import {
	CardComponent,
	ColumnComponent,
	ModuleGuardComponent,
} from '@zyra/components';
import { TableCard, TableRow } from '@zyra/table';
import { useApiList } from '../../services/useApiList';

interface ActivityLogRow extends TableRow {
	id: number;
	event_type: string;
	actor_type: 'user' | 'system' | 'automation';
	message: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
	created_at: string;
}

/**
 * Real `actor_type` value → the real icon+palette suffix the info column's
 * own `IconComponent` understands — same `'<icon-name> <color>'` convention
 * every other list/table row in this plugin already uses.
 */
const ACTOR_TYPE_ICON: Record<ActivityLogRow['actor_type'], string> = {
	user: 'person blue',
	system: 'module green',
	automation: 'automation purple',
};

/** Real `actor_type` value → its own display label. */
const ACTOR_TYPE_LABEL: Record<ActivityLogRow['actor_type'], string> = {
	user: __('User', 'vulopilot'),
	system: __('System', 'vulopilot'),
	automation: __('Automation', 'vulopilot'),
};

/**
 * Real `severity` value → the badge color suffix `BadgeComponent` reads.
 * Kept as its own map rather than reusing `badge-${severity}` the way some
 * older tables did — the palette keys this codebase actually defines
 * (`critical`, `red`, `green`, `orange`, `yellow`, `blue`, …) don't line
 * up 1:1 with every severity string, so a small explicit map is the honest
 * source.
 */
const SEVERITY_BADGE_COLOR: Record<ActivityLogRow['severity'], string> = {
	critical: 'critical',
	high: 'orange',
	medium: 'yellow',
	low: 'blue',
	info: 'yellow',
};

/**
 * Today's whole Activity.tsx page body, extracted verbatim (functionality
 * completely unchanged) — moved here from the now-deleted src/pages/Activity/
 * folder since Activity's own native WP submenu row was already removed in
 * favor of exactly this kind of fold (see classes/Admin.php's
 * legacy_submenus() docblock).
 *
 * The `event_type` column is a real `type: 'info'` column now, with the
 * row's own real message moved into `descriptionKey` (rendered as the
 * sub-line under the title) and both the actor and severity collapsed into
 * `badgesKey` — so the row reads as:
 *
 *   [icon]  Event title                                 [User] [High]
 *           Real message text from activity-logs
 *
 * `created_at` stays its own real date column, sorted newest-first by
 * default (unchanged).
 */
const ActivityTab = () => {
	const actorTypeOptions = [
		{ label: __('User', 'vulopilot'), value: 'user' },
		{ label: __('System', 'vulopilot'), value: 'system' },
		{ label: __('Automation', 'vulopilot'), value: 'automation' },
	];

	const {
		data,
		total,
		categoryCounts,
		isLoading,
		error,
		refetch,
		onQueryUpdate,
	} = useApiList<ActivityLogRow>(
		'activity-logs',
		{},
		{ key: 'actor_type', options: actorTypeOptions }
	);

	return (
		<ColumnComponent>
			{error ? (
				<CardComponent
					title={__('Activity', 'vulopilot')}
					titleIcon="error"
					desc={__('A log of automated changes made on this site.', 'vulopilot')}
				>
					<ModuleGuardComponent
						icon="error"
						title={__(
							'Could not load the activity log',
							'vulopilot'
						)}
						desc={error}
						buttonText={__('Retry', 'vulopilot')}
						onButtonClick={refetch}
					/>
				</CardComponent>
			) : (
				<TableCard
					search={{
						placeholder: __('Search activity…', 'vulopilot'),
					}}
					hideHeader={true}

					format={appLocalizer.date_format_js}
					headers={{
						event_type: {
							key: 'event_type',
							type: 'info',
							label: __('Activity', 'vulopilot'),
							// Real icon per actor type + real message as
							// this row's own sub-line, then both real
							// badges (actor + severity) on the trailing
							// edge.
							iconKey: 'typeIcon',
							descriptionKey: 'descriptionText',
							badgesKey: 'typeBadges',
						},
						created_at: {
							label: __('When', 'vulopilot'),
							type: 'date',
							isSortable: true,
							defaultSort: true,
							defaultOrder: 'desc',
						},
					}}
					rows={data.map((row) => ({
						...row,
						// Real icon derived from the row's own real
						// `actor_type` — the same signal the removed
						// separate `Actor` column used to spell out
						// textually.
						typeIcon:
							ACTOR_TYPE_ICON[row.actor_type] ?? 'module green',
						// Real message from `activity-logs` — the same
						// string the removed separate `Details` column
						// used to show, now rendered as the info column's
						// own description sub-line.
						descriptionText: row.message,
						// Real `badgesKey` array: actor first, then
						// severity — one row shows who did it and how
						// urgent it is, same as the removed `Actor` +
						// `Severity` columns did side-by-side.
						typeBadges: [
							{
								text:
									ACTOR_TYPE_LABEL[row.actor_type] ??
									row.actor_type,
								color: 'blue',
							},
							{
								text: row.severity,
								color:
									SEVERITY_BADGE_COLOR[row.severity] ??
									'yellow',
							},
						],
					}))}
					ids={data.map((row) => row.id)}
					totalRows={total}
					categoryCounts={categoryCounts}
					isLoading={isLoading}
					onQueryUpdate={onQueryUpdate}
					emptyMessage={__(
						'Nothing has happened yet — actions across VuloPilot will show up here.',
						'vulopilot'
					)}
				/>
			)}
		</ColumnComponent>
	);
};

export default ActivityTab;