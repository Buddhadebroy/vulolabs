import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import {
	CardComponent,
	FormGroupComponent,
	FormGroupWrapperComponent,
	NoticeComponent,
} from '@zyra/components';
import { ButtonInput, TextInput } from '@zyra/inputs';
import {
	connectVuloCloudAccount,
	VuloCloudConnectErrorBody,
} from '../../services/useVuloCloudAccountLogin';

/**
 * "Log in to your VuloCloud account" — the real popup
 * useContentGate.tsx's own "log in" tier opens (its own docblock used to
 * say no such flow existed anywhere in this codebase; this is that flow).
 * A real `POST vulocloud-account/connect` (VuloCloudAccount::connect(),
 * proxying to VuloCloud's own `POST /auth/login`), not a mock form —
 * same "real email/password login, server-side proxy" shape
 * vulopilot-pro's own LicenseManager already uses for its own
 * server-to-server VuloCloud call, just for a person's account instead of
 * a site's license.
 *
 * Two-factor is real too: VuloCloud's own `/auth/login` answers
 * `TWO_FACTOR_REQUIRED` (surfaced here as the REST error code
 * `vulopilot_vulocloud_two_factor_required`) for an account that has 2FA
 * enabled — this form reveals the code field and lets the same submit
 * button resubmit with it, rather than failing outright.
 *
 * `connectVuloCloudAccount()` reloads the page on success (see its own
 * docblock for why) — there is no "connected!" state to render here, the
 * popup and the whole locked section behind it simply disappear on the
 * next paint.
 */
const VuloCloudConnectPopup = () => {
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [twoFactorCode, setTwoFactorCode] = useState('');
	const [needsTwoFactorCode, setNeedsTwoFactorCode] = useState(false);
	const [error, setError] = useState('');
	const [isConnecting, setIsConnecting] = useState(false);

	const handleConnect = () => {
		setIsConnecting(true);
		setError('');

		connectVuloCloudAccount(
			email,
			password,
			needsTwoFactorCode ? twoFactorCode : undefined
		).catch((requestError) => {
			const body = requestError?.response?.data as
				| VuloCloudConnectErrorBody
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

			setIsConnecting(false);
		});
	};

	return (
		<CardComponent
			title={__('Connect to VuloCloud', 'vulopilot')}
			titleIcon="lock"
			desc={__(
				'Log in with your VuloCloud account to unlock this.',
				'vulopilot'
			)}
		>
			<FormGroupWrapperComponent>
				<FormGroupComponent label={__('Email', 'vulopilot')}>
					<TextInput
						name="vulocloud_email"
						type="email"
						value={email}
						onChange={(value) => setEmail(value as string)}
					/>
				</FormGroupComponent>
				<FormGroupComponent label={__('Password', 'vulopilot')}>
					<TextInput
						name="vulocloud_password"
						type="password"
						value={password}
						onChange={(value) => setPassword(value as string)}
					/>
				</FormGroupComponent>
				{needsTwoFactorCode && (
					<FormGroupComponent
						label={__('Two-factor authentication code', 'vulopilot')}
					>
						<TextInput
							name="vulocloud_two_factor_code"
							value={twoFactorCode}
							onChange={(value) => setTwoFactorCode(value as string)}
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
								: __('Connect', 'vulopilot'),
							onClick: handleConnect,
							disabled:
								isConnecting ||
								'' === email ||
								'' === password ||
								(needsTwoFactorCode && '' === twoFactorCode),
						}}
					/>
				</FormGroupComponent>
			</FormGroupWrapperComponent>
		</CardComponent>
	);
};

export default VuloCloudConnectPopup;
