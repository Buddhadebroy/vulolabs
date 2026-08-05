import React from 'react';
import { __ } from '@wordpress/i18n';
import './AICopilot.scss';
import {
	InformationItemComponent,
	ModuleGuardComponent,
	TooltipComponent,
} from '@zyra/components';
import { useApiList } from '../../services/useApiList';

interface AutomationRow {
	id: number;
	name: string;
	status: 'enabled' | 'disabled';
}

interface AiWorkflowsListProps {
	/** Row cap — omit for the full "AI Workflows" tab. */
	limit?: number;
}

const RUN_DISABLED_REASON = __(
	"Running a workflow on demand isn't available yet — there's no trigger→action execution engine wired up.",
	'vulopilot'
);

/**
 * Real automations (`GET /automations`, same endpoint
 * src/pages/Automation/Automation.tsx and AutomationStatusWidget.tsx
 * already use), rendered as the mockup's icon box + name + status row.
 * The mockup's per-row "run now" play button has no real backend
 * (`POST /automations/{id}/run` deliberately returns 501 — no
 * trigger→action engine exists in this codebase yet), so it's rendered
 * visibly but inert with a tooltip explaining why, same
 * honest-disabled-affordance pattern the Dashboard's Recent Changes
 * widget already uses for its own "Undo" control.
 */
const AiWorkflowsList: React.FC<AiWorkflowsListProps> = ({ limit }) => {
	const { data, isLoading, error, refetch } = useApiList<AutomationRow>(
		'automations',
		{ per_page: limit ?? 20 }
	);

	if (error) {
		return (
			<ModuleGuardComponent
				icon="error"
				title={__('Could not load workflows', 'vulopilot')}
				desc={error}
				buttonText={__('Retry', 'vulopilot')}
				onButtonClick={refetch}
			/>
		);
	}

	if (isLoading) {
		return (
			<>
				{Array.from({ length: limit ?? 4 }).map((_, index) => (
					<InformationItemComponent key={index} title="" isLoading />
				))}
			</>
		);
	}

	if (data.length === 0) {
		return (
			<ModuleGuardComponent
				icon="automation"
				title={__('No workflows yet', 'vulopilot')}
				desc={__(
					'Create one from the Automation page to react to scan findings automatically.',
					'vulopilot'
				)}
			/>
		);
	}

	return (
		<>
			{data.map((workflow) => (
				<InformationItemComponent
					key={workflow.id}
					title={workflow.name}
					avatar={{
						iconClass: 'automation',
						color:
							workflow.status === 'enabled'
								? '#16a34a'
								: '#9ca3af',
					}}
					descriptions={[
						{
							value:
								workflow.status === 'enabled'
									? __('Enabled', 'vulopilot')
									: __('Disabled', 'vulopilot'),
						},
					]}
					rightContent={
						<TooltipComponent text={RUN_DISABLED_REASON}>
							<span
								role="button"
								aria-disabled="true"
								className="ai-workflow-run-btn disabled"
							>
								<span className="dashicons dashicons-controls-play" />
							</span>
						</TooltipComponent>
					}
				/>
			))}
		</>
	);
};

export default AiWorkflowsList;
