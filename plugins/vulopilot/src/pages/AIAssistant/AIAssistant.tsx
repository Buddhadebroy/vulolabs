/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import {
	ContainerComponent,
	NavigatorHeaderComponent,
	TooltipComponent
} from '@zyra/components';
import ChatTab from './ChatTab';
import { IssuesFilter } from './NeedsAttentionCard';

/**
 * "AI Copilot" — used to be a tab shell over Chat/History; History has
 * moved to Reports (Reports.tsx's own "History" tab — a real, day-grouped
 * scan/change/conversation timeline that was never specific to this
 * page's own chat surface). This route now renders ChatTab directly, no
 * tab bar, same "drop to one real section" pattern Commerce.tsx/
 * Security.tsx already established — `NavigatorHeaderComponent` replaces
 * the old `NavigatorComponent`'s own built-in header, carrying over every
 * real header behavior that used to come from the tab shell (the live
 * Online/Offline badge). The old "How it works" popup button is now a
 * hover tooltip on the title itself instead (`headerTitle` cast through
 * JSX — NavigatorHeaderComponent's own type only declares it as `string`,
 * but it just renders `{headerTitle}` as children, so a real element works
 * at runtime the same way `field.component`'s escape hatch does elsewhere).
 */
const AIAssistant = () => {
	const [chatMessage, setChatMessage] = useState('');
	const [autoApply, setAutoApply] = useState(true);
	/** Opens ChatTab.tsx's own "Recent conversations" popup — the header button lives here since NavigatorHeaderComponent does, but the popup and the real conversation data/selection it needs still render inside ChatTab.tsx, so only the open/close boolean is lifted up. */
	const [isHistoryPopupOpen, setIsHistoryPopupOpen] = useState(false);
	const [issuesFilter, setIssuesFilter] = useState<IssuesFilter | null>(
		null
	);
	// Bumped on every "go to the Issues section" navigation, even when
	// `issuesFilter` resolves to the same value as before (e.g. clicking
	// "View all issues" when it was already null) — ChatTab.tsx's own
	// scroll-into-view effect keys off this instead of `issuesFilter` so a
	// same-value React state bailout doesn't silently swallow the scroll.
	const [issuesNavToken, setIssuesNavToken] = useState(0);
	// Real, not decorative — "Online" means this WP admin has a personal
	// VuloCloud account connected (`appLocalizer.vulocloud_connected`,
	// localized by VuloCloudAccountConnection::get_status() via
	// FrontendScripts.php — the same flag the header's "Connect VuloCloud"
	// surfaces read elsewhere), not whether any particular AI provider key
	// currently resolves. Already known at mount (server-localized), so no
	// fetch/loading state is needed the way the old ai-providers-based
	// check required.
	const vulocloudConnected = Boolean(appLocalizer.vulocloud_connected);

	/**
	 * The Issues table lives inline on Chat (appended below the composer)
	 * rather than as its own nav tab — NeedsAttentionCard's "View all
	 * issues"/group-row clicks still pass through here as
	 * `onNavigateTab('chat', filter)`, so this still needs to update the
	 * filter that table reads. `tab` itself is otherwise unused now that
	 * Chat is the only surface this page renders.
	 */
	const goToTab = (tab: string, filter?: IssuesFilter) => {
		if ('chat' === tab) {
			setIssuesFilter(filter ?? null);
			setIssuesNavToken((n) => n + 1);
		}
	};

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="ai"
				headerTitle={
					(
						<>
							{__('AI Copilot', 'vulopilot')}
							<TooltipComponent
								text={__(
									'Ask a question or pick a suggested prompt. VuloPilot checks your live site data — scans, traffic, security, and store health — and answers with real recommendations. Ask for a blog post, landing page, or product description and it writes one and saves it as a real draft, logged to History with a real Undo. Everything else — SEO, performance, security, and other fixes — is advice only for now.',
									'vulopilot'
								)}
								position="bottom"
							>
								<i className="adminfont-info ai-copilot-title-info" />
							</TooltipComponent>
						</>
					) as unknown as string
				}
				headerDescription={__(
					'Your always-on AI assistant for WordPress. Ask anything, get intelligent answers and take action.',
					'vulopilot'
				)}
				showPremiumLink={false}
				badges={[
					vulocloudConnected
						? {
								text: `● ${__('Online', 'vulopilot')}`,
								color: 'green',
							}
						: {
								text: `● ${__('Offline', 'vulopilot')}`,
								color: 'red',
							},
				]}
			/>
			<ContainerComponent general>
				<ChatTab
					onNavigateTab={goToTab}
					message={chatMessage}
					onMessageChange={setChatMessage}
					autoApply={autoApply}
					onAutoApplyChange={setAutoApply}
					issuesFilter={issuesFilter}
					issuesNavToken={issuesNavToken}
					isHistoryPopupOpen={isHistoryPopupOpen}
					onCloseHistoryPopup={() => setIsHistoryPopupOpen(false)}
					onOpenHistoryPopup={() => setIsHistoryPopupOpen(true)}
				/>
			</ContainerComponent>
		</>
	);
};

export default AIAssistant;
