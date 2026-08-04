/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import ShowProPopup from './Popup/Popup';

interface ProLockedCardProps {
	/** Pro module slug (e.g. 'geo-insights') — passed through to ShowProPopup so an already-Pro user is pointed at Modules rather than pitched an upgrade they already have. */
	moduleName: string;
	buttonText?: string;
}

/**
 * "Unlock with Pro" placeholder — shown in place of a panel/section whose
 * data only exists once a specific Pro module is active, rather than
 * rendering nothing or a misleadingly-empty "no data yet" state. Same
 * click-to-open pattern WooCommerceAiLockedCard (WooCommerce.tsx) /
 * AiAnalyticsLockedCard (AIAssistant.tsx) originated; generalized here so
 * every Pro-gated panel slot in the plugin shares one implementation
 * instead of each page re-declaring its own copy (GEO.tsx's GEO_SECTIONS
 * crawlability/freshness cards, AEO.tsx's own Pro-gated sections).
 */
const ProLockedCard = ({ moduleName, buttonText }: ProLockedCardProps) => {
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);

	return (
		<>
			<ButtonInput
				buttons={{
					text: buttonText || __('Unlock with Pro', 'vulopilot'),
					icon: 'lock',
					onClick: () => setIsProPopupOpen(true),
				}}
			/>
			<PopupComponent
				open={isProPopupOpen}
				onClose={() => setIsProPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{appLocalizer.khali_dabba ? (
					// Pro is active — this specific module just isn't
					// toggled on yet, so point at Modules rather than
					// pitching an upgrade the user already has.
					<ShowProPopup moduleName={moduleName} />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</>
	);
};

export default ProLockedCard;
