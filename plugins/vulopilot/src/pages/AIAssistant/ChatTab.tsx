/* global appLocalizer */
import React, { useEffect, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import './AICopilot.scss';
import {
	ChatInputComponent,
	ChatMessageComponent,
	ColumnComponent,
	ContainerComponent,
	ListComponent,
	NoticeManager,
	PopupComponent,
	SectionComponent
} from '@zyra/components';
import { FileInput } from '@zyra/inputs';
import { getApiLink, getApiResponse, scrollToId, sendApiResponse } from '@zyra/core';
import { SUGGESTED_PROMPTS } from './copilotData';
import NeedsAttentionCard, {
	IssuesFilter,
} from './NeedsAttentionCard';
import RecentConversationsCard from './RecentConversationsCard';
import RecentConversationsSection from './RecentConversationsSection';
import RecommendedActionsCard from './RecommendedActionsCard';
import IssuesList from './IssuesList';
import AutomationTemplatesCard from '../Automations/AutomationsTemplatesCard';
import { AutomationTemplate } from '../Automations/automationsTemplates';
import {
	useCopilotChat,
	CopilotChatTurn,
	CopilotContextRef,
	CopilotAttachment,
} from '../../services/useCopilotChat';
import { ChatMarkdown } from '../../components/ChatMarkdown';
import ChatComposerCard from '../../components/ChatComposerCard';

/** Mirrors Copilot.php's own MAX_ATTACHMENTS/MAX_CONTEXT_REFS — capped client-side too so the composer never offers to add more than the server would actually resolve. */
const MAX_ATTACHMENTS = 3;
const MAX_CONTEXT_REFS = 5;

/**
 * The types Copilot.php actually does something real with: text/csv files
 * are read as text (ATTACHMENT_TEXT_MIME_TYPES), images are sent as a real
 * inline image when the active provider supports vision
 * (ATTACHMENT_IMAGE_MIME_TYPES/supports_vision() — Gemini today). Only
 * restricts the drag-and-drop/native-picker validation path — the
 * "Upload File" button's wp.media() library picker ignores `accept`
 * entirely and can select anything already in the Media Library, which
 * Copilot.php still resolves honestly either way.
 */
const ATTACHMENT_ACCEPT =
	'.txt,.csv,text/plain,text/csv,.jpg,.jpeg,.png,.gif,.webp,image/jpeg,image/png,image/gif,image/webp';

/** Matches the image extensions inside ATTACHMENT_ACCEPT — used to decide whether a sent turn's attachment renders as an inline thumbnail or a plain file chip. */
const IMAGE_EXTENSION_RE = /\.(jpe?g|png|gif|webp)$/i;

interface FindingGroupOption {
	scanner_id: string;
	category: string;
	severity: string;
	count: number;
	label: string;
}

interface AttentionSummaryResponse {
	groups: FindingGroupOption[];
}

interface AutomationOption {
	id: number;
	name: string;
	status: string;
	trigger_type: string;
}

interface AutomationsResponse {
	data: AutomationOption[];
}

const contextRefKey = ( ref: CopilotContextRef ): string =>
	'finding_group' === ref.type ? `finding_group:${ ref.scannerId }` : `automations:${ ref.id }`;

interface ChatTabProps {
	// eslint-disable-next-line no-unused-vars -- named params on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onNavigateTab: (tab: string, filter?: IssuesFilter) => void;
	message: string;
	onMessageChange: (message: string) => void;
	autoApply: boolean;
	onAutoApplyChange: (autoApply: boolean) => void;
	/** Set by NeedsAttentionCard's "View all issues"/group-row clicks (via onNavigateTab('chat', filter) — AIAssistant.tsx's own goToTab()), now that the Issues table (former standalone "Issues" tab) is appended inline below rather than a separate nav tab. */
	issuesFilter: IssuesFilter | null;
	/** Bumped on every such navigation, even when `issuesFilter` resolves to the same value as before — see AIAssistant.tsx's own docblock on issuesNavToken. */
	issuesNavToken: number;
	/** Owned by AIAssistant.tsx, whose header now carries the "Conversation history" button that opens this — the popup itself (the same real "Recent conversations" list the grid=3 sidebar already shows) still renders here since it's this tab's own data/selection flow. */
	isHistoryPopupOpen: boolean;
	onCloseHistoryPopup: () => void;
}

/**
 * The mockup's default "Chat" view — a welcome message, the "Try asking
 * me…" prompt grid, and the composer bar in the main column; a real
 * "Needs your attention" findings summary (`/findings/attention-summary`,
 * NeedsAttentionCard.tsx) + AI Workflows (`/automations`) preview in the
 * sidebar. Sending now really talks to `POST /copilot/chat`
 * (classes/RestAPI/Controllers/Copilot.php, shared via useCopilotChat.ts)
 * — a real reply grounded in this site's own open findings/automation
 * counts, not a canned response. A request like "write a blog about X"
 * really creates and saves a WordPress draft (Copilot.php's own
 * ContentCreationOrchestrator hand-off, the same real capability "Create
 * Content"'s own AI Content Assistant sidebar already had) — that turn's
 * `link` is rendered below as a real clickable edit link, right next to a
 * real inline "Undo" (`handleUndo()`, same `POST /ai-action-runs/{id}/rollback`
 * HistoryDetailPanel.tsx's own Undo button already calls) so reverting
 * what was just created doesn't require leaving this tab. Every other kind
 * of request stays advice-only. A page refresh still starts a fresh, empty
 * composer (`turns` itself is still client-side-only React state, cleared
 * on unmount), but every real conversation now really persists server-side
 * too (`vulopilot_ai_conversations`, Copilot.php's own
 * persist_conversation()) — "Recent conversations" (RecentConversationsCard.tsx,
 * `GET /copilot/conversations`) lists the user's own recent real threads,
 * and clicking one (`handleSelectConversation()` below,
 * useCopilotChat.ts's own loadConversation()) loads that thread's full,
 * untruncated turns straight back into this composer, ready to keep
 * chatting from — not just a read-only excerpt. The prompt grid still
 * prefills the composer.
 *
 * "Attach" and "Add context" are real: Attach opens zyra's FileInput,
 * which — on this admin screen, now that Admin.php calls
 * wp_enqueue_media() — hands back a real WP Media Library attachment
 * {id, url} via wp.media(), never a client-only blob preview. Add context
 * opens a picker over the same real data NeedsAttentionCard.tsx (open
 * finding groups) and this tab's own automation entry points show (active
 * automations). Both are sent as `context_refs`/`attachments` on the next
 * `POST /copilot/chat` and re-resolved against real, current data
 * server-side (Copilot.php's build_extra_context()) — this component only
 * carries an id/ref, never the resolved content itself.
 *
 * `message`/`autoApply` are owned by AIAssistant.tsx rather than locally,
 * so the sidebar's "View all" links and this tab's own prompt grid can
 * both hand real state to the composer, not just switch the visible pane.
 */
const ChatTab: React.FC<ChatTabProps> = ({
	onNavigateTab,
	message,
	onMessageChange,
	autoApply,
	onAutoApplyChange,
	issuesFilter,
	issuesNavToken,
	isHistoryPopupOpen,
	onCloseHistoryPopup,
}) => {
	const composerRef = useRef<HTMLDivElement>(null);
	const didMountRef = useRef(false);

	// Scrolls the appended Issues table into view whenever NeedsAttentionCard
	// sends a new filter (or a bare "View all issues" click) — this used to
	// be a real tab switch, which naturally landed the user on the table;
	// now that it's inline further down the same tab, without this the
	// click would silently do nothing visible if the table is off-screen.
	// Skipped on first mount so loading the Chat tab itself never auto-scrolls.
	//
	// Real bug fixed here: this used to scroll via a `useRef` that was
	// declared but never actually attached to any element with
	// `ref={...}` — `issuesSectionRef.current` was always `null`, so
	// "View all issues" silently did nothing. `scrollToId()` (the same
	// `getElementById` + `scrollIntoView` helper every other "scroll to a
	// section" click on this page already uses) targets IssuesList.tsx's
	// own real `id="ai-copilot-issues-section"` instead.
	useEffect(() => {
		if (!didMountRef.current) {
			didMountRef.current = true;
			return;
		}

		scrollToId('ai-copilot-issues-section');
		// eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the token specifically so a same-value issuesFilter update (e.g. "View all issues" when it was already null) still re-triggers the scroll; see AIAssistant.tsx's own docblock on issuesNavToken.
	}, [issuesNavToken]);

	const { turns, isSending, send, markTurnUndone, loadConversation } =
		useCopilotChat('vulopilot-copilot-chat-error');
	const [undoingRunId, setUndoingRunId] = useState<number | null>(null);

	/**
	 * RecentConversationsCard.tsx's own click-to-load — the card renders
	 * below the composer on this same tab, so loading a past thread also
	 * scrolls the composer back into view rather than leaving the user
	 * looking at the still-visible "Recent conversations" list while the
	 * turns above it silently change.
	 */
	const handleSelectConversation = (id: number) => {
		loadConversation(id);
		composerRef.current?.scrollIntoView({
			behavior: 'smooth',
			block: 'start',
		});
	};

	const [attachments, setAttachments] = useState<CopilotAttachment[]>([]);
	const [contextRefs, setContextRefs] = useState<CopilotContextRef[]>([]);
	const [isAttachPanelOpen, setIsAttachPanelOpen] = useState(false);
	const [isContextPanelOpen, setIsContextPanelOpen] = useState(false);
	const [isLoadingContextOptions, setIsLoadingContextOptions] =
		useState(false);
	const [findingGroupOptions, setFindingGroupOptions] = useState<
		FindingGroupOption[] | null
	>(null);
	const [automationOptions, setAutomationOptions] = useState<
		AutomationOption[] | null
	>(null);

	const handleSend = () => {
		send(message, contextRefs, attachments, autoApply);
		onMessageChange('');
		setAttachments([]);
		setContextRefs([]);
		// Close the Attach/Add context panels on send — otherwise they stay
		// open and revert to their own empty "Drag and drop"/list state,
		// which reads as if nothing was actually sent.
		setIsAttachPanelOpen(false);
		setIsContextPanelOpen(false);
	};

	/**
	 * Undoes a turn's own content-creation run — the same real
	 * `POST /ai-action-runs/{id}/rollback` (AIActions\ActionRunner::rollback())
	 * HistoryDetailPanel.tsx's own Undo button already calls, just reachable
	 * right here next to what it undoes instead of only from History.
	 */
	const handleUndo = (runId: number) => {
		setUndoingRunId(runId);

		sendApiResponse<{ success?: boolean }>(
			appLocalizer,
			getApiLink(appLocalizer, `ai-action-runs/${runId}/rollback`),
			{}
		)
			.then((response) => {
				NoticeManager.add({
					uniqueKey: `copilot-chat-rollback-${runId}`,
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __('Change undone.', 'vulopilot')
						: __(
								'Could not undo this change. Please try again.',
								'vulopilot'
							),
				});

				if (response) {
					markTurnUndone(runId);
				}
			})
			.finally(() => setUndoingRunId(null));
	};

	const toggleAttachPanel = () => {
		setIsContextPanelOpen(false);
		setIsAttachPanelOpen((open) => !open);
	};

	const toggleContextPanel = () => {
		setIsAttachPanelOpen(false);
		setIsContextPanelOpen((open) => {
			const opening = !open;

			if (opening && null === findingGroupOptions && null === automationOptions) {
				setIsLoadingContextOptions(true);

				Promise.all([
					getApiResponse<AttentionSummaryResponse>(
						getApiLink(appLocalizer, 'findings/attention-summary'),
						{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
					),
					getApiResponse<AutomationsResponse>(
						getApiLink(
							appLocalizer,
							'automations?status=enabled&per_page=10'
						),
						{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
					),
				])
					.then(([attentionResponse, automationsResponse]) => {
						setFindingGroupOptions(attentionResponse?.groups ?? []);
						setAutomationOptions(automationsResponse?.data ?? []);
					})
					.finally(() => setIsLoadingContextOptions(false));
			}

			return opening;
		});
	};

	const handleFileInputChange = (
		value:
			| { id?: number; url: string }
			| { id?: number; url: string }[]
			| ''
	) => {
		const raw = Array.isArray(value) ? value : value ? [value] : [];
		const valid = raw.filter(
			(file): file is { id: number; url: string } =>
				'number' === typeof file.id
		);

		if (valid.length < raw.length) {
			NoticeManager.add({
				uniqueKey: 'vulopilot-chat-attach-local-only',
				type: 'error',
				position: 'float',
				message: __(
					"That file wasn't uploaded — use the Upload File button so it's saved to the Media Library and readable by the AI.",
					'vulopilot'
				),
			});
		}

		setAttachments(
			valid.slice(0, MAX_ATTACHMENTS).map((file) => ({
				id: file.id,
				url: file.url,
				name: file.url.split('#').pop()?.split('/').pop() || file.url,
			}))
		);
	};

	const toggleContextRef = (ref: CopilotContextRef) => {
		const key = contextRefKey(ref);

		setContextRefs((current) => {
			if (current.some((existing) => contextRefKey(existing) === key)) {
				return current.filter(
					(existing) => contextRefKey(existing) !== key
				);
			}

			if (current.length >= MAX_CONTEXT_REFS) {
				return current;
			}

			return [...current, ref];
		});
	};

	const removeAttachment = (id: number) =>
		setAttachments((current) => current.filter((file) => file.id !== id));

	/**
	 * AutomationTemplatesCard's real home is Automate Work
	 * (`ManageAutomationsSection.tsx`, via `Automations.tsx`) — this preview
	 * on Chat navigates there rather than trying to open a create form that
	 * lives in a different top-level page's own React tree, carrying the
	 * picked template through the `automation_template` URL param.
	 * `Automations.tsx` reads it on mount and forwards it down so the real
	 * wizard opens already seeded, not a bare redirect to a blank page.
	 * Automate Work has no `subtab=` of its own since its own redesign
	 * flattened its previous Overview/Automations two-tab shell into one
	 * page — nothing left to route to but the page itself.
	 */
	const handleSelectAutomationTemplate = (template: AutomationTemplate) => {
		window.location.href = `${appLocalizer.admin_url}#&tab=automations&automation_template=${template.id}`;
	};

	return (
		<ContainerComponent>
			<ColumnComponent grid={8}>
				{/* Scroll target for handleSelectConversation() — loading a past thread from the "Recent conversations" sidebar brings this composer back into view. */}
				<div ref={composerRef}>
					<ChatComposerCard<CopilotChatTurn>
						guarded
						sendingAvatarIcon="ai"
						welcome={
							<>
								<strong>
									{__(
										"Hi! I'm VuloPilot, your AI website copilot. 👋",
										'vulopilot'
									)}
								</strong>
								<div>
									{__(
										'I monitor your site 24×7, find opportunities and help you improve it — automatically or with your approval.',
										'vulopilot'
									)}
								</div>
							</>
						}
						turns={turns}
						renderTurn={(turn, index) => (
							<ChatMessageComponent
								key={index}
								sender={'user' === turn.role ? 'user' : 'ai'}
							>
								{turn.attachments && turn.attachments.length > 0 && (
									<div className="chat-message-attachments">
										{turn.attachments.map((attachment) =>
											IMAGE_EXTENSION_RE.test(attachment.name) ? (
												<img
													key={`sent-attachment-${attachment.id}`}
													className="chat-message-attachment-thumb"
													src={attachment.url}
													alt={attachment.name}
												/>
											) : (
												<span
													key={`sent-attachment-${attachment.id}`}
													className="chat-message-attachment-chip"
												>
													<i className="adminfont-attachment" />
													{attachment.name}
												</span>
											)
										)}
									</div>
								)}
								<ChatMarkdown text={turn.content} />
								{turn.link && (
									<div className="copilot-created-link">
										<a
											className="copilot-created-link-anchor"
											href={turn.link.url}
											target="_blank"
											rel="noopener noreferrer"
										>
											{turn.link.label}
										</a>
										{turn.runId && (
											<span
												className={`copilot-created-undo${turn.undone || undoingRunId === turn.runId ? ' disabled' : ''}`}
												role="button"
												tabIndex={0}
												onClick={() => {
													if (
														turn.runId &&
														!turn.undone &&
														undoingRunId !== turn.runId
													) {
														handleUndo(turn.runId);
													}
												}}
												onKeyDown={(e) => {
													if (
														('Enter' === e.key ||
															' ' === e.key) &&
														turn.runId &&
														!turn.undone &&
														undoingRunId !== turn.runId
													) {
														e.preventDefault();
														handleUndo(turn.runId);
													}
												}}
											>
												{turn.undone
													? __('Undone', 'vulopilot')
													: undoingRunId === turn.runId
														? __(
																'Undoing…',
																'vulopilot'
															)
														: __('Undo', 'vulopilot')}
											</span>
										)}
									</div>
								)}
							</ChatMessageComponent>
						)}
						isSending={isSending}
						beforeComposer={
							<>
								{(attachments.length > 0 || contextRefs.length > 0) && (
									<div className="chat-composer-chips">
										{attachments.map((attachment) => (
											<span
												className="chat-composer-chip"
												key={`attachment-${attachment.id}`}
											>
												<i className="adminfont-attachment" />
												{attachment.name}
												<i
													className="adminfont-close"
													onClick={() =>
														removeAttachment(attachment.id)
													}
												/>
											</span>
										))}
										{contextRefs.map((ref) => (
											<span
												className="chat-composer-chip"
												key={contextRefKey(ref)}
											>
												<i className="adminfont-plus-circle" />
												{'finding_group' === ref.type
													? ref.label
													: ref.name}
												<i
													className="adminfont-close"
													onClick={() => toggleContextRef(ref)}
												/>
											</span>
										))}
									</div>
								)}

								{isAttachPanelOpen && (
									<div className="chat-composer-panel">
										<p className="chat-composer-panel-label">
											{__(
												'Attach a .txt/.csv file to read, or a .jpg/.png/.gif/.webp image for the AI to actually see — uploaded to your Media Library first.',
												'vulopilot'
											)}
										</p>
										<FileInput
											multiple
											accept={ATTACHMENT_ACCEPT}
											openUploader={__('Upload File', 'vulopilot')}
											wrapperClass="chat-composer-fileinput"
											imageSrc={attachments.map((attachment) => ({
												id: attachment.id,
												url: attachment.url,
											}))}
											onChange={handleFileInputChange}
										/>
									</div>
								)}

								{isContextPanelOpen && (
									<div className="chat-composer-panel">
										<p className="chat-composer-panel-label">
											{__(
												'Pick real open issues or automations to ground this message with.',
												'vulopilot'
											)}
										</p>
										{isLoadingContextOptions ? (
											<p>{__('Loading…', 'vulopilot')}</p>
										) : (
											<>
												{(findingGroupOptions ?? []).map(
													(group) => {
														const ref: CopilotContextRef = {
															type: 'finding_group',
															scannerId: group.scanner_id,
															label: group.label,
															category: group.category,
															count: group.count,
															severity: group.severity,
														};
														const selected = contextRefs.some(
															(existing) =>
																contextRefKey(existing) ===
																contextRefKey(ref)
														);

														return (
															<div
																key={contextRefKey(ref)}
																className={`chat-context-option${
																	selected
																		? ' selected'
																		: ''
																}`}
																onClick={() =>
																	toggleContextRef(ref)
																}
															>
																<i
																	className={
																		selected
																			? 'adminfont-check'
																			: 'adminfont-error'
																	}
																/>
																<span>
																	{group.label} —{' '}
																	{group.count}{' '}
																	{__(
																		'open',
																		'vulopilot'
																	)}{' '}
																	({group.severity})
																</span>
															</div>
														);
													}
												)}
												{(automationOptions ?? []).map(
													(automation) => {
														const ref: CopilotContextRef = {
															type: 'automations',
															id: automation.id,
															name: automation.name,
														};
														const selected = contextRefs.some(
															(existing) =>
																contextRefKey(existing) ===
																contextRefKey(ref)
														);

														return (
															<div
																key={contextRefKey(ref)}
																className={`chat-context-option${
																	selected
																		? ' selected'
																		: ''
																}`}
																onClick={() =>
																	toggleContextRef(ref)
																}
															>
																<i
																	className={
																		selected
																			? 'adminfont-check'
																			: 'adminfont-update'
																	}
																/>
																<span>
																	{automation.name} (
																	{automation.status})
																</span>
															</div>
														);
													}
												)}
												{0 ===
													(findingGroupOptions ?? []).length &&
													0 ===
														(automationOptions ?? [])
															.length && (
														<p>
															{__(
																'Nothing to add context from yet.',
																'vulopilot'
															)}
														</p>
													)}
											</>
										)}
									</div>
								)}
							</>
						}
						composer={
							// eslint-disable-next-line jsx-a11y/no-static-element-interactions -- pure event-propagation guard, not an interactive element. Bubble-phase (not capture) on purpose: capture fires top-down *before* the event reaches ChatInputComponent's own textarea, so stopping it there would swallow the textarea's own Enter-to-send handler before it ever runs. Bubble-phase stopPropagation() lets the textarea's own listener fire first, then blocks it from reaching any page-level listener above this point.
							<div onKeyDown={(e) => e.stopPropagation()}>
								<ChatInputComponent
									value={message}
									onChange={onMessageChange}
									onSend={handleSend}
									disabled={isSending}
									placeholder={__(
										'Ask VuloPilot anything about your website…',
										'vulopilot'
									)}
									onAttach={toggleAttachPanel}
									attachLabel={__('Attach', 'vulopilot')}
									onAddContext={toggleContextPanel}
									addContextLabel={__('Add context', 'vulopilot')}
									autoApply={{
										checked: autoApply,
										onChange: onAutoApplyChange,
										label: __(
											'Auto-applies (with approval)',
											'vulopilot'
										),
									}}
								/>
							</div>
						}
						prompts={
							<ListComponent
								className="chip-grid"
								items={SUGGESTED_PROMPTS.map((prompt) => ({
									id: prompt.id,
									icon: prompt.icon,
									title: prompt.title,
									action: () => onMessageChange(prompt.title),
								}))}
							/>
						}
					/>
				</div>
				<PopupComponent
					open={isHistoryPopupOpen}
					onClose={onCloseHistoryPopup}
					width={25}
					height="auto"
					position="lightbox"
				>
					<RecentConversationsCard
						onSelectConversation={(id: number) => {
							handleSelectConversation(id);
							onCloseHistoryPopup();
						}}
					/>
				</PopupComponent>

				<AutomationTemplatesCard onSelectTemplate={handleSelectAutomationTemplate} />
			</ColumnComponent>

			<ColumnComponent grid={4}>
				<NeedsAttentionCard onNavigateTab={onNavigateTab} />
			</ColumnComponent>

			<ColumnComponent grid={12}>
				<RecentConversationsSection onSelectConversation={handleSelectConversation} />
			</ColumnComponent>

			<ColumnComponent grid={12}>
				<RecommendedActionsCard onNavigateTab={onNavigateTab} />
			</ColumnComponent>

			<ColumnComponent grid={12}>
				<SectionComponent
						title={__('Issues', 'vulopilot')}
						desc={__('Findings from your most recent scans, grouped by check.', 'vulopilot')}
					/>
			</ColumnComponent>
			<IssuesList
				key={issuesFilter?.scannerId ?? 'all'}
				initialScannerId={issuesFilter?.scannerId}
				initialCategory={issuesFilter?.category}
			/>
		</ContainerComponent>
	);
};

export default ChatTab;
