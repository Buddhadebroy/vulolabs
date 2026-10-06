/* global vulopilotAppLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { MetricTileComponent } from '@zyra/components';
import { useSectionStatus } from '../../services/useSectionStatus';
import { useEfficiencyChecks } from '../Security/efficiencyChecks';
import './Performance.scss';

interface MetricTileData {
	id: string;
	/**
	 * `"{adminfont name} {color-palette key}"` - same icon-name-plus-palette-key convention
	 * CATEGORY_CARDS (SeoTab.tsx) and GeoScoreSection.tsx already use.
	 */
	icon: string;
	title: string;
	desc: string;
}

const METRIC_TILES: MetricTileData[] = [
	{
		id: 'core-web-vitals',
		icon: 'analytics violet',
		title: __('Core Web Vitals', 'vulopilot'),
		desc: __('LCP, INP, CLS, and FCP - see the Performance Score card above.', 'vulopilot'),
	},
	{
		id: 'caching',
		icon: 'refresh-bold blue',
		title: __('Caching', 'vulopilot'),
		desc: __('Page caching effectiveness.', 'vulopilot'),
	},
	{
		id: 'css-optimization',
		icon: 'coding sky',
		title: __('CSS Optimization', 'vulopilot'),
		desc: __('Unused or render-blocking CSS.', 'vulopilot'),
	},
	{
		id: 'javascript',
		icon: 'shortcode yellow',
		title: __('JavaScript', 'vulopilot'),
		desc: __('Unused or blocking JavaScript.', 'vulopilot'),
	},
	{
		id: 'images',
		icon: 'image green',
		title: __('Images', 'vulopilot'),
		desc: __('Oversized or unoptimized images.', 'vulopilot'),
	},
	{
		id: 'fonts',
		icon: 'text-fields red',
		title: __('Fonts', 'vulopilot'),
		desc: __('Web font loading performance.', 'vulopilot'),
	},
	{
		id: 'database-cleanup',
		icon: 'database orange',
		title: __('Database Cleanup', 'vulopilot'),
		desc: __('Post revisions, transients, and other bloat.', 'vulopilot'),
	},
	{
		id: 'lazy-loading',
		icon: 'eye teal',
		title: __('Lazy Loading', 'vulopilot'),
		desc: __('Deferred loading for below-the-fold content.', 'vulopilot'),
	},
	{
		id: 'cdn',
		icon: 'global-community indigo',
		title: __('CDN', 'vulopilot'),
		desc: __('Content delivery network coverage.', 'vulopilot'),
	},
	{
		id: 'page-caching',
		icon: 'refresh-bold blue',
		title: __('Page caching', 'vulopilot'),
		desc: __(
			'WordPress may be rebuilding pages that could otherwise be served from a saved copy.',
			'vulopilot'
		),
	},
	{
		id: 'browser-caching',
		icon: 'global-community indigo',
		title: __('Browser caching', 'vulopilot'),
		desc: __('Visitors can reuse suitable website files.', 'vulopilot'),
	},
	{
		id: 'persistent-object-cache',
		icon: 'database orange',
		title: __('Persistent object cache', 'vulopilot'),
		desc: __(
			'Your website may benefit from keeping frequently used WordPress data ready between visits.',
			'vulopilot'
		),
	},
	{
		id: 'php-acceleration',
		icon: 'coding violet',
		title: __('PHP acceleration', 'vulopilot'),
		desc: __('Whether OPcache is enabled and speeding up PHP execution.', 'vulopilot'),
	},
];

/**
 * Tile ids backed by `GET /efficiency-checks` (EfficiencyChecks.php) instead of a
 * category-'performance' scanner.
 */
const EFFICIENCY_TILE_IDS = [
	'page-caching',
	'browser-caching',
	'persistent-object-cache',
	'php-acceleration',
];

const NOT_TRACKED_BADGE = { text: __('Not tracked', 'vulopilot'), color: 'pink' };
const OPEN_FALLBACK_BADGE = { text: __('No findings', 'vulopilot'), color: 'red' };

/** Same status→color mapping EfficiencySummaryCard.tsx's own `efficiency-check-icon--{status}` styling implies (good=green, attention=orange, not_applicable=neutral). */
const EFFICIENCY_STATUS_COLOR: Record<string, string> = {
	good: 'green',
	attention: 'orange',
	not_applicable: 'indigo',
};

/**
 * Each scanner-backed tile's own real section on the "Top Issues" table below
 * (PerformanceTab.tsx's own `SECTIONS`, kept in sync by hand).
 */
const SECTION_KEY_BY_TILE_ID: Record<string, string> = {
	caching: 'caching-delivery',
	'css-optimization': 'code-optimization',
	javascript: 'code-optimization',
	images: 'images-media',
	fonts: 'loading-fonts',
	'database-cleanup': 'plugins-database',
	'lazy-loading': 'loading-fonts',
	cdn: 'caching-delivery',
	'page-caching': 'caching-delivery',
	'browser-caching': 'caching-delivery',
	'persistent-object-cache': 'caching-delivery',
	'php-acceleration': 'caching-delivery',
};

interface CoreWebVitalsSummary {
	sample_count: number;
}

const MIN_CWV_SAMPLES = 10;

interface MetricsGridProps {
	 
	// eslint-disable-next-line no-unused-vars
	onViewSection: (sectionKey: string) => void;
	onViewCoreWebVitals: () => void;
}

const MetricsGrid = ({
	onViewSection,
	onViewCoreWebVitals,
}: MetricsGridProps) => {
	const caching = useSectionStatus('performance', ['cache-detection']);
	const images = useSectionStatus('performance', ['large-images']);
	const cssOptimization = useSectionStatus('performance', ['css-optimization']);
	const javascript = useSectionStatus('performance', ['javascript-optimization']);
	const fonts = useSectionStatus('performance', ['fonts']);
	const lazyLoading = useSectionStatus('performance', ['lazy-loading']);
	const cdn = useSectionStatus('performance', ['cdn']);
	const databaseCleanup = useSectionStatus('performance', ['database-cleanup']);
	const { data: efficiencyData } = useEfficiencyChecks();

	const [vitalsSummary, setVitalsSummary] = useState<CoreWebVitalsSummary | null>(null);

	useEffect(() => {
		getApiResponse<CoreWebVitalsSummary>(
			getApiLink(vulopilotAppLocalizer, 'core-web-vitals'),
			{ headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } }
		).then((response) => {
			if (response) {
				setVitalsSummary(response);
			}
		});
	}, []);

	const SECTION_STATUS_BY_TILE: Record<string, ReturnType<typeof useSectionStatus>> = {
		caching,
		images,
		'css-optimization': cssOptimization,
		javascript,
		fonts,
		'lazy-loading': lazyLoading,
		cdn,
		'database-cleanup': databaseCleanup,
	};

	/** Same real lookup `badgeFor()` uses, extracted so `descFor()` can reach the same check without duplicating the flatMap. */
	const efficiencyCheckFor = (id: string) =>
		efficiencyData?.sections
			.flatMap((section) => section.checks)
			.find((item) => item.id === id);

	const badgeFor = (id: string) => {
		if (id === 'core-web-vitals') {
			if (!vitalsSummary) {
				return NOT_TRACKED_BADGE;
			}

			return vitalsSummary.sample_count >= MIN_CWV_SAMPLES
				? { text: __('Tracking', 'vulopilot'), color: 'green' }
				: {
						text: sprintf(
							/* translators: %d is how many real visitor samples have been collected so far. */
							__('Collecting data (%d)', 'vulopilot'),
							vitalsSummary.sample_count
						),
						color: 'indigo',
					};
		}

		if (EFFICIENCY_TILE_IDS.includes(id)) {
			const check = efficiencyCheckFor(id);

			if (!check) {
				return NOT_TRACKED_BADGE;
			}

			return {
				text: check.badge,
				color: EFFICIENCY_STATUS_COLOR[check.status],
			};
		}

		const badge = SECTION_STATUS_BY_TILE[id]?.badge ?? OPEN_FALLBACK_BADGE;

		// Same real "N Open · N {Severity} Severity" text useSectionStatus()'s own `badge` always
		// builds - just the "N Open" half kept here (just this grid's own tiles, per direct
		// instruction: one number, not two) rather than in that shared hook, which other real
		// callers still read as-is. "No Open Findings"/"Not tracked yet" have no " · " to split on,
		// so they pass through unchanged.
		return { ...badge, text: badge.text.split(' · ')[0] };
	};

	/**
	 * `MetricTileComponent`'s own `desc` accepts any React node.
	 */
	const descFor = (id: string, fallback: string) => {
		if (id !== 'php-acceleration') {
			return fallback;
		}

		const check = efficiencyCheckFor(id);

		if (!check || check.technical_details.length === 0) {
			return fallback;
		}

		return (
			<>
				<div className="accessibility-check-desc">{fallback}</div>
				<ul className="efficiency-check-details efficiency-check-details--compact">
					{check.technical_details.map((detail) => (
						<li key={detail.label} className={`is-${detail.status}`}>
							<span className="efficiency-check-detail-dot" />
							<span className="efficiency-check-detail-text">
								<strong>{detail.label}:</strong> {detail.value}
							</span>
						</li>
					))}
				</ul>
			</>
		);
	};

	const handleView = (tileId: string) => {
		if (tileId === 'core-web-vitals') {
			onViewCoreWebVitals();
			return;
		}

		const sectionKey = SECTION_KEY_BY_TILE_ID[tileId];

		if (sectionKey) {
			onViewSection(sectionKey);
		}
	};

	return (
		<MetricTileComponent
			cols={3}
			data={METRIC_TILES.map((tile) => ({
				id: tile.id,
				icon: tile.icon,
				title: tile.title,
				badge: {
					...badgeFor(tile.id),
					onClick: () => handleView(tile.id),
				},
				desc: descFor(tile.id, tile.desc),
			}))}
		/>
	);
};

export default MetricsGrid;