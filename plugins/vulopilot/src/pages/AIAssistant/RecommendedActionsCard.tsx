/* global appLocalizer */
import { useState } from 'react';
import type { ComponentType, FC } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { SectionComponent, CardComponent, ButtonInput } from '@zyra/components';
import { formatAffected } from './issuesTypes';
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
			<CardComponent
				title={__('Recommended by VuloPilot', 'vulopilot')}
				desc={__('High impact actions suggested by AI', 'vulopilot')}
			>
			<div className="recommended-actions-grid">
				{recommendations.map((rec) => {
					const meta = BUCKET_META[rec.bucket];
					const urgent = isUrgent(rec.severity);

					return (
						<div className={`recommended-actions-card tone-${meta.tone}`} key={rec.bucket}>
							<div className={`recommended-actions-details ${meta.tone}`}>
								<div className="recommended-actions-card-eyebrow">
									<i className={`recommended-actions-card-icon adminfont-${meta.icon}`} />
									<span>{urgent ? __('Critical', 'vulopilot') : meta.ctaFallback}</span>
								</div>
								<div className="recommended-actions-card-title">{rec.label}</div>
								<div className="recommended-actions-card-detail">
									{formatAffected(rec.count, rec.object_type)}
								</div>
							</div>
							<ButtonInput
								position = 'left'
								buttons={{
									text: urgent
										? __('Investigate with AI', 'vulopilot')
										: __('Improve with AI', 'vulopilot'),
									rightIcon: 'arrow-right',
									color: `text-${meta.tone}`,
									onClick: () =>
										onNavigateTab('chat', {
											scannerId: rec.scanner_id,
											label: rec.label,
											category: rec.category,
										}),
								}}
							/>
						</div>
					);
				})}
			</div>
			</CardComponent>
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
