/* global appLocalizer */
import { useState } from 'react';
import type { ComponentType, FC } from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent, PopupComponent, SectionComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import ShowProPopup from '../../components/Popup/Popup';
import { useFilterSlot } from '../../services/useFilterSlot';
import { IssuesFilter } from './NeedsAttentionCard';
import './AICopilot.scss';

interface RecommendedActionsCardProps {
	// eslint-disable-next-line no-unused-vars -- named params on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onNavigateTab: (tab: string, filter?: IssuesFilter) => void;
}

/**
 * AI Copilot's "Recommended by VuloPilot" card — real, direct-instruction
 * Pro feature now (moved into vulopilot-pro's own CopilotChat module,
 * `modules/CopilotChat/src/RecommendedActionsCard.tsx`, registered via the
 * `vulopilot_ai_copilot_recommended_actions` filter below — same
 * `useFilterSlot()`/locked-placeholder shape AiAnalyticsLockedCard
 * (Reports/HistoryTab.tsx) already established for a Pro panel slot). The
 * real per-bucket cards (`GET /findings/attention-summary`'s own
 * `recommendations`) now render from Pro's own code, not this file's — this
 * file only decides which of the two to show. Section still renders in Free
 * (per this app's own "show in free with a PRO tag" convention — see
 * useCopilotChat.ts's own docblock for the identical instruction already
 * applied to "Chat with VuloPilot"), just as a locked teaser
 * (`RecommendedActionsLockedCard` below) with a real "Unlock with Pro"
 * popup on click when the module isn't active yet, instead of a bare
 * upsell banner.
 */
const RecommendedActionsLockedCard = () => {
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);

	return (
		<>
			<SectionComponent
				title={__('Recommended by VuloPilot', 'vulopilot')}
				desc={__('High impact actions suggested by AI', 'vulopilot')}
			/>
			<CardComponent
				title={__('AI-prioritized fixes for your site', 'vulopilot')}
				titleIcon="lock"
				badges={[{ text: __('PRO', 'vulopilot'), color: 'purple' }]}
				desc={__(
					'Security, performance, and AI-visibility issues — surfaced and ranked by AI the moment Chat with VuloPilot is unlocked.',
					'vulopilot'
				)}
			>
				<ButtonInput
					buttons={{
						text: __('Unlock with Pro', 'vulopilot'),
						icon: 'lock',
						onClick: () => setIsProPopupOpen(true),
					}}
				/>
			</CardComponent>
			<PopupComponent
				open={isProPopupOpen}
				onClose={() => setIsProPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{appLocalizer.khali_dabba ? (
					// Pro is active — this specific module just isn't
					// toggled on yet, so point at Modules rather than
					// pitching an upgrade the user already has.
					<ShowProPopup moduleName="copilot-chat" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</>
	);
};

const RecommendedActionsCard: FC<RecommendedActionsCardProps> = ({ onNavigateTab }) => {
	const ProRecommendedActionsCard = useFilterSlot<
		ComponentType<RecommendedActionsCardProps>
	>('vulopilot_ai_copilot_recommended_actions');

	if (ProRecommendedActionsCard) {
		return <ProRecommendedActionsCard onNavigateTab={onNavigateTab} />;
	}

	return <RecommendedActionsLockedCard />;
};

export default RecommendedActionsCard;
