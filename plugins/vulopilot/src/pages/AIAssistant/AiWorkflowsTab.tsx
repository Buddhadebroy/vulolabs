import { __ } from '@wordpress/i18n';
import './AICopilot.scss';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	InformationItemComponent,
} from '@zyra/components';
import { AI_WORKFLOWS } from './copilotData';

/**
 * Full-width version of the Chat tab sidebar's "AI Workflows" preview —
 * same data/rows, just untruncated. The mockup doesn't show this tab's
 * own design, so this reuses the already-built list instead of inventing
 * an unseen layout.
 */
const AiWorkflowsTab = () => (
	<ContainerComponent general>
		<ColumnComponent>
			<CardComponent title={__('AI Workflows', 'vulopilot')} titleIcon="ai">
				{AI_WORKFLOWS.map((workflow) => (
					<InformationItemComponent
						key={workflow.id}
						title={workflow.title}
						avatar={{
							iconClass: workflow.icon,
							color: workflow.color,
						}}
						descriptions={[{ value: workflow.desc }]}
						rightContent={
							<button
								type="button"
								className="ai-workflow-run-btn"
								aria-label={__('Run now', 'vulopilot')}
							>
								<span className="dashicons dashicons-controls-play" />
							</button>
						}
					/>
				))}
			</CardComponent>
		</ColumnComponent>
	</ContainerComponent>
);

export default AiWorkflowsTab;
