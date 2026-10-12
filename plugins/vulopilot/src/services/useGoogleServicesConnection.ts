/* global vulopilotAppLocalizer */
import axios from 'axios';
import { useCallback, useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import { NoticeManager } from '@zyra/components';

export interface GoogleServicesStatus {
	connected: boolean;
	/** Whether VuloCloud's Google OAuth broker is configured; "Connect Google Services" always routes through it. */
	has_broker: boolean;
	search_console_site: string;
	ga4_account_id: string;
	ga4_account_name: string;
	ga4_property_id: string;
	ga4_property_name: string;
	ga4_measurement_id: string;
	adsense_account_id: string;
	adsense_account_name: string;
	connected_at: string;
}

/**
 * Same real, allow-listed set GoogleServicesConnection.php's own `RETURN_TARGETS` enforces server-
 * side.
 */
export type GoogleConnectReturnTo = 'settings' | 'keywords';

const nonceHeaders = { headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } };

/**
 * Shared real Google OAuth 2.0 status/connect/disconnect logic.
 */
export const useGoogleServicesConnection = (
	returnTo: GoogleConnectReturnTo = 'settings'
) => {
	const [status, setStatus] = useState<GoogleServicesStatus | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isConnecting, setIsConnecting] = useState(false);
	const [isDisconnecting, setIsDisconnecting] = useState(false);
	const [connectError, setConnectError] = useState<string | null>(null);

	const refreshStatus = useCallback(
		() =>
			getApiResponse<GoogleServicesStatus>(
				getApiLink(vulopilotAppLocalizer, 'google-services/status'),
				nonceHeaders
			).then((response) => {
				if (response) {
					setStatus(response);
				}
				return response;
			}),
		[]
	);

	useEffect(() => {
		setIsLoading(true);
		refreshStatus().finally(() => setIsLoading(false));

		// Google's own OAuth redirect lands back on this exact URL
		// (GoogleSearchConsoleOAuthCallbackHandler.php builds it) carrying
		// `gsc_status=connected|error` as a real signal.
		const params = new URLSearchParams(
			window.location.hash.split('?')[1] || window.location.hash.substring(1)
		);
		const gscStatus = params.get('gsc_status');

		if (gscStatus === 'connected') {
			NoticeManager.add({
				uniqueKey: 'vulopilot-gsc-connected',
				type: 'success',
				position: 'float',
				message: __('Connected to Google.', 'vulopilot'),
			});
		} else if (gscStatus === 'error') {
			const message = __(
				'Could not connect to Google. Please try again.',
				'vulopilot'
			);
			setConnectError(message);
			NoticeManager.add({
				uniqueKey: 'vulopilot-gsc-connect-failed',
				type: 'error',
				position: 'float',
				message,
			});
		}
	}, []);

	const connect = useCallback(() => {
		setIsConnecting(true);
		setConnectError(null);

		// Raw axios (not getApiResponse): a failing broker answers 502 with its own reason, and
		// getApiResponse would swallow that body.
		axios
			.get<{ url?: string }>(
				getApiLink(
					vulopilotAppLocalizer,
					`google-services/authorize-url?return_to=${returnTo}`
				),
				nonceHeaders
			)
			.then((response) => {
				if (response.data?.url) {
					// Real top-level handoff to Google's own consent screen.
					window.location.href = response.data.url;
					return;
				}

				throw new Error('no-url');
			})
			.catch((error) => {
				const message =
					error?.response?.data?.message ??
					__(
						'Could not start the Google connection. Please try again.',
						'vulopilot'
					);
				setConnectError(message);
				NoticeManager.add({
					uniqueKey: 'vulopilot-gsc-authorize-url-failed',
					type: 'error',
					position: 'float',
					message,
				});
				setIsConnecting(false);
			});
	}, [returnTo]);

	const disconnect = useCallback(
		() =>
			new Promise<void>((resolve) => {
				setIsDisconnecting(true);

				sendApiResponse<GoogleServicesStatus>(
					vulopilotAppLocalizer,
					getApiLink(vulopilotAppLocalizer, 'google-services/disconnect'),
					{}
				)
					.then((response) => {
						if (response) {
							setStatus(response);
						}
					})
					.finally(() => {
						setIsDisconnecting(false);
						resolve();
					});
			}),
		[]
	);

	return {
		status,
		setStatus,
		isLoading,
		isConnecting,
		isDisconnecting,
		connectError,
		connect,
		disconnect,
		refreshStatus,
	};
};
