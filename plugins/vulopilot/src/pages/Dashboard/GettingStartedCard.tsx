import React, { useState } from 'react';
import { __ } from '@wordpress/i18n';

/** Same key the old BannerCard used, so a strip someone already dismissed stays dismissed. */
const DISMISS_KEY = 'vulopilot_getting_started_dismissed';

const UTM = '?utm_source=wpadmin&utm_medium=pluginsettings&utm_campaign=vulopilot';

const LINKS = [
	{ id: 'docs', icon: 'document', label: __('Explore docs', 'vulopilot'), href: `https://vulopilot.com/docs/${UTM}` },
	{ id: 'consult', icon: 'live-chat', label: __('Book a consultation', 'vulopilot'), href: `https://vulopilot.com/book-a-consultaion/${UTM}` },
	{ id: 'contact', icon: 'global-community', label: __('Contact us', 'vulopilot'), href: `https://vulopilot.com/contact-us/${UTM}` },
];

const isDismissed = (): boolean => {
	try {
		return '1' === window.localStorage.getItem(DISMISS_KEY);
	} catch {
		return false;
	}
};

/** "Finish setup": one soft strip with a pill per link, like VuloCart's and VuloForm's setup strips. Dismissible. */
const GettingStartedCard: React.FC = () => {
	const [dismissed, setDismissed] = useState(isDismissed);

	if (dismissed) {
		return null;
	}

	const dismiss = () => {
		try {
			window.localStorage.setItem(DISMISS_KEY, '1');
		} catch {
			// Storage blocked: hide for this visit only.
		}
		setDismissed(true);
	};

	return (
		<section className="vp-setup">
			<div>
				<strong>{__('Welcome to VuloPilot - finish setup', 'vulopilot')}</strong>
				<span>{__('Docs, help, and modules to get the most out of VuloPilot.', 'vulopilot')}</span>
			</div>
			<ol>
				{LINKS.map((link) => (
					<li key={link.id}>
						<a href={link.href} target="_blank" rel="noopener noreferrer">
							<i className={`adminfont-${link.icon}`} aria-hidden="true" />
							{link.label}
						</a>
					</li>
				))}
			</ol>
			<button type="button" className="vp-setup-close" onClick={dismiss}>
				<i className="adminfont-close" aria-hidden="true" />
				<span className="screen-reader-text">{__('Dismiss', 'vulopilot')}</span>
			</button>
		</section>
	);
};

export default GettingStartedCard;
