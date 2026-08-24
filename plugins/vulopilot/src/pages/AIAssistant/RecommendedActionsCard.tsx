/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent } from '@zyra/components';
import { formatAffected } from './issuesTypes';
import { IssuesFilter } from './NeedsAttentionCard';
import './AICopilot.scss';

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

interface RecommendedActionsCardProps {
	// eslint-disable-next-line no-unused-vars -- named params on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onNavigateTab: (tab: string, filter?: IssuesFilter) => void;
}

const BUCKET_META: Record<
	Recommendation['bucket'],
	{ icon: string; tone: string; ctaFallback: string }
> = {
	security: { icon: 'security', tone: 'tone-red', ctaFallback: __('Security', 'vulopilot') },
	performance: { icon: 'bar-chart', tone: 'tone-orange', ctaFallback: __('Performance', 'vulopilot') },
	'ai-visibility': { icon: 'geo-location', tone: 'tone-teal', ctaFallback: __('AI Visibility', 'vulopilot') },
};

const isUrgent = (severity: Recommendation['severity']): boolean =>
	'critical' === severity || 'high' === severity;

/**
 * AI Copilot's "Recommended by VuloPilot" card — this page's former AI
 * usage widget (a raw used/quota count, always 0/0 with no quota
 * subsystem built) was removed in favor of this, a more actionable real
 * summary. One tinted mini-card per RECOMMENDATION_BUCKETS bucket
 * (Findings.php), each the real top open finding-type group in that
 * bucket (real scanner label as the headline, real
 * count/object_type via the same formatAffected() the Issues table uses
 * for its own "Affected" column) — not fabricated copy. Clicking a card's
 * CTA reuses the exact IssuesFilter navigation NeedsAttentionCard's own
 * rows used to drive (onNavigateTab('chat', filter)), scrolling to and
 * filtering the inline Issues table to that scanner. A bucket with no
 * open findings simply renders no card, rather than a fake "all clear"
 * claim this endpoint has no data to back.
 */
const RecommendedActionsCard: React.FC<RecommendedActionsCardProps> = ({ onNavigateTab }) => {
	const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
	const [isLoading, setIsLoading] = useState(true);

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
		<CardComponent
			className="dashboard-widget"
			titleIcon="ai"
			title={__('Recommended by VuloPilot', 'vulopilot')}
			desc={__('High impact actions suggested by AI', 'vulopilot')}
			isLoading={isLoading}
		>
			<div className="recommended-actions-grid">
				{recommendations.map((rec) => {
					const meta = BUCKET_META[rec.bucket];
					const urgent = isUrgent(rec.severity);

					return (
						<div className={`recommended-actions-card ${meta.tone}`} key={rec.bucket}>
							<div className="recommended-actions-card-eyebrow">
								<i className={`recommended-actions-card-icon adminfont-${meta.icon}`} />
								<span>{urgent ? __('Critical', 'vulopilot') : meta.ctaFallback}</span>
							</div>
							<div className="recommended-actions-card-title">{rec.label}</div>
							<div className="recommended-actions-card-detail">
								{formatAffected(rec.count, rec.object_type)}
							</div>
							<button
								type="button"
								className="recommended-actions-card-cta"
								onClick={() =>
									onNavigateTab('chat', {
										scannerId: rec.scanner_id,
										label: rec.label,
										category: rec.category,
									})
								}
							>
								{urgent
									? __('Investigate with AI', 'vulopilot')
									: __('Improve with AI', 'vulopilot')}
								{' →'}
							</button>
						</div>
					);
				})}
			</div>
		</CardComponent>
	);
};

export default RecommendedActionsCard;
