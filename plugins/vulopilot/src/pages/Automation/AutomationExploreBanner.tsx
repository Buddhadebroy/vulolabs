import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';

interface AutomationExploreBannerProps {
	onExplore: () => void;
}

/**
 * The mockup's closing "Want VuloPilot to do more?" banner — pure copy
 * and a real navigation (scrolls to the actual automation-creation form,
 * same destination every other "Create"/"Manage" action on this page
 * already uses), no data to back or fabricate.
 */
const AutomationExploreBanner = ({ onExplore }: AutomationExploreBannerProps) => (
	<CardComponent className="automation-explore-banner">
		<span className="automation-explore-icon">
			<i className="adminfont-plus-circle" />
		</span>
		<div className="automation-explore-body">
			<strong>{__('Want VuloPilot to do more?', 'vulopilot')}</strong>
			<p>
				{__(
					'Add more automations to stay ahead of issues, opportunities and performance changes.',
					'vulopilot'
				)}
			</p>
		</div>
		<ButtonInput
			buttons={{
				text: __('Explore Automations →', 'vulopilot'),
				onClick: onExplore,
			}}
		/>
	</CardComponent>
);

export default AutomationExploreBanner;
