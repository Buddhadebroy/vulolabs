import { __ } from '@wordpress/i18n';
import { CardComponent, ColumnComponent, ContainerComponent } from '@zyra/components';
import SuggestedActionsList from './SuggestedActionsList';

/**
 * Full-width version of the Chat tab sidebar's "Suggested Actions"
 * preview — same live `/findings` data, just untruncated.
 */
const SuggestedActionsTab = () => (
	<ContainerComponent general>
		<ColumnComponent>
			<CardComponent
				title={__('Suggested Actions', 'vulopilot')}
				titleIcon="ai"
			>
				<SuggestedActionsList />
			</CardComponent>
		</ColumnComponent>
	</ContainerComponent>
);

export default SuggestedActionsTab;
