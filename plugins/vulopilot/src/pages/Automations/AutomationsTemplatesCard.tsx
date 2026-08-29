import React from 'react';
import { __ } from '@wordpress/i18n';
import { SectionComponent, ListComponent, CardComponent } from '@zyra/components';
import { AUTOMATION_TEMPLATES, AutomationTemplate } from './automationsTemplates';

interface AutomationsTemplatesCardProps {
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onSelectTemplate: (template: AutomationTemplate) => void;
}

/**
 * "Create new automation" — a real entry point into Automate Work's
 * existing create-automation flow, not a decorative mockup. Deliberately
 * dumb about what a click actually does: this card's only job is picking a
 * template and calling `onSelectTemplate`, since that differs by host page
 * (`ManageAutomationsSection.tsx`, its proper home, opens the real create
 * form in place; `ChatTab.tsx`'s preview navigates to Automate Work first —
 * see each host's own `onSelectTemplate` for the real behavior).
 */
const AutomationsTemplatesCard: React.FC<AutomationsTemplatesCardProps> = ({
	onSelectTemplate,
}) => (
		<div id="create-new-automation-card">
		<CardComponent
			title={ __( 'Create new automation', 'vulopilot-pro' ) } titleIcon="analytics"
			desc={ __( 'Start from a ready-made template instead of building one from scratch.', 'vulopilot-pro' ) }
		>
			<ListComponent
				className="mini-card report"
				items={AUTOMATION_TEMPLATES.map((template) => ({
					id: template.id,
					icon: template.icon,
					title: template.label,
					desc: template.description,
					tags: (
						<i className="adminfont-pagination-right-arrow ai-copilot-row-arrow" />
					),
					action: () => onSelectTemplate(template),
				}))}
			/>
		</CardComponent>
		</div>
);

export default AutomationsTemplatesCard;
