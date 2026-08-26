import React, { useState } from 'react';
import { __ } from '@wordpress/i18n';
import './SeoVisibility.scss';
import {
	ColumnComponent,
	ContainerComponent,
	ListComponent,
} from '@zyra/components';
import { useRunScan } from '../../services/useRunScan';
import { useCopilotChat, CopilotChatTurn } from '../../services/useCopilotChat';
import { ChatMarkdown } from '../../components/ChatMarkdown';
import ChatComposerCard, { ChatInput, ChatMessage } from '../../components/ChatComposerCard';
import VisibilityScoreCard from './VisibilityScoreCard';
import AiOpportunitiesCard from './AiOpportunitiesCard';
import DiscoverCard from './DiscoverCard';
import AuthorityCard from './AuthorityCard';
import TechnicalVisibilityCard from './TechnicalVisibilityCard';
import CompetitorRadarCard from './CompetitorRadarCard';
import VisibilityTrendCard from './VisibilityTrendCard';
import AiRecommendationsSidebar from './AiRecommendationsSidebar';

interface OverviewTabProps {
	onNavigateTab: (tab: 'geo' | 'aeo') => void;
}

const SUGGESTED_PROMPTS = [
	{ id: 'organic-traffic', icon: 'bar-chart', title: __('Increase organic traffic', 'vulopilot') },
	{ id: 'ai-search', icon: 'global-community', title: __('Improve AI Search visibility', 'vulopilot') },
	{ id: 'traffic-dropping', icon: 'bar-chart', title: __('Why is my traffic dropping?', 'vulopilot') },
	{ id: 'keyword-opportunities', icon: 'search-discovery', title: __('Find keyword opportunities', 'vulopilot') },
	{ id: 'audit', icon: 'search', title: __('Audit my website', 'vulopilot') },
	{ id: 'geo-ready', icon: 'geo-location', title: __('Make my site GEO ready', 'vulopilot') },
	{ id: 'competitors', icon: 'star', title: __('Beat my competitors', 'vulopilot') },
	{ id: 'topical-authority', icon: 'knowledgebase', title: __('Improve topical authority', 'vulopilot') },
];

/**
 * "SEO & Visibility"'s new default tab — see SeoVisibility.scss's sibling
 * files for the per-section real-data mapping (VisibilityScoreCard,
 * AiOpportunitiesCard, DiscoverCard, AuthorityCard,
 * TechnicalVisibilityCard, CompetitorRadarCard, VisibilityTrendCard,
 * AiRecommendationsSidebar — each documents its own data source and, where
 * the mockup shows something with no real backend, its honest fallback).
 */
const OverviewTab: React.FC<OverviewTabProps> = ({ onNavigateTab }) => {
	const [message, setMessage] = useState('');
	// Same local category scope GEO.tsx's own header "Run scan" button
	// uses — the copilot's "Run an audit" chip shouldn't scan the whole
	// site when it's offered from this page specifically.
	const { runScan } = useRunScan({
		categories: ['geo', 'seo', 'images', 'schema', 'links'],
	});
	const { turns, isSending, send } = useCopilotChat(
		'vulopilot-geo-copilot-chat-error'
	);

	const handleSend = () => {
		send(message);
		setMessage('');
	};

	return (
		<ContainerComponent>
			<ColumnComponent grid={8}>
				<ChatComposerCard<CopilotChatTurn>
					cardTitle={__('How would you like to grow today?', 'vulopilot')}
					cardTitleIcon="bar-chart"
					guarded
					composerPosition="before-turns"
					composer={
						<ChatInput
							value={message}
							onChange={setMessage}
							onSend={handleSend}
							disabled={isSending}
							placeholder={__('Ask VuloPilot anything…', 'vulopilot')}
						/>
					}
					turns={turns}
					renderTurn={(turn, index) => (
						<ChatMessage
							key={index}
							sender={'user' === turn.role ? 'user' : 'ai'}
						>
							<ChatMarkdown text={turn.content} />
						</ChatMessage>
					)}
					isSending={isSending}
					prompts={
						<ListComponent
							className="chip-grid"
							items={SUGGESTED_PROMPTS.map((prompt) => ({
								id: prompt.id,
								icon: prompt.icon,
								title: prompt.title,
								action: () =>
									prompt.id === 'audit'
										? runScan()
										: setMessage(prompt.title),
							}))}
						/>
					}
					note={
						<p className="chat-monitoring-note">
							<i className="adminfont-ai" />
							{__(
								'AI is continuously monitoring your visibility.',
								'vulopilot'
							)}
						</p>
					}
				/>

				<ContainerComponent>
					<ColumnComponent grid={6}>
						<VisibilityScoreCard />
					</ColumnComponent>
					<AiOpportunitiesCard onNavigateTab={onNavigateTab} />
				</ContainerComponent>
			</ColumnComponent>

			<ColumnComponent grid={4}>
				<AiRecommendationsSidebar />
			</ColumnComponent>

			<ColumnComponent grid={4}>
				<DiscoverCard onNavigateTab={onNavigateTab} />
			</ColumnComponent>
			<ColumnComponent grid={4}>
				<AuthorityCard />
			</ColumnComponent>
			<ColumnComponent grid={4}>
				<TechnicalVisibilityCard />
			</ColumnComponent>

			{/*
			 * Competitor Radar and Visibility Trend both render a real
			 * Pro-provided component when geo-insights is active
			 * (GeoCompetitorVisibility/GeoVisibilityTrend, same filter slots
			 * GeoTab.tsx already declares) — both assume full-page-width
			 * room in their own original GEO.tsx placement, so unlike the
			 * 3 simple stat cards above, they get their own full-width rows
			 * rather than being crammed into a 4-up grid.
			 */}
				<CompetitorRadarCard />
				<VisibilityTrendCard />
		</ContainerComponent>
	);
};

export default OverviewTab;