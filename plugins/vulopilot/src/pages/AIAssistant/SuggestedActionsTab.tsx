import { __ } from '@wordpress/i18n';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	InformationItemComponent,
} from '@zyra/components';
import { SUGGESTED_ACTIONS } from './copilotData';

/**
 * Full-width version of the Chat tab sidebar's "Suggested Actions"
 * preview — same data/rows, just untruncated. The mockup doesn't show
 * this tab's own design, so this reuses the already-built list instead of
 * inventing an unseen layout.
 */
const SuggestedActionsTab = () => (
	<ContainerComponent general>
		<ColumnComponent>
			<CardComponent
				title={__('Suggested Actions', 'vulopilot')}
				titleIcon="ai"
			>
				{SUGGESTED_ACTIONS.map((action) => (
					<InformationItemComponent
						key={action.id}
						title={action.title}
						avatar={{ iconClass: action.icon, color: action.color }}
						descriptions={[{ value: action.desc }]}
						rightContent={<i className="adminfont-arrow-right" />}
					/>
				))}
			</CardComponent>
		</ColumnComponent>
	</ContainerComponent>
);

export default SuggestedActionsTab;
