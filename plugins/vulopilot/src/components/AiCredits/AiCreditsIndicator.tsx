/* global appLocalizer */
import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
	FormGroupComponent,
	FormGroupWrapperComponent,
	NoticeComponent,
	PopupComponent,
} from '@zyra/components';
import { ButtonInput, SelectInput, TextInput } from '@zyra/inputs';
import {
	AiCreditsErrorBody,
	connectAiCredits,
	useAiCredits,
} from '../../services/useAiCredits';
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
					<AiCreditsConnectPanel
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

const AiCreditsConnectPanel = ({
	onConnected,
}: {
	onConnected: () => void;
}) => {
	const [asCustomer, setAsCustomer] = useState(false);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [firstName, setFirstName] = useState('');
	const [lastName, setLastName] = useState('');
	const [twoFactorCode, setTwoFactorCode] = useState('');
	const [needsTwoFactorCode, setNeedsTwoFactorCode] = useState(false);
	const [createAccount, setCreateAccount] = useState(false);
	const [error, setError] = useState('');
	const [isConnecting, setIsConnecting] = useState(false);

	const handleConnect = () => {
		setIsConnecting(true);
		setError('');

		connectAiCredits(
			email,
			password,
			// The Customer Portal has no 2FA — only the agency/staff login does.
			!asCustomer && needsTwoFactorCode ? twoFactorCode : undefined,
			createAccount,
			asCustomer,
			asCustomer && createAccount ? firstName : undefined,
			asCustomer && createAccount ? lastName : undefined
		)
			.then(() => onConnected())
			.catch((requestError) => {
				const body = requestError?.response?.data as
					| AiCreditsErrorBody
					| undefined;

				if ('vulopilot_vulocloud_two_factor_required' === body?.code) {
					setNeedsTwoFactorCode(true);
					setError(
						body?.message ||
							__(
								'Enter the two-factor authentication code for your VuloCloud account.',
								'vulopilot'
							)
					);
				} else {
					setError(
						body?.message ||
							__(
								'Could not connect to VuloCloud. Please try again.',
								'vulopilot'
							)
					);
				}
			})
			.finally(() => setIsConnecting(false));
	};

	return (
		<div className="ai-credits-connect-panel">
			<div className="ai-credits-connect-panel-title">
				{createAccount
					? __('Create your free VuloCloud account', 'vulopilot')
					: __('Connect your VuloCloud account', 'vulopilot')}
			</div>
			<div className="ai-credits-connect-panel-desc">
				{__(
					'Claim 100 Free AI Credits — no credit card required.',
					'vulopilot'
				)}
			</div>

			<FormGroupWrapperComponent>
				<FormGroupComponent label={__('Account type', 'vulopilot')}>
					<SelectInput
						type="single-select"
						name="ai_credits_account_type"
						value={asCustomer ? 'customer' : 'agency'}
						onChange={(value) =>
							setAsCustomer('customer' === value)
						}
						options={[
							{
								value: 'agency',
								label: __(
									'I manage multiple client sites',
									'vulopilot'
								),
							},
							{
								value: 'customer',
								label: __(
									"I'm a solo site owner",
									'vulopilot'
								),
							},
						]}
					/>
				</FormGroupComponent>
				<FormGroupComponent label={__('Email', 'vulopilot')}>
					<TextInput
						name="ai_credits_email"
						type="email"
						value={email}
						onChange={(value) => setEmail(value as string)}
					/>
				</FormGroupComponent>
				<FormGroupComponent label={__('Password', 'vulopilot')}>
					<TextInput
						name="ai_credits_password"
						type="password"
						value={password}
						onChange={(value) => setPassword(value as string)}
					/>
				</FormGroupComponent>
				{asCustomer && createAccount && (
					<>
						<FormGroupComponent
							label={__('First name', 'vulopilot')}
						>
							<TextInput
								name="ai_credits_first_name"
								value={firstName}
								onChange={(value) =>
									setFirstName(value as string)
								}
							/>
						</FormGroupComponent>
						<FormGroupComponent
							label={__('Last name', 'vulopilot')}
						>
							<TextInput
								name="ai_credits_last_name"
								value={lastName}
								onChange={(value) =>
									setLastName(value as string)
								}
							/>
						</FormGroupComponent>
					</>
				)}
				{!asCustomer && needsTwoFactorCode && (
					<FormGroupComponent
						label={__(
							'Two-factor authentication code',
							'vulopilot'
						)}
					>
						<TextInput
							name="ai_credits_two_factor_code"
							value={twoFactorCode}
							onChange={(value) =>
								setTwoFactorCode(value as string)
							}
						/>
					</FormGroupComponent>
				)}
				{'' !== error && (
					<FormGroupComponent>
						<NoticeComponent
							displayPosition="inline-notice"
							type="error"
							title={error}
						/>
					</FormGroupComponent>
				)}
				<FormGroupComponent label=" ">
					<ButtonInput
						position="left"
						buttons={{
							text: isConnecting
								? __('Connecting…', 'vulopilot')
								: createAccount
									? __(
											'Create account & claim credits',
											'vulopilot'
										)
									: __('Connect & claim credits', 'vulopilot'),
							onClick: handleConnect,
							disabled:
								isConnecting ||
								'' === email ||
								'' === password ||
								(!asCustomer &&
									needsTwoFactorCode &&
									'' === twoFactorCode) ||
								(asCustomer &&
									createAccount &&
									('' === firstName || '' === lastName)),
						}}
					/>
				</FormGroupComponent>
			</FormGroupWrapperComponent>

			<button
				type="button"
				className="ai-credits-connect-panel-toggle"
				onClick={() => setCreateAccount(!createAccount)}
			>
				{createAccount
					? __('Already have a VuloCloud account? Log in', 'vulopilot')
					: __('New to VuloCloud? Create an account', 'vulopilot')}
			</button>
		</div>
	);
};

export default AiCreditsIndicator;
