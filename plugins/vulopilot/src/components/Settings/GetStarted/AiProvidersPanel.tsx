/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	FormGroupWrapperComponent,
	FormGroupComponent,
	NoticeComponent,
	NoticeManager,
	PopupComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import ShowProPopup from '../../Popup/Popup';

interface VuloCloudStatus {
	/** Is this site connected to a VuloCloud account at all (a real site secret exists)? */
	connected: boolean;
	/** Does an Organization's own (or an allowed Customer backup) AI provider key actually resolve for this site right now? */
	configured: boolean;
}

interface AiProvidersResponse {
	vulocloud_status: VuloCloudStatus;
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * Settings → Connections → AI Providers.
 *
 * Every cloud AI provider (OpenAI, Gemini, Anthropic, OpenRouter, Groq) and
 * the self-hosted Ollama option this panel used to let a site owner
 * individually configure with their own credentials are gone by direct
 * instruction: VuloCloud is now the only supported way to get an AI
 * provider key, so this panel is just the "Connect to VuloCloud"/
 * "Disconnect" section — no local `vulopilot_ai_provider_configs` UI at
 * all anymore. See Controllers\AiProviders' own docblock (GET-only now)
 * and AIAssistant.tsx's own "Online" badge (now checks `vulocloud_status`
 * too, not just a local provider row that can no longer exist for a new
 * site).
 */
const AiProvidersPanel = () => {
	const [vulocloudStatus, setVulocloudStatus] = useState<VuloCloudStatus>({
		connected: false,
		configured: false,
	});
	const [isConnectingToVulocloud, setIsConnectingToVulocloud] = useState(false);
	const [isDisconnectingFromVulocloud, setIsDisconnectingFromVulocloud] = useState(false);
	const [showVulocloudDisconnectConfirm, setShowVulocloudDisconnectConfirm] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	const load = () => {
		setIsLoading(true);

		getApiResponse<AiProvidersResponse>(
			getApiLink(appLocalizer, 'ai-providers'),
			nonceHeaders
		)
			.then((response) => {
				if (!response) {
					return;
				}

				setVulocloudStatus(response.vulocloud_status);
			})
			.finally(() => setIsLoading(false));
	};

	useEffect(load, []);

	// ConnectBrokerCallbackHandler.php's own redirect lands back on this
	// exact URL carrying `connect_status=connected|error` as a real signal
	// — same `?_status=` redirect-flag handling
	// useGoogleServicesConnection.ts's own hook already establishes for
	// the Google Connect broker.
	useEffect(() => {
		const params = new URLSearchParams(
			window.location.hash.split('?')[1] || window.location.hash.substring(1)
		);
		const connectStatus = params.get('connect_status');

		if ('connected' === connectStatus) {
			NoticeManager.add({
				uniqueKey: 'vulopilot-connect-broker-connected',
				type: 'success',
				position: 'float',
				message: __('Connected to VuloCloud.', 'vulopilot'),
			});
		} else if ('error' === connectStatus) {
			NoticeManager.add({
				uniqueKey: 'vulopilot-connect-broker-failed',
				type: 'error',
				position: 'float',
				message: __('Could not connect to VuloCloud. Please try again.', 'vulopilot'),
			});
		}
	}, []);

	const handleConnectToVulocloud = () => {
		setIsConnectingToVulocloud(true);

		getApiResponse<{ url: string }>(
			getApiLink(appLocalizer, 'ai-providers/broker-authorize-url'),
			nonceHeaders
		)
			.then((response) => {
				if (response?.url) {
					window.location.href = response.url;
					return;
				}

				setIsConnectingToVulocloud(false);
				NoticeManager.add({
					uniqueKey: 'vulopilot-connect-broker-unavailable',
					type: 'error',
					position: 'float',
					message: __('VuloCloud isn’t configured for this build yet.', 'vulopilot'),
				});
			})
			.catch(() => setIsConnectingToVulocloud(false));
	};

	/** Opens the confirm popup — the actual disconnect runs from `handleConfirmDisconnectVulocloud` once the user confirms there. */
	const handleDisconnectFromVulocloud = () => {
		setShowVulocloudDisconnectConfirm(true);
	};

	const handleConfirmDisconnectVulocloud = () => {
		setShowVulocloudDisconnectConfirm(false);
		setIsDisconnectingFromVulocloud(true);

		sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'ai-credits/disconnect'), {})
			.then((response) => {
				NoticeManager.add({
					uniqueKey: 'vulopilot-vulocloud-disconnected',
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __('Disconnected from VuloCloud.', 'vulopilot')
						: __('Could not disconnect from VuloCloud.', 'vulopilot'),
				});

				if (response) {
					load();
				}
			})
			.finally(() => setIsDisconnectingFromVulocloud(false));
	};

	return (
		<>
			<FormGroupWrapperComponent>
				{isLoading ? (
					<div className="desc">{__('Loading…', 'vulopilot')}</div>
				) : (
					<FormGroupComponent label={__('VuloCloud AI', 'vulopilot')}>
						{!vulocloudStatus.connected ? (
							<>
								<NoticeComponent
									displayPosition="inline"
									type="info"
									message={__(
										'Connect this site to VuloCloud to use an AI provider key managed by your Organization.',
										'vulopilot'
									)}
								/>
								<ButtonInput
									position="left"
									buttons={{
										text: isConnectingToVulocloud
											? __('Connecting…', 'vulopilot')
											: __('Connect to VuloCloud', 'vulopilot'),
										disabled: isConnectingToVulocloud,
										onClick: handleConnectToVulocloud,
									}}
								/>
							</>
						) : (
							<>
								{vulocloudStatus.configured ? (
									<NoticeComponent
										displayPosition="inline"
										type="success"
										message={__(
											'Connected — an AI provider key is configured for this site by your Organization (or an allowed personal backup key).',
											'vulopilot'
										)}
									/>
								) : (
									<NoticeComponent
										displayPosition="inline"
										type="warning"
										message={__(
											'Connected to VuloCloud, but no AI provider key is configured yet for this site. Add one from your VuloCloud account, or ask your agency to.',
											'vulopilot'
										)}
									/>
								)}
								<ButtonInput
									position="left"
									buttons={{
										text: isDisconnectingFromVulocloud
											? __('Disconnecting…', 'vulopilot')
											: __('Disconnect', 'vulopilot'),
										disabled: isDisconnectingFromVulocloud,
										onClick: handleDisconnectFromVulocloud,
									}}
								/>
							</>
						)}
					</FormGroupComponent>
				)}
			</FormGroupWrapperComponent>
			<PopupComponent
				position="lightbox"
				open={showVulocloudDisconnectConfirm}
				onClose={() => setShowVulocloudDisconnectConfirm(false)}
				width={31.25}
				height="auto"
			>
				<ShowProPopup
					confirmMode
					title={__('Disconnect VuloCloud', 'vulopilot')}
					confirmMessage={__(
						'Disconnect this site from VuloCloud? AI features that rely on your Organization’s key will stop working until you connect again.',
						'vulopilot'
					)}
					confirmYesText={__('Disconnect', 'vulopilot')}
					confirmNoText={__('Cancel', 'vulopilot')}
					onConfirm={handleConfirmDisconnectVulocloud}
					onCancel={() => setShowVulocloudDisconnectConfirm(false)}
				/>
			</PopupComponent>
		</>
	);
};

export default AiProvidersPanel;
