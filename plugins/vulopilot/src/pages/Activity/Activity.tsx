/* global appLocalizer */
import { __ } from '@wordpress/i18n';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
	NavigatorHeaderComponent,
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

const Activity = () => {
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
		<>
			<NavigatorHeaderComponent
				headerIcon="clock"
				headerTitle={__('Activity', 'vulopilot')}
				headerDescription={__(
					'Every action VuloPilot has taken or logged, across scans, automations, and AI actions.',
					'vulopilot'
				)}
			/>
			<ContainerComponent general>
				<ColumnComponent>
					{error ? (
						<CardComponent title={__('Activity', 'vulopilot')}>
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
							format={appLocalizer.date_format_js}
							headers={{
								event_type: {
									label: __('Event', 'vulopilot'),
									isSortable: true,
								},
								message: {
									label: __('Details', 'vulopilot'),
								},
								actor_type: {
									label: __('Actor', 'vulopilot'),
								},
								severity: {
									label: __('Severity', 'vulopilot'),
									type: 'badge',
									statusClass: (row: ActivityLogRow) =>
										`severity-${row.severity}`,
								},
								created_at: {
									label: __('When', 'vulopilot'),
									type: 'date',
									isSortable: true,
									defaultSort: true,
									defaultOrder: 'desc',
								},
							}}
							rows={data}
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
			</ContainerComponent>
		</>
	);
};

export default Activity;
