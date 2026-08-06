import React from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent, ColumnComponent, ContainerComponent } from '@zyra/components';
import { TRIGGER_TYPE_LABELS } from './automationLabels';

const SETTINGS_TAB_URL = '?page=vulopilot#&tab=settings';

interface AutomationLinksRowProps {
	onScrollToCreate: () => void;
}

/**
 * The mockup's row of 5 small link cards. "Automation Library" (120
 * ready-made automations) and "AI Agents" are dropped entirely — neither
 * has anything real to point to (not existing-but-inactive features,
 * nonexistent product concepts). "Scheduled Jobs" is folded into the
 * sidebar's UpcomingJobsCard instead of duplicated here. Only the 2 cards
 * with real substance stay, reframed honestly: Triggers (the real trigger
 * vocabulary) and Notifications (only email is real; the rest are marked
 * "Coming soon" rather than pretending they exist).
 */
const AutomationLinksRow = ({ onScrollToCreate }: AutomationLinksRowProps) => (
	<ContainerComponent>
		<ColumnComponent grid={6}>
			<CardComponent
				className="automation-link-card"
				titleIcon="setting"
				title={__('Triggers', 'vulopilot')}
			>
				<p className="automation-link-desc">
					{Object.values(TRIGGER_TYPE_LABELS)
						.filter(
							(label) =>
								label !== TRIGGER_TYPE_LABELS.manual &&
								label !== TRIGGER_TYPE_LABELS.rest
						)
						.join(', ')}
				</p>
				<a
					href="#automation-manage"
					className="automation-link-action"
					onClick={(event) => {
						event.preventDefault();
						onScrollToCreate();
					}}
				>
					{__('Manage Triggers', 'vulopilot')}{' '}
					<i className="adminfont-arrow-right" />
				</a>
			</CardComponent>
		</ColumnComponent>
		<ColumnComponent grid={6}>
			<CardComponent
				className="automation-link-card"
				titleIcon="notification"
				title={__('Notifications', 'vulopilot')}
			>
				<p className="automation-link-desc">
					<span className="admin-badge green">
						{__('Email', 'vulopilot')}
					</span>{' '}
					{__(
						'Slack, Teams, Discord — coming soon.',
						'vulopilot'
					)}
				</p>
				<a
					href={SETTINGS_TAB_URL}
					className="automation-link-action"
				>
					{__('Manage Channels', 'vulopilot')}{' '}
					<i className="adminfont-arrow-right" />
				</a>
			</CardComponent>
		</ColumnComponent>
	</ContainerComponent>
);

export default AutomationLinksRow;
