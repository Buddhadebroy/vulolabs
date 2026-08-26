import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import './Accessibility.scss';

/**
 * Static, evergreen explainer copy — same "real content, no data source
 * needed" posture BrandVisibilityTab.tsx's own "Why this matters more than
 * backlinks" notice already takes, just as its own paired card (mockup:
 * sits beside AccessibilityHistoryChart.tsx, Pro) rather than a footer
 * notice. Not license-gated — unlike the history chart it sits next to,
 * there's no real data behind these 4 points to withhold.
 */
const WHY_IT_MATTERS_POINTS = [
	__('Helps more people use and trust your site', 'vulopilot'),
	__('Improves SEO and search visibility', 'vulopilot'),
	__('Better experience for all visitors', 'vulopilot'),
	__('Meets modern legal and industry expectations', 'vulopilot'),
];

const WhyAccessibilityMattersCard = () => (
	<CardComponent
		className="why-accessibility-matters-card"
		title={__('Why accessibility matters', 'vulopilot')}
		titleIcon="question"
	>
		<ul className="why-accessibility-matters-list">
			{WHY_IT_MATTERS_POINTS.map((point) => (
				<li key={point} className="why-accessibility-matters-row">
					<i className="adminfont-check why-accessibility-matters-icon" />
					<span>{point}</span>
				</li>
			))}
		</ul>
	</CardComponent>
);

export default WhyAccessibilityMattersCard;
