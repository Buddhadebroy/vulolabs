import React from 'react';
import { __ } from '@wordpress/i18n';
import { SectionComponent, ListComponent, CardComponent } from '@zyra/components';
import { useContentGate } from '../../services/useContentGate';
import { AUTOMATION_TEMPLATES, AutomationTemplate } from './automationsTemplates';

interface AutomationsTemplatesCardProps {
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onSelectTemplate: (template: AutomationTemplate) => void;
	/**
	 * Whether Automations Pro's own real wizard is actually wired up
	 * (`vulopilot_automations_panel` filter slot's `Wizard`) — passed
	 * through to useContentGate.tsx's own `isModuleActive` escape hatch
	 * below, since this card's real "is it active" check isn't a plain
	 * `active_modules.includes('automations')` lookup (see that hook's
	 * own docblock for why that escape hatch exists).
	 */
	isAutomationsActive: boolean;
}

/**
 * "Create new automation" — a real entry point into Automate Work's
 * existing create-automation flow, not a decorative mockup. Deliberately
 * dumb about what a click actually does: this card's only job is picking a
 * template and calling `onSelectTemplate`, since that differs by host page
 * (`ManageAutomationsSection.tsx`, its proper home, opens the real create
 * form in place; `ChatTab.tsx`'s preview navigates to Automate Work first —
 * see each host's own `onSelectTemplate` for the real behavior).
 *
 * Real content is gated behind useContentGate.tsx's own 3 real checks —
 * VuloCloud account login, then Pro, then the `automations` module — same
 * "log in check, then Pro, then module" order AiSpeedAssistantCard.tsx's
 * own 'ai-copilot' gate already uses, per direct instruction. Unlike that
 * card, the templates themselves aren't per-site data (just this plugin's
 * own static catalog), so the "locked" dummy content below is the exact
 * same list, just inert — nothing sensitive to hide, only the click-through
 * to worry about.
 */
const AutomationsTemplatesCard: React.FC<AutomationsTemplatesCardProps> = ({
	onSelectTemplate,
	isAutomationsActive,
}) => {
	const { wrap } = useContentGate('automations', isAutomationsActive);

	const templateListItems = AUTOMATION_TEMPLATES.map((template) => ({
		id: template.id,
		icon: template.icon,
		title: template.label,
		desc: template.description,
		tags: <i className="adminfont-plus ai-copilot-row-arrow" />,
	}));

	return (
		<div id="create-new-automation-card">
			<CardComponent
				title={ __( 'Create new automation', 'vulopilot-pro' ) } titleIcon="analytics"
				desc={ __( 'Start from a ready-made template instead of building one from scratch.', 'vulopilot-pro' ) }
			>
				{wrap(
					<ListComponent
						className="mini-card report"
						items={templateListItems.map((item, index) => ({
							...item,
							action: () => onSelectTemplate(AUTOMATION_TEMPLATES[index]),
						}))}
					/>,
					<ListComponent className="mini-card report" items={templateListItems} />
				)}
			</CardComponent>
		</div>
	);
};

export default AutomationsTemplatesCard;
