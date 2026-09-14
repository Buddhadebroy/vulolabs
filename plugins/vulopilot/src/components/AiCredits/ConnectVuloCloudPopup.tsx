import { __ } from '@wordpress/i18n';
import { CardComponent, PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useConnectVuloCloud } from '../../services/useConnectVuloCloud';

interface ConnectVuloCloudPopupProps {
	open: boolean;
	onClose: () => void;
}

/**
 * "Connect to VuloCloud / claim free AI credits" — the real content shown
 * for this popup, split out from the self-contained `ConnectVuloCloudPopup`
 * below so `useContentGate.tsx` can render it directly inside its own
 * existing `PopupComponent` (the same "bare content component" convention
 * `ShowProPopup` already follows there), rather than nesting two popups.
 *
 * Same real passwordless broker redirect (`useConnectVuloCloud.ts`)
 * AiCreditsIndicator.tsx's own dropdown and Settings → AI Providers'
 * "Connect to VuloCloud" button already use. This replaces the former
 * `VuloCloudConnectPopup.tsx` (a real embedded email/password + 2FA login
 * form) everywhere that component used to render, per direct instruction
 * ("remove the image 2 popup ... replace all image 2 popup to image 1") —
 * one real "Connect to VuloCloud" flow/design now, not two different ones.
 * `useContentGate.tsx`'s own lock condition was switched to match (real AI
 * credits `connected` status, the same flag this broker redirect sets) so
 * completing this flow actually clears that gate, rather than leaving it
 * checking a different, unrelated "VuloCloud account login" flag this
 * flow never touches.
 */
export const ConnectVuloCloudPromptContent = () => {
	const { isConnecting, handleConnect } = useConnectVuloCloud();

	return (
		<CardComponent
			title={__('Connect to VuloCloud', 'vulopilot')}
			titleIcon="lock"
			desc={__(
				'Claim 100 Free AI Credits — no credit card required — to use this feature.',
				'vulopilot'
			)}
		>
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
		</CardComponent>
	);
};

/**
 * Self-contained popup wrapper around `ConnectVuloCloudPromptContent` above
 * — the shape every other call site of this component already expects
 * (ChatTab.tsx, ContentToolsGrid.tsx, AiContentAssistantSidebar.tsx: a
 * plain `open`/`onClose`-controlled popup, no external `PopupComponent` of
 * their own to nest it in).
 */
const ConnectVuloCloudPopup = ({ open, onClose }: ConnectVuloCloudPopupProps) => (
	<PopupComponent
		open={open}
		onClose={onClose}
		width={22}
		height="auto"
		position="lightbox"
	>
		<ConnectVuloCloudPromptContent />
	</PopupComponent>
);

export default ConnectVuloCloudPopup;
