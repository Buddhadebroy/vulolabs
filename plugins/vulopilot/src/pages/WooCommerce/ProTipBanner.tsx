import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';

/**
 * "Pro Tip" — generic, non-personalized best-practice copy (not
 * site-specific fabricated data), same treatment Improve Speed's
 * `PerformanceTipsCard` gives its own tips. No fake "Enable Upsells"
 * action button — no such feature exists anywhere in this codebase to
 * enable, so this stays informational only rather than a dead control.
 */
const ProTipBanner = () => (
	<CardComponent className="sell-more-pro-tip" titleIcon="light" title={__('Pro Tip', 'vulopilot')}>
		<p className="desc">
			{__(
				'Clear, benefit-focused product titles and complete product data (images, categories, descriptions) consistently improve both search visibility and conversion — the Product SEO and Products tiles above are a good place to start.',
				'vulopilot'
			)}
		</p>
	</CardComponent>
);

export default ProTipBanner;
