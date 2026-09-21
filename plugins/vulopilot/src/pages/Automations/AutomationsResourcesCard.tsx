import { __ } from '@wordpress/i18n';
import { CardComponent, ListComponent } from '@zyra/components';

const DOCS_URL =
	'https://vulolabs.com/docs/knowledgebase/?utm_source=wpadmin&utm_medium=automations&utm_campaign=vulopilot';

interface AutomationsResourcesCardProps {
	/** Opens the same create-automation flow the header's "Create Automation" button does (Pro wizard, or the upgrade popup when Pro isn't active). */
	onCreateCustom: () => void;
}

/**
 * "Helpful resources" — 3 quick links, per the redesigned Automations
 * mockup. The 2 docs rows open the plugin's own knowledge base (same URL
 * GettingStartedCard.tsx already links to); "Create custom automations"
 * reuses the page's own real create flow rather than a link.
 */
const AutomationsResourcesCard = ( { onCreateCustom }: AutomationsResourcesCardProps ) => {
	const openDocs = () => window.open( DOCS_URL, '_blank', 'noopener,noreferrer' );

	const items = [
		{
			id: 'how-automations-work',
			icon: 'document purple',
			title: __( 'How automations work', 'vulopilot' ),
			desc: __( 'Understand triggers, actions, and scheduling.', 'vulopilot' ),
			action: openDocs,
		},
		{
			id: 'email-reports',
			icon: 'mail purple',
			title: __( 'Setting up email reports', 'vulopilot' ),
			desc: __( 'Receive insights directly in your inbox.', 'vulopilot' ),
			action: openDocs,
		},
		{
			id: 'custom-automations',
			icon: 'ai purple',
			title: __( 'Create custom automations', 'vulopilot' ),
			desc: __( 'Use AI to build automations for your specific needs.', 'vulopilot' ),
			action: onCreateCustom,
		},
	];

	return (
		<CardComponent
			title={ __( 'Helpful resources', 'vulopilot' ) }
			titleIcon="document"
			desc={ __( 'Learn more about automations and get started quickly.', 'vulopilot' ) }
		>
			<ListComponent
				className="mini-card report hover"
				items={ items.map( ( item ) => ( {
					id: item.id,
					icon: item.icon,
					title: item.title,
					desc: item.desc,
					tags: <i className="adminfont-pagination-right-arrow" />,
					action: item.action,
				} ) ) }
			/>
		</CardComponent>
	);
};

export default AutomationsResourcesCard;
