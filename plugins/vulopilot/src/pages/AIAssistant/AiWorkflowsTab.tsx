import { __ } from '@wordpress/i18n';
import { CardComponent, ColumnComponent, ContainerComponent } from '@zyra/components';
import AiWorkflowsList from './AiWorkflowsList';

/**
 * Full-width version of the Chat tab sidebar's "AI Workflows" preview —
 * same live `/automations` data, just untruncated.
 */
const AiWorkflowsTab = () => (
	<ContainerComponent>
		<CardComponent title={__('AI Workflows', 'vulopilot')} titleIcon="ai">
			<AiWorkflowsList />
		</CardComponent>
	</ContainerComponent>
);

export default AiWorkflowsTab;
