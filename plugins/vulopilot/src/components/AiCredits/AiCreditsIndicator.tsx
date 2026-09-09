/* global appLocalizer */
import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { NoticeComponent, PopupComponent } from '@zyra/components';
import { useAiCredits } from '../../services/useAiCredits';
import AiCreditsConnectForm from './AiCreditsConnectForm';
import './AiCreditsIndicator.scss';

/**
 * The persistent "⚡ N AI Credits" indicator (architecture plan §21) —
 * mounted once, as a sibling of zyra's own `HeaderComponent` in app.tsx
 * (not through that component's own `utilityList` prop: that prop's
 * `toggleIcon` only ever renders a plain icon-font glyph — see
 * PopupComponent's own real toggle-icon behavior — so it has nowhere to
 * put the live number itself; this component drives its own
 * `PopupComponent` in fully-controlled mode instead, with the credit
 * count as its own custom, always-visible trigger).
 *
 * Three real states, all driven by useAiCredits()'s own live
 * `GET /ai-credits/status` read — never a fabricated number:
 * - Not connected: "Claim your 100 Free AI Credits" — opens the
 *   connect/create-account form (VuloPilot brief §4's whole flow, but
 *   collapsed server-side into one `connect_and_claim()` call — see that
 *   method's own docblock).
 * - Connected: the real credit count, click-through to balance/usage +
 *   "Buy More Credits"/"Explore VuloPilot Pro" (both external, same
 *   `appLocalizer.shop_url` link Popup.tsx's own generic Pro upsell
 *   already uses — this pass doesn't build a real purchase flow, see the
 *   architecture plan's own "Explicitly out of scope").
 * - Loading: renders nothing rather than a placeholder number — there's
 *   no honest "0" or "—" to show before the real value is known.
 */
const AiCreditsIndicator = () => {
	const { status, isLoading, refresh } = useAiCredits();
	const [isOpen, setIsOpen] = useState(false);

	if (isLoading || !status) {
		return null;
	}

	return (
		<div className="ai-credits-indicator">
			<button
				type="button"
				className="ai-credits-indicator-trigger"
				onClick={() => setIsOpen(!isOpen)}
			>
				<span className="ai-credits-indicator-bolt">⚡</span>
				{status.connected ? (
					<span className="ai-credits-indicator-count">
						{sprintf(
							/* translators: %d: real remaining AI Credit balance. */
							__('%d AI Credits', 'vulopilot'),
							status.credits
						)}
					</span>
				) : (
					<span className="ai-credits-indicator-count">
						{__('Claim free AI Credits', 'vulopilot')}
					</span>
				)}
			</button>

			<PopupComponent
				position="menu-dropdown"
				width={20}
				open={isOpen}
				onClose={() => setIsOpen(false)}
			>
				{status.connected ? (
					<AiCreditsBalancePanel
						status={status}
						onRefresh={refresh}
					/>
				) : (
					<AiCreditsConnectForm
						onConnected={() => {
							refresh();
							setIsOpen(false);
						}}
					/>
				)}
			</PopupComponent>
		</div>
	);
};

const AiCreditsBalancePanel = ({
	status,
	onRefresh,
}: {
	status: import('../../services/useAiCredits').AiCreditsStatus;
	onRefresh: () => void;
}) => {
	const exhausted = 0 === status.credits;

	return (
		<div className="ai-credits-balance-panel">
			<div className="ai-credits-balance-panel-count">
				{status.credits}
			</div>
			<div className="ai-credits-balance-panel-label">
				{__('AI Credits remaining', 'vulopilot')}
			</div>
			<div className="ai-credits-balance-panel-stats">
				<span>
					{sprintf(
						/* translators: %d: real lifetime-earned credit count. */
						__('%d earned', 'vulopilot'),
						status.lifetime_earned
					)}
				</span>
				<span>
					{sprintf(
						/* translators: %d: real lifetime-used credit count. */
						__('%d used', 'vulopilot'),
						status.lifetime_used
					)}
				</span>
			</div>

			{exhausted && (
				<NoticeComponent
					displayPosition="inline-notice"
					type="warning"
					title={__(
						"You've used all your AI Credits.",
						'vulopilot'
					)}
					message={__(
						'Free AI: use your credits for manual AI assistance. Pro: unlock automation, AI fixing, and advanced intelligence.',
						'vulopilot'
					)}
				/>
			)}

			<div className="ai-credits-balance-panel-actions">
				<a
					className="ai-credits-balance-panel-primary-link"
					href={appLocalizer.shop_url}
					target="_blank"
					rel="noreferrer"
				>
					{__('Buy More Credits', 'vulopilot')}
				</a>
				<a
					className="ai-credits-balance-panel-secondary-link"
					href={appLocalizer.shop_url}
					target="_blank"
					rel="noreferrer"
				>
					{__('Explore VuloPilot Pro', 'vulopilot')}
				</a>
			</div>

			<button
				type="button"
				className="ai-credits-balance-panel-refresh"
				onClick={onRefresh}
			>
				{__('Refresh balance', 'vulopilot')}
			</button>
		</div>
	);
};

export default AiCreditsIndicator;
