import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import AiCopilotGuard from '../AiCopilotGuard';
import ChatMessage from './ChatMessage';
import './ChatComposerCard.scss';

export interface ChatComposerCardProps<TTurn = unknown> {
	/** Passed straight through to CardComponent. */
	cardTitle?: ReactNode;
	cardTitleIcon?: string;
	/** Passed straight through to CardComponent's own `desc` — a one-line subtitle under `cardTitle`. */
	cardDesc?: ReactNode;
	cardAction?: ReactNode;
	cardClassName?: string;
	/**
	 * Wraps the body in AiCopilotGuard (the shared "AI Copilot is turned
	 * off" fallback). Off by default — not every composer here actually
	 * talks to the AI Copilot module (AutomationComposerCard has no AI
	 * backend to gate at all).
	 */
	guarded?: boolean;
	/** A custom header rendered above everything else, for cards whose title isn't a plain CardComponent `title` (AutomationComposerCard's own `<h2>`). */
	header?: ReactNode;
	/** A static first turn (e.g. a greeting), rendered before `turns` — as a real `ChatMessage` bubble, and (unlike `emptyState` below) still shown once real turns exist. */
	welcome?: ReactNode;
	/**
	 * A centered "nothing sent yet" placeholder (icon + heading + subtitle,
	 * typically) rendered on its own — NOT wrapped in a `ChatMessage`
	 * bubble — in place of `welcome`/`turns` while `turns` is empty and
	 * nothing is sending. Once a real turn exists (or one is in flight),
	 * this stops rendering and `welcome`/`turns` take over as normal. Only
	 * needed by a composer whose empty state is a distinct hero rather than
	 * a chat bubble (AI Copilot's own Chat tab) — leave unset to keep the
	 * plain `welcome`-bubble behavior every other composer here already
	 * uses.
	 */
	emptyState?: ReactNode;
	turns?: TTurn[];
	// eslint-disable-next-line no-unused-vars -- named params on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	renderTurn?: (turn: TTurn, index: number) => ReactNode;
	isSending?: boolean;
	sendingLabel?: string;
	sendingAvatarIcon?: string;
	sendingSpinnerClassName?: string;
	/**
	 * The fully-built `<ChatInput />` element. Left to the caller rather
	 * than genericized — each site's composer props diverge too much
	 * (`sendDisabledReason` vs `onAttach`/`onAddContext`/`autoApply`) to be
	 * worth forcing through one shared prop shape.
	 */
	composer: ReactNode;
	/** Whether `composer` renders before or after the welcome/turns block. */
	composerPosition?: 'before-turns' | 'after-turns';
	/** Extra content rendered right before the composer — e.g. ChatTab's "Try asking me…" label, attachment/context chips, attach/context panels. */
	beforeComposer?: ReactNode;
	/**
	 * The fully-built prompt-pills element. Left to the caller for the same
	 * reason as `composer` — shapes genuinely differ (zyra's `ListComponent`
	 * chip-grid vs AutomationComposerCard's raw `<button>` grid).
	 */
	prompts?: ReactNode;
	note?: ReactNode;
}

/**
 * The shared skeleton behind every "AI chat composer" card in this plugin:
 * Automation's composer (AutomationComposerCard.tsx), GEO's "How would you
 * like to grow today?" card (pages/GEO/OverviewTab.tsx), the "AI Content
 * Assistant" sidebar (pages/Content/AiContentAssistantSidebar.tsx), and AI
 * Assistant's own Chat tab (pages/AIAssistant/ChatTab.tsx) — same
 * CardComponent/AiCopilotGuard/welcome+turns/"Thinking…"/composer/prompts
 * ordering, copy-pasted with small variations across all four before this.
 *
 * Only the genuinely-shared skeleton lives here. Each site's own
 * turn-shape, composer props (attachments, context refs, undo, pending-chip
 * placeholders, `sendDisabledReason`, …) and prompt-pill markup stay local
 * to that site and are passed in pre-built via `renderTurn`/`composer`/
 * `prompts` — deliberately not flattened into one giant generic prop shape,
 * since those parts don't actually share behavior, just adjacent JSX.
 *
 * `ChatMessage`/`ChatInput` (this folder's other two files) used to be
 * zyra's own ChatMessageComponent/ChatInputComponent (@zyra/components) —
 * every real consumer of either lived in this plugin alone, so both moved
 * here (styles included, ChatComposerCard.scss) instead of staying in the
 * shared design system.
 */
const ChatComposerCard = <TTurn,>({
	cardTitle,
	cardTitleIcon,
	cardDesc,
	cardAction,
	cardClassName,
	guarded = false,
	header,
	welcome,
	emptyState,
	turns = [],
	renderTurn,
	isSending = false,
	sendingLabel = __('Thinking…', 'vulopilot'),
	sendingAvatarIcon,
	sendingSpinnerClassName = 'chat-thinking-spinner',
	composer,
	composerPosition = 'after-turns',
	beforeComposer,
	prompts,
	note,
}: ChatComposerCardProps<TTurn>) => {
	const turnsBlock =
		emptyState && 0 === turns.length && !isSending ? (
			emptyState
		) : (
			<>
				{welcome && (
					<ChatMessage
						sender="ai"
						{...(sendingAvatarIcon
							? { avatarIcon: sendingAvatarIcon }
							: {})}
					>
						{welcome}
					</ChatMessage>
				)}

				{turns.map((turn, index) =>
					renderTurn ? (
						renderTurn(turn, index)
					) : (
						<ChatMessage key={index}>{turn as ReactNode}</ChatMessage>
					)
				)}

				{isSending && (
					<ChatMessage
						sender="ai"
						{...(sendingAvatarIcon
							? { avatarIcon: sendingAvatarIcon }
							: {})}
					>
						<i
							className={`adminfont-refresh ${sendingSpinnerClassName}`}
						/>{' '}
						{sendingLabel}
					</ChatMessage>
				)}
			</>
		);

	const body = (
		<>
			{header}
			{'before-turns' === composerPosition && composer}
			{turnsBlock}
			{beforeComposer}
			{'after-turns' === composerPosition && composer}
			{prompts}
			{note}
		</>
	);

	return (
		<CardComponent
			title={cardTitle}
			titleIcon={cardTitleIcon}
			desc={cardDesc}
			action={cardAction}
			className={`${cardClassName} ai-card`}
		>
			{guarded ? <AiCopilotGuard>{body}</AiCopilotGuard> : body}
		</CardComponent>
	);
};

export default ChatComposerCard;
export { default as ChatMessage } from './ChatMessage';
export { default as ChatInput } from './ChatInput';
