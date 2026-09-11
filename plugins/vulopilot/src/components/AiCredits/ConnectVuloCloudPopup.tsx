import { __ } from '@wordpress/i18n';
import { NoticeComponent, PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useConnectVuloCloud } from '../../services/useConnectVuloCloud';

interface ConnectVuloCloudPopupProps {
	open: boolean;
	onClose: () => void;
}

/**
 * "Connect to VuloCloud / claim free AI credits" — the same real
 * passwordless broker redirect AiCreditsIndicator.tsx's own dropdown and
 * Settings → AI Providers' "Connect to VuloCloud" button already use
 * (useConnectVuloCloud.ts), pulled out into a shared popup so any page
 * that hits a real "No AI provider is configured." error can offer this
 * exact same real fix in place, rather than only a dead-end error notice.
 * Per direct instruction: sections whose real AI call can fail this way
 * (Create Content's "Chat with VuloPilot"/"Content Tools") show this
 * instead of blocking on a Pro license — both stay genuinely free, this is
 * the same free 100-credit VuloCloud connection every other "Claim free
 * AI Credits" entry point in this plugin already offers.
 *
 * Deliberately NOT the generic Pro-upsell `ShowProPopup` — connecting to
 * VuloCloud here doesn't require a license, and clicking through doesn't
 * cost anything either (VuloCloud's free tier is exactly what this
 * connects to).
 */
const ConnectVuloCloudPopup = ({ open, onClose }: ConnectVuloCloudPopupProps) => {
	const { isConnecting, handleConnect } = useConnectVuloCloud();

	return (
		<PopupComponent
			open={open}
			onClose={onClose}
			width={22}
			height="auto"
			position="lightbox"
		>
			<div className="ai-credits-connect-prompt">
				<NoticeComponent
					displayPosition="inline"
					type="info"
					title={__('No AI provider connected yet', 'vulopilot')}
					message={__(
						'Claim 100 Free AI Credits — no credit card required — to use this feature.',
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
						onClick: handleConnect,
					}}
				/>
			</div>
		</PopupComponent>
	);
};

export default ConnectVuloCloudPopup;
