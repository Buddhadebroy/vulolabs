/* global vulopilotAppLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { NoticeComponent, PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { formatCredits } from '../../services/useAiCredits';
import {
	INSUFFICIENT_CREDITS_EVENT,
	InsufficientCreditsDetail,
	installInsufficientCreditsInterceptor,
} from './insufficientCredits';

/** The shared "insufficient credits" prompt used by every AI feature. */
const InsufficientCreditsNotice = () => {
	const [detail, setDetail] = useState<InsufficientCreditsDetail | null>(null);

	useEffect(() => {
		installInsufficientCreditsInterceptor();
		const onInsufficient = (event: Event) =>
			setDetail((event as CustomEvent<InsufficientCreditsDetail>).detail);
		window.addEventListener(INSUFFICIENT_CREDITS_EVENT, onInsufficient);
		return () => window.removeEventListener(INSUFFICIENT_CREDITS_EVENT, onInsufficient);
	}, []);

	if (!detail) {
		return null;
	}

	return (
		<PopupComponent
			width={30}
			height="fit-content"
			open
			onClose={() => setDetail(null)}
		>
			<NoticeComponent
				displayPosition="inline-notice"
				type="warning"
				title={__('You don’t have enough credits to complete this request.', 'vulopilot')}
				message={sprintf(
					/* translators: %s: remaining AI credits, e.g. "0.000". */
					__('You have %s AI Credits remaining. Nothing was charged for this request.', 'vulopilot'),
					formatCredits(detail.creditsRemaining)
				)}
			/>
			<ButtonInput
				position="left"
				buttons={[
					{
						text: __('Buy Credits', 'vulopilot'),
						leftIcon: 'cart',
						color: 'purple-bg',
						onClick: () => {
							window.open(
								detail.buyCreditsUrl || vulopilotAppLocalizer.shop_url,
								'_blank',
								'noopener,noreferrer'
							);
						},
					},
				]}
			/>
		</PopupComponent>
	);
};

export default InsufficientCreditsNotice;
