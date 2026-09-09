import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { FormGroupComponent, FormGroupWrapperComponent, NoticeComponent } from '@zyra/components';
import { ButtonInput, SelectInput, TextInput } from '@zyra/inputs';
import { AiCreditsErrorBody, connectAiCredits } from '../../services/useAiCredits';

/**
 * The "connect/create a VuloCloud account" form — `connectAiCredits()`'s
 * whole install→claim→connect orchestration (that hook's own docblock),
 * wrapped in a UI. Extracted out of AiCreditsIndicator.tsx (still its one
 * original consumer, rendered inside that component's own dropdown) once
 * Settings → Connections → AI Providers needed the identical form
 * embedded directly on the page — connecting is what makes BYOK-via-
 * VuloCloud possible at all (ProviderRegistry::build_provider()'s own
 * docblock on the 'vulocloud' adapter), so that panel needing its own
 * copy of "not connected yet" text with no way to act on it right there
 * was a real gap, not a deliberate omission.
 */
const AiCreditsConnectForm = ({ onConnected }: { onConnected: () => void }) => {
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
				const body = requestError?.response?.data as AiCreditsErrorBody | undefined;

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
							__('Could not connect to VuloCloud. Please try again.', 'vulopilot')
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
				{__('Claim 100 Free AI Credits — no credit card required.', 'vulopilot')}
			</div>

			<FormGroupWrapperComponent>
				<FormGroupComponent label={__('Account type', 'vulopilot')}>
					<SelectInput
						type="single-select"
						name="ai_credits_account_type"
						value={asCustomer ? 'customer' : 'agency'}
						onChange={(value) => setAsCustomer('customer' === value)}
						options={[
							{
								value: 'agency',
								label: __('I manage multiple client sites', 'vulopilot'),
							},
							{
								value: 'customer',
								label: __("I'm a solo site owner", 'vulopilot'),
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
						<FormGroupComponent label={__('First name', 'vulopilot')}>
							<TextInput
								name="ai_credits_first_name"
								value={firstName}
								onChange={(value) => setFirstName(value as string)}
							/>
						</FormGroupComponent>
						<FormGroupComponent label={__('Last name', 'vulopilot')}>
							<TextInput
								name="ai_credits_last_name"
								value={lastName}
								onChange={(value) => setLastName(value as string)}
							/>
						</FormGroupComponent>
					</>
				)}
				{!asCustomer && needsTwoFactorCode && (
					<FormGroupComponent label={__('Two-factor authentication code', 'vulopilot')}>
						<TextInput
							name="ai_credits_two_factor_code"
							value={twoFactorCode}
							onChange={(value) => setTwoFactorCode(value as string)}
						/>
					</FormGroupComponent>
				)}
				{'' !== error && (
					<FormGroupComponent>
						<NoticeComponent displayPosition="inline-notice" type="error" title={error} />
					</FormGroupComponent>
				)}
				<FormGroupComponent label=" ">
					<ButtonInput
						position="left"
						buttons={{
							text: isConnecting
								? __('Connecting…', 'vulopilot')
								: createAccount
									? __('Create account & claim credits', 'vulopilot')
									: __('Connect & claim credits', 'vulopilot'),
							onClick: handleConnect,
							disabled:
								isConnecting ||
								'' === email ||
								'' === password ||
								(!asCustomer && needsTwoFactorCode && '' === twoFactorCode) ||
								(asCustomer && createAccount && ('' === firstName || '' === lastName)),
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

export default AiCreditsConnectForm;
