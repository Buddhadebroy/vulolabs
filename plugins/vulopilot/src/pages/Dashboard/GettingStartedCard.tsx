import React, { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { ButtonInput } from '@zyra/inputs';
import { CardComponent } from '@zyra/components';

/**
 * Compact, collapsible, dismissible "finish setup" banner — replaces the
 * old WelcomeSection's much larger welcome banner + Modules grid + Extend
 * your website + Need help getting started cards, none of which exist in
 * the Dashboard mockup this page is modeled on. Same-publisher quick
 * links the old WelcomeSection used (VuloLabs/dualcube docs, consultation,
 * Discord — no confirmed VuloPilot-specific URLs exist anywhere in this
 * codebase), plus a shortcut into Modules for CatalogX/Notifima instead of
 * duplicating their real install/activate flow, which still lives on the
 * Modules page itself.
 */
const GettingStartedCard: React.FC = () => {
	const [dismissed, setDismissed] = useState(false);

	if (dismissed) {
		return null;
	}

	return (
		<CardComponent
			className="dashboard-getting-started"
			title={__('Welcome to VuloPilot — finish setup', 'vulopilot')}
			titleIcon="ai"
			borderColor="var(--color-primary)"
			toggle
			action={
				<i
					className="adminfont-close"
					role="button"
					tabIndex={0}
					onClick={() => setDismissed(true)}
					onKeyDown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							setDismissed(true);
						}
					}}
				/>
			}
		>
			<ButtonInput
				position="left"
				buttons={[
					{
						text: __('Explore docs', 'vulopilot'),
						icon: 'document',
						color: 'white',
						onClick: () =>
							window.open(
								'https://vulolabs.com/docs/knowledgebase/?utm_source=wpadmin&utm_medium=pluginsettings&utm_campaign=vulopilot',
								'_blank',
								'noopener,noreferrer'
							),
					},
					{
						text: __('Book a consultation', 'vulopilot'),
						icon: 'live-chat',
						color: 'white',
						onClick: () =>
							window.open(
								'https://vulolabs.com/custom-development/?utm_source=wpadmin&utm_medium=pluginsettings&utm_campaign=vulopilot',
								'_blank',
								'noopener,noreferrer'
							),
					},
					{
						text: __('Join Discord', 'vulopilot'),
						icon: 'global-community',
						color: 'white',
						onClick: () =>
							window.open(
								'https://discord.com/channels/1376811097134469191/1376811102020829258',
								'_blank',
								'noopener,noreferrer'
							),
					},
					{
						text: __('Extend: CatalogX, Notifima', 'vulopilot'),
						icon: 'cart',
						color: 'white',
						onClick: () => {
							window.location.href =
								'?page=vulopilot#&tab=modules';
						},
					},
				]}
			/>
		</CardComponent>
	);
};

export default GettingStartedCard;
