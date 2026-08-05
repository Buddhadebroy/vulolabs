import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { useSectionStatus } from '../../services/useSectionStatus';
import './ImproveSpeed.scss';

interface MetricTile {
	id: string;
	icon: string;
	title: string;
	desc: string;
}

const METRIC_TILES: MetricTile[] = [
	{
		id: 'core-web-vitals',
		icon: 'analytics',
		title: __('Core Web Vitals', 'vulopilot'),
		desc: __('LCP, INP, CLS, and FCP — see the Performance Score card above.', 'vulopilot'),
	},
	{
		id: 'caching',
		icon: 'refresh-bold',
		title: __('Caching', 'vulopilot'),
		desc: __('Page caching effectiveness.', 'vulopilot'),
	},
	{
		id: 'css-optimization',
		icon: 'coding',
		title: __('CSS Optimization', 'vulopilot'),
		desc: __('Unused or render-blocking CSS.', 'vulopilot'),
	},
	{
		id: 'javascript',
		icon: 'shortcode',
		title: __('JavaScript', 'vulopilot'),
		desc: __('Unused or blocking JavaScript.', 'vulopilot'),
	},
	{
		id: 'images',
		icon: 'image',
		title: __('Images', 'vulopilot'),
		desc: __('Oversized or unoptimized images.', 'vulopilot'),
	},
	{
		id: 'fonts',
		icon: 'text-fields',
		title: __('Fonts', 'vulopilot'),
		desc: __('Web font loading performance.', 'vulopilot'),
	},
	{
		id: 'database-cleanup',
		icon: 'database',
		title: __('Database Cleanup', 'vulopilot'),
		desc: __('Post revisions, transients, and other bloat.', 'vulopilot'),
	},
	{
		id: 'lazy-loading',
		icon: 'eye',
		title: __('Lazy Loading', 'vulopilot'),
		desc: __('Deferred loading for below-the-fold content.', 'vulopilot'),
	},
	{
		id: 'cdn',
		icon: 'global-community',
		title: __('CDN', 'vulopilot'),
		desc: __('Content delivery network coverage.', 'vulopilot'),
	},
	{
		id: 'performance-monitor',
		icon: 'analytics',
		title: __('Performance Monitor', 'vulopilot'),
		desc: __('Ongoing real-time performance tracking.', 'vulopilot'),
	},
];

const NOT_TRACKED_BADGE = { text: __('Not tracked yet', 'vulopilot'), color: 'indigo' };

/**
 * The mockup's 10-tile metrics grid. Only **Caching** and **Images** map
 * to real scanners in category 'performance'
 * (`classes/Scanners/Basic/CacheDetectionScanner.php` id `cache-detection`,
 * `LargeImagesScanner.php` id `large-images`) — reuses the exact real
 * "No open findings"/"N Open" badge `useSectionStatus()` already
 * produces for `TechnicalVisibilityCard.tsx` (Grow My Traffic). The other
 * 8 tiles — including "Performance Monitor," which the mockup itself
 * labels "Active" — have no real detection anywhere in this codebase
 * (confirmed: no CSS/JS/font/DB/lazy-load/CDN/real-time-monitoring
 * scanner or telemetry exists), so they render the same honest "Not
 * tracked yet" badge AEO's own not-built-yet sections already use.
 */
const MetricsGrid = () => {
	const caching = useSectionStatus('performance', ['cache-detection']);
	const images = useSectionStatus('performance', ['large-images']);

	const badgeFor = (id: string) => {
		if (id === 'caching') {
			return caching.badge ?? { text: __('No open findings', 'vulopilot'), color: 'green' };
		}
		if (id === 'images') {
			return images.badge ?? { text: __('No open findings', 'vulopilot'), color: 'green' };
		}
		return NOT_TRACKED_BADGE;
	};

	return (
		<div className="performance-metrics-grid">
			{METRIC_TILES.map((tile) => {
				const badge = badgeFor(tile.id);
				return (
					<CardComponent key={tile.id} className="performance-metric-tile">
						<i className={`performance-metric-icon adminfont-${tile.icon}`} />
						<div className="performance-metric-title">{tile.title}</div>
						<span className={`admin-badge ${badge.color}`}>{badge.text}</span>
						<div className="desc">{tile.desc}</div>
					</CardComponent>
				);
			})}
		</div>
	);
};

export default MetricsGrid;
