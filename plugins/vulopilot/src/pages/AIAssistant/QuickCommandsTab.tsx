import React from 'react';
import { __ } from '@wordpress/i18n';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	ListComponent,
} from '@zyra/components';
import { SUGGESTED_PROMPTS } from './copilotData';

interface QuickCommandsTabProps {
	onSelect: (prompt: string) => void;
}

/**
 * Full-width version of the Chat tab's "Try asking me…" prompt grid —
 * same data, just its own tab. Selecting a command switches back to Chat
 * with the prompt pre-filled, same as clicking a chip inline in Chat
 * would do.
 */
const QuickCommandsTab: React.FC<QuickCommandsTabProps> = ({ onSelect }) => (
	<ColumnComponent>
		<CardComponent
			title={__('Quick Commands', 'vulopilot')}
			titleIcon="ai"
		>
			<ListComponent
				className="chip-grid"
				items={SUGGESTED_PROMPTS.map((prompt) => ({
					id: prompt.id,
					icon: prompt.icon,
					title: prompt.title,
					action: () => onSelect(prompt.title),
				}))}
			/>
		</CardComponent>
	</ColumnComponent>
);

export default QuickCommandsTab;
