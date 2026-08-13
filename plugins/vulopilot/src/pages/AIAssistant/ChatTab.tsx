/* global appLocalizer */
import React, { useState } from 'react';
import { __ } from '@wordpress/i18n';
import './AICopilot.scss';
import {
	CardComponent,
	ChatInputComponent,
	ChatMessageComponent,
	ColumnComponent,
	ContainerComponent,
	ListComponent,
	NoticeManager
} from '@zyra/components';
import { FileInput, ButtonInput } from '@zyra/inputs';
import { getApiLink, getApiResponse } from '@zyra/core';
import { SUGGESTED_PROMPTS } from './copilotData';
import NeedsAttentionCard, {
	IssuesFilter,
} from './NeedsAttentionCard';
import RecentConversationsCard from './RecentConversationsCard';
import AiWorkflowsList from './AiWorkflowsList';
import AiUsageCard from './AiUsageCard';
import LiveSiteInsightsCard from './LiveSiteInsightsCard';
import {
	useCopilotChat,
	CopilotContextRef,
	CopilotAttachment,
} from '../../services/useCopilotChat';
import { ChatMarkdown } from '../../components/ChatMarkdown';
import AiCopilotGuard from '../../components/AiCopilotGuard';

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
	'finding_group' === ref.type ? `finding_group:${ ref.scannerId }` : `automation:${ ref.id }`;

interface ChatTabProps {
	onNavigateTab: (tab: string, filter?: IssuesFilter) => void;
	message: string;
	onMessageChange: (message: string) => void;
	autoApply: boolean;
	onAutoApplyChange: (autoApply: boolean) => void;
}

/**
 * The mockup's default "Chat" view — a welcome message, the "Try asking
 * me…" prompt grid, and the composer bar in the main column; a real
 * "Needs your attention" findings summary (`/findings/attention-summary`,
 * NeedsAttentionCard.tsx) + AI Workflows (`/automations`) preview in the
 * sidebar. Sending now really talks to `POST /copilot/chat`
 * (classes/RestAPI/Controllers/Copilot.php, shared via useCopilotChat.ts)
 * — a real reply grounded in this site's own open findings/automation
 * counts, not a canned response. `turns` itself is kept client-side only
 * (useCopilotChat.ts's own docblock) — there's still no persisted
 * conversation entity to reload past *sessions* from, so a page refresh
 * starts a fresh conversation. "Recent conversations"
 * (RecentConversationsCard.tsx) is a real, adjacent feed of *what the AI
 * actually said*, not a session list: every real call (chat included) now
 * writes a genuine `response_excerpt` to `vulopilot_ai_history`
 * (UsageTrackingProvider::record_success(), fixed after that column
 * existed in the schema but was never populated), so this card surfaces
 * real recent AI activity even though full past chat threads aren't
 * reloadable. The prompt grid still prefills the composer.
 *
 * "Attach" and "Add context" are real: Attach opens zyra's FileInput,
 * which — on this admin screen, now that Admin.php calls
 * wp_enqueue_media() — hands back a real WP Media Library attachment
 * {id, url} via wp.media(), never a client-only blob preview. Add context
 * opens a picker over the same real data NeedsAttentionCard.tsx/
 * AiWorkflowsList.tsx already show (open finding groups, active
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
}) => {
	const { turns, isSending, send } = useCopilotChat(
		'vulopilot-copilot-chat-error'
	);

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
		send(message, contextRefs, attachments);
		onMessageChange('');
		setAttachments([]);
		setContextRefs([]);
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

	return (
		<ContainerComponent>
			<ColumnComponent grid={8}>
				<CardComponent>
					<AiCopilotGuard>
					<ChatMessageComponent sender="ai" avatarIcon="ai">
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
					</ChatMessageComponent>

					{turns.map((turn, index) => (
						<ChatMessageComponent
							key={index}
							sender={'user' === turn.role ? 'user' : 'ai'}
						>
							<ChatMarkdown text={turn.content} />
						</ChatMessageComponent>
					))}

					{isSending && (
						<ChatMessageComponent sender="ai" avatarIcon="ai">
							<i className="adminfont-refresh chat-thinking-spinner" />{' '}
							{__('Thinking…', 'vulopilot')}
						</ChatMessageComponent>
					)}

					<p className="chat-prompts-label">
						{__('Try asking me…', 'vulopilot')}
					</p>

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
												type: 'automation',
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

					<ListComponent
						className="chip-grid"
						items={SUGGESTED_PROMPTS.map((prompt) => ({
							id: prompt.id,
							icon: prompt.icon,
							title: prompt.title,
							action: () => onMessageChange(prompt.title),
						}))}
					/>
				</AiCopilotGuard>
				</CardComponent>
			</ColumnComponent>

			<ColumnComponent grid={4}>
				<NeedsAttentionCard onNavigateTab={onNavigateTab} />
			</ColumnComponent>	
					
			<ColumnComponent grid={8}>
				<CardComponent
					title={__('AI Workflows', 'vulopilot')}
					titleIcon="ai"
					action={
						<ButtonInput
							buttons={{
								text: __('View all history', 'vulopilot'),
								rightIcon: 'arrow-right',
								color: 'text-purple', 
								onClick: (e) => {
									e.preventDefault();
									onNavigateTab('ai-workflows');
								},
							}}
						/>
					}
				>
					<AiWorkflowsList limit={4} />
				</CardComponent>
				<LiveSiteInsightsCard />
			</ColumnComponent>
			<ColumnComponent grid={4}>
				<RecentConversationsCard onNavigateTab={onNavigateTab} />
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default ChatTab;
