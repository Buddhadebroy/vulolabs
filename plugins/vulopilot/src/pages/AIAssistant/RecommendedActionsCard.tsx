/* global appLocalizer */
import { useEffect, useState } from 'react';
import type { ComponentType, FC } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { BadgeComponent, PopupComponent, SectionComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import ShowProPopup from '../../components/Popup/Popup';
import { useFilterSlot } from '../../services/useFilterSlot';
import { formatAffected } from './issuesTypes';
import { IssuesFilter } from './NeedsAttentionCard';
import './AICopilot.scss';

interface RecommendedActionsCardProps {
	// eslint-disable-next-line no-unused-vars -- named params on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onNavigateTab: (tab: string, filter?: IssuesFilter) => void;
}

interface Recommendation {
	bucket: 'security' | 'performance' | 'ai-visibility';
	scanner_id: string;
	category: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
	count: number;
	object_type: string | null;
	label: string;
}

interface AttentionSummaryResponse {
	recommendations: Recommendation[];
}

const BUCKET_META: Record<
	Recommendation['bucket'],
	{ icon: string; tone: string; ctaFallback: string }
> = {
	security: { icon: 'security', tone: 'red', ctaFallback: __('Security', 'vulopilot') },
	performance: { icon: 'bar-chart', tone: 'green', ctaFallback: __('Performance', 'vulopilot') },
	'ai-visibility': { icon: 'geo-location', tone: 'teal', ctaFallback: __('AI Visibility', 'vulopilot') },
};

const isUrgent = (severity: Recommendation['severity']): boolean =>
	'critical' === severity || 'high' === severity;

/**
 * Free's own fallback render for "Recommended by VuloPilot" — shown only
 * when vulopilot-pro's own CopilotChat module isn't active (the
 * `useFilterSlot()` check in `RecommendedActionsCard` below). Reads the
 * same real, already-free `GET /findings/attention-summary` endpoint Pro's
 * own real card (`modules/CopilotChat/src/RecommendedActionsCard.tsx`)
 * does, and renders the identical real per-bucket cards — real labels,
 * real counts, not fabricated placeholder copy or a generic locked banner,
 * per direct instruction ("show the cards when click on cards then open
 * pro popup"). Only the CTA is gated: clicking a card opens the same real
 * "Unlock with Pro" popup every other Pro-gated surface in this plugin
 * uses, instead of the real `onNavigateTab('chat', filter)` jump Pro's own
 * card performs — a small "PRO" badge on each card makes that plain before
 * the click, not just after.
 */
const RecommendedActionsFreeCard: FC<RecommendedActionsCardProps> = () => {
	const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);

	useEffect(() => {
		getApiResponse<AttentionSummaryResponse>(
			getApiLink(appLocalizer, 'findings/attention-summary'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setRecommendations(response.recommendations ?? []);
				}
			})
			.finally(() => setIsLoading(false));
	}, []);

	if (!isLoading && 0 === recommendations.length) {
		return null;
	}

	return (
		<>
			<SectionComponent
				title={__('Recommended by VuloPilot', 'vulopilot')}
				desc={__('High impact actions suggested by AI', 'vulopilot')}
			/>
			<div className="recommended-actions-grid">
				{recommendations.map((rec) => {
					const meta = BUCKET_META[rec.bucket];
					const urgent = isUrgent(rec.severity);

					return (
						<div
							className={`recommended-actions-card tone-${meta.tone}`}
							key={rec.bucket}
							role="button"
							tabIndex={0}
							onClick={() => setIsProPopupOpen(true)}
							onKeyDown={(e) => {
								if ('Enter' === e.key || ' ' === e.key) {
									e.preventDefault();
									setIsProPopupOpen(true);
								}
							}}
						>
							<div className={`recommended-actions-details ${meta.tone}`}>
								<div className="recommended-actions-card-eyebrow">
									<i className={`recommended-actions-card-icon adminfont-${meta.icon}`} />
									<span>{urgent ? __('Critical', 'vulopilot') : meta.ctaFallback}</span>
									<BadgeComponent color="purple" text={__('PRO', 'vulopilot')} />
								</div>
								<div className="recommended-actions-card-title">{rec.label}</div>
								<div className="recommended-actions-card-detail">
									{formatAffected(rec.count, rec.object_type)}
								</div>
							</div>
							<ButtonInput
								position="left"
								buttons={{
									text: urgent
										? __('Investigate with AI', 'vulopilot')
										: __('Improve with AI', 'vulopilot'),
									rightIcon: 'arrow-right',
									color: `text-${meta.tone}`,
									onClick: () => setIsProPopupOpen(true),
								}}
							/>
						</div>
					);
				})}
			</div>
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

/**
 * AI Copilot's "Recommended by VuloPilot" card — real, direct-instruction
 * Pro feature (the real implementation lives in vulopilot-pro's own
 * CopilotChat module, `modules/CopilotChat/src/RecommendedActionsCard.tsx`,
 * registered via the `vulopilot_ai_copilot_recommended_actions` filter).
 * When that module is active, its own real card renders here unchanged
 * (real `onNavigateTab('chat', filter)` clicks included). Otherwise Free's
 * own `RecommendedActionsFreeCard` above renders the same real cards with
 * a "PRO" badge, opening the upgrade popup on click instead.
 */
const RecommendedActionsCard: FC<RecommendedActionsCardProps> = ({ onNavigateTab }) => {
	const ProRecommendedActionsCard = useFilterSlot<
		ComponentType<RecommendedActionsCardProps>
	>('vulopilot_ai_copilot_recommended_actions');

	if (ProRecommendedActionsCard) {
		return <ProRecommendedActionsCard onNavigateTab={onNavigateTab} />;
	}

	return <RecommendedActionsFreeCard onNavigateTab={onNavigateTab} />;
};

export default RecommendedActionsCard;
