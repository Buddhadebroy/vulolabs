/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	PopupComponent,
	NavigatorComponent,
	ContainerComponent,
} from '@zyra/components';
import ChatTab from './ChatTab';
import HistoryTab from './HistoryTab';
import { IssuesFilter } from './NeedsAttentionCard';
import { Link } from 'react-router-dom';

interface ConfiguredProviderRow {
	is_active: boolean;
}

const TAB_IDS = [
	'chat',
	'history',
] as const;

const AIAssistant = () => {
	const [activeTab, setActiveTab] = useState<(typeof TAB_IDS)[number]>(
		'chat'
	);
	const [chatMessage, setChatMessage] = useState('');
	const [autoApply, setAutoApply] = useState(true);
	const [isHowItWorksOpen, setIsHowItWorksOpen] = useState(false);
	const [issuesFilter, setIssuesFilter] = useState<IssuesFilter | null>(
		null
	);
	// Bumped on every "go to the Issues section" navigation, even when
	// `issuesFilter` resolves to the same value as before (e.g. clicking
	// "View all issues" when it was already null) — ChatTab.tsx's own
	// scroll-into-view effect keys off this instead of `issuesFilter` so a
	// same-value React state bailout doesn't silently swallow the scroll.
	const [issuesNavToken, setIssuesNavToken] = useState(0);
	// Set only when navigation came from RecentConversationsCard.tsx's own
	// click-through — a plain top-nav click to History passes no selectId
	// and HistoryTab.tsx falls back to its normal "all, first row" default.
	const [historySelectId, setHistorySelectId] = useState<number | null>(
		null
	);
	// Real, not decorative — "Online" only means something once at least
	// one AI provider is actually connected and active (same `is_active`
	// flag ProviderRegistry::build_fallback_chain() itself checks before
	// trying a provider — AiProvidersPanel.tsx's own GET /ai-providers).
	// Starts `null` (unknown) rather than defaulting to either state, so
	// there's a moment before the fetch resolves where no badge is shown
	// instead of briefly claiming a status that hasn't been confirmed yet.
	const [hasActiveAiProvider, setHasActiveAiProvider] = useState<
		boolean | null
	>(null);

	useEffect(() => {
		getApiResponse<{ configured?: ConfiguredProviderRow[] }>(
			getApiLink(appLocalizer, 'ai-providers'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		).then((response) => {
			setHasActiveAiProvider(
				(response?.configured ?? []).some((row) => row.is_active)
			);
		});
	}, []);

	const goToTab = (tab: string, filter?: IssuesFilter, selectId?: number) => {
		if ((TAB_IDS as readonly string[]).includes(tab)) {
			setActiveTab(tab as (typeof TAB_IDS)[number]);
		}

		// The Issues table now lives inline on the Chat tab (appended below
		// the composer) rather than as its own nav tab — NeedsAttentionCard's
		// "View all issues"/group-row clicks still pass through here as
		// `onNavigateTab('chat', filter)`, so this still needs to update the
		// filter that table reads, same as it did for the old 'issues' tab.
		if ('chat' === tab) {
			setIssuesFilter(filter ?? null);
			setIssuesNavToken((n) => n + 1);
		}

		if ('history' === tab) {
			setHistorySelectId(selectId ?? null);
		}
	};

	const settingContent = TAB_IDS.map((tabId) => ({
		type: 'file' as const,
		content: {
			id: tabId,
			headerTitle: (() => {
				switch (tabId) {
					case 'chat':
						return __('Chat', 'vulopilot');
					case 'history':
						return __('History', 'vulopilot');
					default:
						return tabId;
				}
			})(),
			headerIcon: (() => {
				switch (tabId) {
					case 'chat':
						return 'ai';
					case 'history':
						return 'history';
					default:
						return 'settings';
				}
			})(),
			hideSettingHeader: true,
		},
	}));

	const getForm = (tabId: string) => {
		switch (tabId) {
			case 'chat':
				return (
					<ChatTab
						onNavigateTab={goToTab}
						message={chatMessage}
						onMessageChange={setChatMessage}
						autoApply={autoApply}
						onAutoApplyChange={setAutoApply}
						issuesFilter={issuesFilter}
						issuesNavToken={issuesNavToken}
					/>
				);
			case 'history':
				return (
					<HistoryTab
						initialFilter={
							historySelectId ? 'conversation' : undefined
						}
						initialSelectId={historySelectId}
					/>
				);
			default:
				return <div></div>;
		}
	};

	return (
		<>
			<PopupComponent
				open={isHowItWorksOpen}
				onClose={() => setIsHowItWorksOpen(false)}
				width={28}
				height="auto"
				position="lightbox"
			>
				<h2>{__('How AI Copilot works', 'vulopilot')}</h2>
				<p>
					{__(
						'Ask a question or pick a suggested prompt. VuloPilot checks your live site data — scans, traffic, security, and store health — and answers with real recommendations.',
						'vulopilot'
					)}
				</p>
				<p>
					{__(
						'Ask for a blog post, landing page, or product description and VuloPilot writes it and saves it as a real draft for you, logged to History with a real Undo. Everything else — SEO, performance, security, and other fixes — is advice only for now: VuloPilot will point you to exactly where to review and apply it yourself.',
						'vulopilot'
					)}
				</p>
			</PopupComponent>
			<NavigatorComponent
				settingContent={settingContent}
				currentSetting={activeTab}
				getForm={getForm}
				prepareUrl={(subTab: string) => 
					`?page=vulopilot#&tab=ai-assistant&subtab=${subTab}`
				}
				Link={Link}
				variant="tab"
				menuIcon={true}
				headerIcon="ai"
				headerTitle={__('AI Copilot', 'vulopilot')}
				headerDescription={__(
					'Your always-on AI assistant for WordPress. Ask anything, get intelligent answers and take action.',
					'vulopilot'
				)}
				showPremiumLink={false}
				badges={
					null === hasActiveAiProvider
						? []
						: [
								hasActiveAiProvider
									? {
											text: `● ${__('Online', 'vulopilot')}`,
											color: 'green',
										}
									: {
											text: `● ${__('Offline', 'vulopilot')}`,
											color: 'red',
										},
							]
				}
				buttons={[
					{
						label: __('How it works', 'vulopilot'),
						icon: 'help',
						onClick: () => setIsHowItWorksOpen(true),
					},
				]}
			/>
		</>
	);
};

export default AIAssistant;