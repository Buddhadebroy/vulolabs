import { __ } from '@wordpress/i18n';
import { CardComponent, ListComponent } from '@zyra/components';

/**
 * "Performance Tips" — generic, non-personalized best-practice copy
 * (not fabricated site-specific data), same spirit as the mockup's own
 * text. Drops the mockup's "View all tips" link — no dedicated tips
 * library exists anywhere in this codebase for it to point at.
 */
const PerformanceTipsCard = () => {
	return (
		<CardComponent title={__('Performance Tips', 'vulopilot')} titleIcon="light">
			<ListComponent
				className="feature-list"
				items={[
					{
						id: 'webp-images',
						icon: 'image',
						title: __('Use WebP images', 'vulopilot'),
						desc: __('Convert images to WebP format.', 'vulopilot'),
					},
					{
						id: 'full-page-cache',
						icon: 'refresh-bold',
						title: __('Enable Full Page Cache', 'vulopilot'),
						desc: __('Reduce server load and response time.', 'vulopilot'),
					},
					{
						id: 'minify-css-js',
						icon: 'coding',
						title: __('Minify CSS & JavaScript', 'vulopilot'),
						desc: __('Remove unnecessary characters.', 'vulopilot'),
					},
				]}
			/>
		</CardComponent>
	);
};

export default PerformanceTipsCard;
