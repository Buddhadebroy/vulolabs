import React from 'react';
import { __ } from '@wordpress/i18n';
import { Segmented } from '../ui';

// `'all'` has no tile of its own; it's kept only as a state value.
export type Priority = 'all' | 'high' | 'medium' | 'low';

interface IssuesSummaryCardsProps {
	activePriority: Priority;
	// eslint-disable-next-line no-unused-vars
	onSelectPriority: (priority: Priority) => void;
}

/** Same "Any priority / High / Medium / Low" pill filter IssuesList.tsx's own Segmented control already uses. */
const IssuesSummaryCards: React.FC<IssuesSummaryCardsProps> = ({ activePriority, onSelectPriority }) => (
	<div className="issues-summary-cards">
		<Segmented
			label={__('Priority', 'vulopilot')}
			size="sm"
			value={activePriority}
			onChange={(next) => onSelectPriority(next as Priority)}
			options={[
				{ value: 'all', label: __('Any priority', 'vulopilot') },
				{ value: 'high', label: __('High', 'vulopilot') },
				{ value: 'medium', label: __('Medium', 'vulopilot') },
				{ value: 'low', label: __('Low', 'vulopilot') },
			]}
		/>
	</div>
);

export default IssuesSummaryCards;