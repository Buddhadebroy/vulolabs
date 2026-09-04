/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	ContainerComponent,
	NavigatorHeaderComponent,
	TooltipComponent
} from '@zyra/components';
import ChatTab from './ChatTab';
import { IssuesFilter } from './NeedsAttentionCard';
import { useCopilotChatEnabled } from '../../services/useCopilotChatEnabled';

interface ConfiguredProviderRow {
	is_active: boolean;
	/**
	 * Whether the stored credential can actually still be decrypted
	 * (Controllers\AiProviders::prepare_config_for_response()) — `is_active`
	 * alone isn't enough: a site that rotates its auth salts/keys after
	 * a credential was saved leaves it undecryptable forever, and
	 * ProviderRegistry::build_fallback_chain() (the real request path)
	 * already skips exactly that case. Checking both here is what keeps
	 * this badge from claiming "Online" while a real AI call would fail.
	 */
	credential_ok: boolean;
}

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
	// Real, not decorative — "Online" only means something once at least
	// one AI provider is both active AND actually usable (`is_active` AND
	// `credential_ok` — same two things ProviderRegistry::build_fallback_chain()
	// itself checks before trying a provider — AiProvidersPanel.tsx's own
	// GET /ai-providers). `is_active` alone isn't enough: see
	// ConfiguredProviderRow's own docblock on `credential_ok`. Starts
	// `null` (unknown) rather than defaulting to either state, so there's
	// a moment before the fetch resolves where no badge is shown instead
	// of briefly claiming a status that hasn't been confirmed yet.
	const [hasActiveAiProvider, setHasActiveAiProvider] = useState<
		boolean | null
	>(null);
	/** "Chat with VuloPilot" itself is a real Pro feature now — see ChatTab.tsx's own "PRO" card badge and useCopilotChat.ts's own docblock for the fuller gate; this is the same real check, just also surfaced as a real header badge (same Online/Offline `badges` slot below) so the Pro tag is visible before scrolling down to the chat card itself. */
	const isCopilotChatEnabled = useCopilotChatEnabled();

	useEffect(() => {
		getApiResponse<{ configured?: ConfiguredProviderRow[] }>(
			getApiLink(appLocalizer, 'ai-providers'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		).then((response) => {
			setHasActiveAiProvider(
				(response?.configured ?? []).some(
					(row) => row.is_active && row.credential_ok
				)
			);
		});
	}, []);

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
					...(isCopilotChatEnabled ? [] : [{ text: __('PRO', 'vulopilot'), color: 'purple' }]),
					...(null === hasActiveAiProvider
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
							]),
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
