import React from 'react';
import { __ } from '@wordpress/i18n';
import { TooltipComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import OpenIssuesGlimpse from '../../components/OpenIssuesGlimpse';
import AiCopilotGuard from '../../components/AiCopilotGuard';
import './SeoVisibility.scss';

interface AiOpportunitiesCardProps {
	onNavigateTab: (tab: 'geo' | 'aeo') => void;
}

/**
 * "AI Opportunities" — the mockup's checklist of fixable issues. Reuses
 * OpenIssuesGlimpse's real `/findings` data (same category 'geo' data the
 * GEO/AEO tabs already glimpse) rather than a second parallel fetch.
 * Clicking a row switches to the GEO tab (`onItemClick`) instead of the
 * component's own default same-page scroll-and-highlight, since Overview
 * has no `geo-section-*` anchors of its own for the GEO tab's sections —
 * those only exist once that tab is actually mounted.
 *
 * "Fix Everything with AI" has no real backend anywhere in this codebase
 * (no bulk-fix/action-trigger endpoint exists — confirmed while building
 * AI Copilot's own honestly-disabled send button/workflow-run button), so
 * it's rendered visibly but inert with a tooltip, same pattern. The
 * findings glimpse itself is real, non-AI functionality and stays visible
 * regardless of module state — only the AI-branded footer action is
 * gated on the real AI Copilot module (AiCopilotGuard).
 */
const AiOpportunitiesCard: React.FC<AiOpportunitiesCardProps> = ({
	onNavigateTab,
}) => (
	<OpenIssuesGlimpse
		category="geo"
		titleIcon="ai"
		title={__('AI Opportunities', 'vulopilot')}
		onItemClick={() => onNavigateTab('geo')}
		emptyTitle={__("You're all caught up", 'vulopilot')}
		emptyDesc={__('No open GEO/AEO findings right now.', 'vulopilot')}
		footer={
			<AiCopilotGuard
				title={__('AI Copilot is turned off', 'vulopilot')}
				desc={__(
					'Turn the AI Copilot module back on from Settings → Modules to use AI-powered opportunities.',
					'vulopilot'
				)}
			>
				<TooltipComponent
					text={__(
						"Bulk auto-fix isn't available yet — there's no AI action-trigger engine wired up. Fix findings individually from the GEO/AEO tabs.",
						'vulopilot'
					)}
				>
					<ButtonInput
						buttons={{
							text: __('Fix Everything with AI', 'vulopilot'),
							icon: 'ai',
							color: 'orange-bg',
							disabled: true,
							onClick: () => {},
						}}
					/>
				</TooltipComponent>
			</AiCopilotGuard>
		}
	/>
);

export default AiOpportunitiesCard;
