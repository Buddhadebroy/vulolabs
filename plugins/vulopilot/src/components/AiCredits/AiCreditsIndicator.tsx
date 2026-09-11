/* global appLocalizer */
import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { NoticeComponent, PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useAiCredits } from '../../services/useAiCredits';
import { useConnectVuloCloud } from '../../services/useConnectVuloCloud';
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
 * - Not connected: "Claim your 100 Free AI Credits" — opens the same
 *   passwordless "Connect to VuloCloud" redirect Settings → AI Providers'
 *   own button uses (AiCreditsConnection::get_broker_authorize_url()'s own
 *   docblock for the full sequence) rather than a second, separate
 *   embedded login/signup form — one connect flow in the whole plugin, not
 *   two that could drift.
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
	/** Same `GET /ai-providers/broker-authorize-url` redirect
	 * AiProvidersPanel.tsx's own "Connect to VuloCloud" button uses — the
	 * broker's own return redirect lands back on that Settings tab
	 * regardless of where this button was clicked from, so there's no
	 * separate "connected" callback to wire up here; navigating away
	 * makes this popup's own open/loading state moot. */
	const { isConnecting, handleConnect: handleConnectToVulocloud } = useConnectVuloCloud();

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
					<div className="ai-credits-connect-prompt">
						<NoticeComponent
							displayPosition="inline"
							type="info"
							message={__(
								'Claim 100 Free AI Credits — no credit card required.',
								'vulopilot'
							)}
						/>
						<ButtonInput
							position="left"
							buttons={{
								text: isConnecting
									? __('Connecting…', 'vulopilot')
									: __('Connect to VuloCloud', 'vulopilot'),
								disabled: isConnecting,
								onClick: handleConnectToVulocloud,
							}}
						/>
					</div>
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
