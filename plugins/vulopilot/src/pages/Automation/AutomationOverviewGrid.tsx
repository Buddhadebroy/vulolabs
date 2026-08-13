import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent } from '@zyra/components';
import { useApiList } from '../../services/useApiList';
import { formatWpDate } from '../../services/formatWpDate';
import {
	TRIGGER_TYPE_LABELS,
	ACTION_TYPE_LABELS,
	SCHEDULE_TRIGGER_TYPES,
} from './automationLabels';

interface AutomationRow {
	id: number;
	name: string;
	trigger_type: string;
	status: 'enabled' | 'disabled';
	last_triggered_at: string | null;
	actions: string;
}

interface ActionConfigRow {
	type: string;
}

// Every value here is a confirmed real adminfont- glyph already used
// elsewhere in this codebase — 'email'/'notification'/'clock' aren't
// (grepped, no such classes exist), so this avoids silently rendering a
// blank icon for an unconfirmed class name.
const ACTION_TYPE_ICONS: Record<string, string> = {
	'send-email': 'export',
	'resolve-finding': 'check',
	'run-ai-action': 'ai',
	'create-notification': 'update',
};

const MAX_CARDS = 4;

interface AutomationOverviewGridProps {
	onManageAutomations: () => void;
}

/**
 * "What VuloPilot is doing for you" — the mockup shows 4 specific,
 * named preset automations (Website Check, Security Watch, Search Watch,
 * Monthly Website Report) that don't exist anywhere in this codebase (no
 * seeded/built-in automations — every row in `vulopilot_automations` is
 * one the user created themselves). Real equivalent: the user's own
 * automations (`GET /automations`, same list every other card on this
 * page reads — own copy per this codebase's established "duplicate small
 * per-file hooks" convention), enabled ones first, restyled into this
 * mockup's card shape. Icon is picked from the automation's first real
 * configured action; the status pill reflects its real enabled/disabled
 * state; the description is built from its real trigger + action labels
 * rather than invented copy. "Runs:" shows the real cadence only for
 * schedule-based triggers (Hourly/Daily/Weekly/Monthly) — for event
 * triggers it shows what real event fires it instead. The mockup's
 * "Next check: <date>" has no real backing anywhere (no REST surface
 * exposes wp-cron's actual next-run timestamp — same gap
 * UpcomingJobsCard.tsx's own docblock already documented before this
 * card replaced it), so it's omitted rather than fabricated. "Last
 * check" is the real `last_triggered_at`. Replaces ActiveWorkflowCard.tsx
 * (single most-recent-automation detail) and UpcomingJobsCard.tsx
 * (schedule-only sidebar list) — both folded into this one real grid
 * instead of three overlapping views of the same `automations` list.
 */
const AutomationOverviewGrid = ({
	onManageAutomations,
}: AutomationOverviewGridProps) => {
	const { data, isLoading, total } = useApiList<AutomationRow>('automations', {
		per_page: 100,
	});

	if (isLoading) {
		return null;
	}

	if (0 === data.length) {
		return (
			<CardComponent className="automation-overview-grid-card">
				<h3 className="automation-overview-grid-title">
					{__('What VuloPilot is doing for you', 'vulopilot')}
				</h3>
				<ModuleGuardComponent
					icon="automation"
					title={__('No automations yet', 'vulopilot')}
					desc={__(
						'Create an automation below and it will show up here.',
						'vulopilot'
					)}
					buttonText={__('Create Automation', 'vulopilot')}
					onButtonClick={onManageAutomations}
				/>
			</CardComponent>
		);
	}

	const cards = [...data]
		.sort((a, b) => {
			if (a.status !== b.status) {
				return 'enabled' === a.status ? -1 : 1;
			}

			return (b.last_triggered_at ?? '').localeCompare(
				a.last_triggered_at ?? ''
			);
		})
		.slice(0, MAX_CARDS);

	return (
		<CardComponent className="automation-overview-grid-card">
			<div className="automation-overview-grid-header">
				<h3 className="automation-overview-grid-title">
					{__('What VuloPilot is doing for you', 'vulopilot')}
				</h3>
				{total > MAX_CARDS && (
					<span
						className="automation-overview-grid-view-all"
						role="button"
						tabIndex={0}
						onClick={onManageAutomations}
					>
						{__('View all →', 'vulopilot')}
					</span>
				)}
			</div>
			<div className="automation-overview-grid">
				{cards.map((automation) => {
					let actionLabels: string[] = [];
					let firstActionType = '';

					try {
						const parsed = JSON.parse(
							automation.actions
						) as ActionConfigRow[];
						actionLabels = parsed.map(
							(action) => ACTION_TYPE_LABELS[action.type] ?? action.type
						);
						firstActionType = parsed[0]?.type ?? '';
					} catch {
						actionLabels = [];
					}

					const isSchedule = SCHEDULE_TRIGGER_TYPES.includes(
						automation.trigger_type
					);
					const triggerLabel =
						TRIGGER_TYPE_LABELS[automation.trigger_type] ??
						automation.trigger_type;

					return (
						<div
							className="automation-overview-card"
							key={automation.id}
						>
							<div className="automation-overview-card-header">
								<span className="automation-overview-card-icon">
									<i
										className={`adminfont-${ACTION_TYPE_ICONS[firstActionType] ?? 'automation'}`}
									/>
								</span>
								<strong>{automation.name}</strong>
								<span
									className={`admin-badge ${'enabled' === automation.status ? 'green' : 'indigo'}`}
								>
									{'enabled' === automation.status
										? __('Active', 'vulopilot')
										: __('Inactive', 'vulopilot')}
								</span>
							</div>
							<p className="automation-overview-card-desc">
								{actionLabels.length > 0
									? sprintf(
											/* translators: %s is a comma-separated list of real action labels, e.g. "Send email, Resolve finding". */
											__('Does: %s', 'vulopilot'),
											actionLabels.join(', ')
										)
									: __(
											'No actions configured yet.',
											'vulopilot'
										)}
							</p>
							<div className="automation-overview-card-row">
								<i className="adminfont-refresh" />
								<span>
									{sprintf(
										/* translators: %s is the trigger label, e.g. "Weekly" or "Order completed". */
										isSchedule
											? __('Runs: %s', 'vulopilot')
											: __('Runs on: %s', 'vulopilot'),
										triggerLabel
									)}
								</span>
							</div>
							<div className="automation-overview-card-footer">
								<span className="automation-overview-card-last-check">
									{automation.last_triggered_at
										? sprintf(
												/* translators: %s is a formatted date. */
												__('Last check: %s', 'vulopilot'),
												formatWpDate(
													automation.last_triggered_at
												)
											)
										: __('Never run yet', 'vulopilot')}
								</span>
								<span
									className="automation-overview-card-manage"
									role="button"
									tabIndex={0}
									onClick={onManageAutomations}
								>
									{__('Manage →', 'vulopilot')}
								</span>
							</div>
						</div>
					);
				})}
			</div>
		</CardComponent>
	);
};

export default AutomationOverviewGrid;
