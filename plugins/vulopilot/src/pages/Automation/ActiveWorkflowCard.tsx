import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent } from '@zyra/components';
import { useApiList } from '../../services/useApiList';
import { formatWpDate } from '../../services/formatWpDate';
import { TRIGGER_TYPE_LABELS, ACTION_TYPE_LABELS } from './automationLabels';

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

/**
 * The mockup's "Active AI Workflow" shows a fabricated 7-step sequence
 * (Scan Site → Update Plugins → ... → Email Me) with per-step checkmarks —
 * no such step-by-step data model exists anywhere (an automation is a flat
 * action list, executed atomically in one request, not a multi-stage
 * pipeline with independently-timestamped stages). This instead shows the
 * real most-recently-triggered enabled automation: its real name, trigger,
 * real configured actions (decoded from its own `actions` column), and
 * real last-run date.
 */
const ActiveWorkflowCard = () => {
	const { data, isLoading } = useApiList<AutomationRow>('automations', {
		per_page: 100,
	});

	if (isLoading) {
		return null;
	}

	const active = data
		.filter(
			(automation) =>
				automation.status === 'enabled' && automation.last_triggered_at
		)
		.sort((a, b) =>
			(b.last_triggered_at ?? '').localeCompare(a.last_triggered_at ?? '')
		)[0];

	if (!active) {
		return (
			<CardComponent
				className="active-workflow-card"
				titleIcon="automation"
				title={__('Active Workflow', 'vulopilot')}
			>
				<ModuleGuardComponent
					icon="automation"
					title={__('No automation has run yet', 'vulopilot')}
					desc={__(
						'Once an enabled automation fires, its most recent run will show up here.',
						'vulopilot'
					)}
				/>
			</CardComponent>
		);
	}

	let actionLabels: string[] = [];
	try {
		actionLabels = (JSON.parse(active.actions) as ActionConfigRow[]).map(
			(action) => ACTION_TYPE_LABELS[action.type] ?? action.type
		);
	} catch {
		actionLabels = [];
	}

	return (
		<CardComponent
			className="active-workflow-card"
			titleIcon="automation"
			title={__('Active Workflow', 'vulopilot')}
		>
			<div className="active-workflow-header">
				<span className="admin-badge green">
					{__('Enabled', 'vulopilot')}
				</span>
				<strong>{active.name}</strong>
			</div>
			<p className="active-workflow-trigger">
				{sprintf(
					/* translators: %s: trigger type label, e.g. "Daily" */
					__('Trigger: %s', 'vulopilot'),
					TRIGGER_TYPE_LABELS[active.trigger_type] ?? active.trigger_type
				)}
			</p>
			<ol className="active-workflow-steps">
				{actionLabels.map((label, index) => (
					<li key={index}>
						<i className="adminfont-check" />
						{label}
					</li>
				))}
			</ol>
			<p className="active-workflow-last-run">
				{sprintf(
					/* translators: %s: formatted date */
					__('Last ran %s', 'vulopilot'),
					formatWpDate(active.last_triggered_at)
				)}
			</p>
		</CardComponent>
	);
};

export default ActiveWorkflowCard;
