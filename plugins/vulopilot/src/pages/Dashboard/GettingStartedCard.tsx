import React from 'react';
import { __ } from '@wordpress/i18n';
import BannerCard from '../../components/BannerCard';

/**
 * Compact, dismissible "finish setup" banner.
 */
const GettingStartedCard: React.FC = () => (
	<BannerCard
		dismissible
		dismissKey="vulopilot_getting_started_dismissed"
		title={__('Welcome to VuloPilot - finish setup', 'vulopilot')}
		desc={__('Docs, help, and modules to get the most out of VuloPilot.', 'vulopilot')}
			buttons={[
				{
					text: __('Explore docs', 'vulopilot'),
					icon: 'document',
					color: 'purple-bg',
					onClick: () =>
						window.open(
							'https://vulopilot.com/docs/?utm_source=wpadmin&utm_medium=pluginsettings&utm_campaign=vulopilot',
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
							'https://vulopilot.com/book-a-consultaion/?utm_source=wpadmin&utm_medium=pluginsettings&utm_campaign=vulopilot',
							'_blank',
							'noopener,noreferrer'
						),
				},
				{
					text: __('Contact Us', 'vulopilot'),
					icon: 'global-community',
					color: 'white',
					onClick: () =>
						window.open(
							'https://vulopilot.com/contact-us/?utm_source=wpadmin&utm_medium=pluginsettings&utm_campaign=vulopilot',
							'_blank',
							'noopener,noreferrer'
						),
				},
			]}
	/>
);

export default GettingStartedCard;
