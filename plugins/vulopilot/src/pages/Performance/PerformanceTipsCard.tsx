import { __ } from '@wordpress/i18n';
import { CardComponent, ListComponent } from '@zyra/components';
import { useApiList } from '../../services/useApiList';

interface FindingRow {
	scanner_id: string;
}

interface Tip {
	id: string;
	icon: string;
	title: string;
	desc: string;
}

const GENERIC_TIPS: Tip[] = [
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
];

/**
 * scanner_id => the tip relevant to that exact open finding. Only scanners
 * this page's own MetricsGrid tiles/QuickActionsCard already cover — a tip
 * a visitor can actually act on from this page, not a generic best-practice
 * unconnected to anything shown here.
 */
const TIP_BY_SCANNER_ID: Record<string, Tip> = {
	'cache-detection': {
		id: 'cache-detection',
		icon: 'refresh-bold',
		title: __('Enable Full Page Cache', 'vulopilot'),
		desc: __('No caching plugin detected — a caching layer significantly reduces load time.', 'vulopilot'),
	},
	'large-images': {
		id: 'large-images',
		icon: 'image',
		title: __('Compress your large images', 'vulopilot'),
		desc: __('Use the "Optimize Images" quick action, or convert to WebP.', 'vulopilot'),
	},
	'css-optimization': {
		id: 'css-optimization',
		icon: 'coding',
		title: __('Minify your CSS', 'vulopilot'),
		desc: __('Un-minified stylesheets found — use the "Minify CSS & JS" quick action.', 'vulopilot'),
	},
	'javascript-optimization': {
		id: 'javascript-optimization',
		icon: 'shortcode',
		title: __('Minify your JavaScript', 'vulopilot'),
		desc: __('Un-minified scripts found — use the "Minify CSS & JS" quick action.', 'vulopilot'),
	},
	fonts: {
		id: 'fonts',
		icon: 'text-fields',
		title: __('Self-host your web fonts', 'vulopilot'),
		desc: __('Externally-hosted Google Fonts add an extra connection and can block rendering.', 'vulopilot'),
	},
	'lazy-loading': {
		id: 'lazy-loading',
		icon: 'eye',
		title: __('Re-enable lazy loading', 'vulopilot'),
		desc: __('Native lazy-loading is disabled — use the "Enable Lazy Loading" quick action.', 'vulopilot'),
	},
	cdn: {
		id: 'cdn',
		icon: 'global-community',
		title: __('Serve assets from a CDN', 'vulopilot'),
		desc: __('No CDN detected — a CDN serves assets from servers closer to each visitor.', 'vulopilot'),
	},
	'database-cleanup': {
		id: 'database-cleanup',
		icon: 'database',
		title: __('Clean up your database', 'vulopilot'),
		desc: __('Expired transients and old revisions found — use the "Database Cleanup" quick action.', 'vulopilot'),
	},
};

/**
 * "Performance Tips" — real, data-driven: fetches open category-'performance'
 * findings (`useApiList('findings', ...)`, same call shape SpeedBoostCard
 * already makes) and shows the tip for each distinct open
 * `scanner_id`, so the list reflects this site's actual current state
 * instead of static copy. Falls back to 3 generic best-practice tips only
 * when there's nothing open to recommend against.
 */
const PerformanceTipsCard = () => {
	const { data: findings, isLoading } = useApiList<FindingRow>('findings', {
		category: 'performance',
		status: 'open',
		per_page: 100,
	});

	const relevantTips = !isLoading
		? Array.from(new Set(findings.map((finding) => finding.scanner_id)))
				.map((scannerId) => TIP_BY_SCANNER_ID[scannerId])
				.filter((tip): tip is Tip => Boolean(tip))
		: [];

	const tips = relevantTips.length > 0 ? relevantTips : GENERIC_TIPS;

	return (
		<CardComponent title={__('Performance Tips', 'vulopilot')} titleIcon="light" isLoading={isLoading}>
			<ListComponent className="feature-list" items={tips} />
		</CardComponent>
	);
};

export default PerformanceTipsCard;
