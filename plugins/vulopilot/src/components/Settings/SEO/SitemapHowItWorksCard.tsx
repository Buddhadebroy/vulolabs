import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import './SitemapHowItWorksCard.scss';

/**
 * Sitemap tab's own right-side "How it works" explainer card.
 */
const SITEMAP_STEPS: Array<{ icon: string; color: string; title: string; desc: string }> = [
	{
		icon: 'document',
		color: 'purple',
		title: __('VuloPilot creates your sitemap', 'vulopilot'),
		desc: __("We build an XML sitemap using the content types you've selected.", 'vulopilot'),
	},
	{
		icon: 'link',
		color: 'blue',
		title: __("It's published on your site", 'vulopilot'),
		desc: __('Your sitemap is available at yoursite.com/sitemap.xml once enabled.', 'vulopilot'),
	},
	{
		icon: 'search',
		color: 'green',
		title: __('Search engines can find it', 'vulopilot'),
		desc: __('Search engines read your sitemap to find new and updated content. Turn on Instant Indexing to tell them right away.', 'vulopilot'),
	},
	{
		icon: 'bar-chart',
		color: 'orange',
		title: __('Helps your content get discovered', 'vulopilot'),
		desc: __(
			'A sitemap makes it easier for search engines to find your content. Indexing is not guaranteed.',
			'vulopilot'
		),
	},
];

const SitemapHowItWorksCard = () => (
	<CardComponent
		title={__('How it works', 'vulopilot')}
		titleIcon="knowladgebase"
		desc={__('See what happens when you enable the XML sitemap.', 'vulopilot')}
	>
		<ol className="sitemap-how-it-works-steps">
			{SITEMAP_STEPS.map((step, index) => (
				<li key={index} className="sitemap-how-it-works-step">
					<span className={`sitemap-how-it-works-step-number ${step.color}`}>
						{index + 1}
					</span>
					<span className={`sitemap-how-it-works-step-icon ${step.color}`}>
						<i className={`adminfont-${step.icon}`} />
					</span>
					<span className="sitemap-how-it-works-step-body">
						<span className="sitemap-how-it-works-step-title">{step.title}</span>
						<span className="sitemap-how-it-works-step-desc">{step.desc}</span>
					</span>
				</li>
			))}
		</ol>
	</CardComponent>
);

export default SitemapHowItWorksCard;
