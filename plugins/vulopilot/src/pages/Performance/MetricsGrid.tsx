/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	BadgeComponent,
	MetricTileComponent,
	MetricTileGridComponent,
} from '@zyra/components';
import { useSectionStatus } from '../../services/useSectionStatus';
import { useEfficiencyChecks } from '../Security/efficiencyChecks';
import './Performance.scss';

interface MetricTileData {
	id: string;
	icon: string;
	title: string;
	desc: string;
}

const METRIC_TILES: MetricTileData[] = [
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
		id: 'page-caching',
		icon: 'refresh-bold',
		title: __('Page caching', 'vulopilot'),
		desc: __(
			'WordPress may be rebuilding pages that could otherwise be served from a saved copy.',
			'vulopilot'
		),
	},
	{
		id: 'browser-caching',
		icon: 'global-community',
		title: __('Browser caching', 'vulopilot'),
		desc: __('Visitors can reuse suitable website files.', 'vulopilot'),
	},
	{
		id: 'persistent-object-cache',
		icon: 'database',
		title: __('Persistent object cache', 'vulopilot'),
		desc: __(
			'Your website may benefit from keeping frequently used WordPress data ready between visits.',
			'vulopilot'
		),
	},
];

/**
 * Tile ids backed by `GET /efficiency-checks` (Controllers\EfficiencyChecks.php)
 * instead of a category-'performance' scanner — used below only to pick
 * `badgeFor()`'s data source. Title/desc/icon above are copied verbatim
 * from that endpoint's own `check_page_caching()`/`check_browser_caching()`/
 * `check_persistent_object_cache()` (real, not fabricated for this grid);
 * the badge is computed fresh per render from the same live payload.
 * Routing-wise these 3 need no special case — `SECTION_KEY_BY_TILE_ID`
 * below sends them to the same "Caching & Delivery" Top Issues section the
 * existing Caching/CDN tiles already use.
 */
const EFFICIENCY_TILE_IDS = [
	'page-caching',
	'browser-caching',
	'persistent-object-cache',
];

const NOT_TRACKED_BADGE = { text: __('Not tracked yet', 'vulopilot'), color: 'indigo' };
const OPEN_FALLBACK_BADGE = { text: __('No open findings', 'vulopilot'), color: 'green' };

/** Same status→color mapping EfficiencySummaryCard.tsx's own `efficiency-check-icon--{status}` styling implies (good=green, attention=orange, not_applicable=neutral) — reused here for the badge instead of a CSS class since this grid's badges are plain `BadgeComponent` colors. */
const EFFICIENCY_STATUS_COLOR: Record<string, string> = {
	good: 'green',
	attention: 'orange',
	not_applicable: 'indigo',
};

/**
 * Each scanner-backed tile's own real section on the "Top Issues" table
 * below (PerformanceTab.tsx's own `SECTIONS`, kept in sync by hand) — a
 * tile's "View" button jumps straight there and switches to that section's
 * tab, same "per-tile Review button drives a shared table's activeTab"
 * pattern AccessibilityChecksGrid.tsx already established. "Core Web
 * Vitals" isn't a scanner finding (it's a live metric, not an issue), so
 * it's handled separately — see `onViewCoreWebVitals` below.
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
	// Not scanner findings (no row of their own in the Top Issues table),
	// but the same real "Caching & Delivery" section Caching/CDN above jump
	// to is still the right destination conceptually.
	'page-caching': 'caching-delivery',
	'browser-caching': 'caching-delivery',
	'persistent-object-cache': 'caching-delivery',
};

interface CoreWebVitalsSummary {
	sample_count: number;
}

const MIN_CWV_SAMPLES = 10;

/**
 * The mockup's metrics grid — 9 tiles ("Performance Monitor" removed per
 * direct instruction, since it was a pure duplicate of
 * RealTimeMonitoringCard.tsx — literally the same `GET
 * /performance-realtime` endpoint, rendered twice on the same page; that
 * card, further down this page, remains the one real home for this
 * capability), plus 3 more (Page caching/Browser caching/Persistent object
 * cache, appended per direct instruction) for 12 total.
 *
 * 8 of the first 9 tiles map to a real category-'performance' scanner
 * via `useSectionStatus()` (the same real "No open findings"/"N Open"
 * badge `TechnicalVisibilityCard.tsx` already produces): Caching
 * (`cache-detection`), Images (`large-images`), CSS Optimization
 * (`css-optimization`), JavaScript (`javascript-optimization`), Fonts
 * (`fonts`), Lazy Loading (`lazy-loading`), CDN (`cdn`), Database Cleanup
 * (`database-cleanup`) — see each scanner's own file in
 * `classes/Scanners/Basic/`. "Core Web Vitals" is real too — it reads the
 * same `GET /core-web-vitals` real-visitor RUM summary PerformanceScoreCard's
 * own Core Web Vitals card reads, showing "Tracking" once past that
 * card's own `MIN_SAMPLES` floor, or a real "Collecting data (N/10)"
 * count below it — never a static "Not tracked yet" now that a real
 * collection pipeline exists (Services\CoreWebVitalsBeacon).
 *
 * Per direct instruction, the separate "View" button (`ButtonInput`) is
 * gone — each tile's own real status badge is the click target now
 * instead, rendered here directly (not via `MetricTileComponent`'s own
 * `badge` prop, which only ever reads `badge.color`/`badge.text` and
 * never wires up a click handler — confirmed reading its source) so a
 * real `onClick` can be attached. Same destination either way: the 8
 * scanner-backed tiles jump to and select their own section of the "Top
 * Issues" table further down this page (`onViewSection`, via
 * `SECTION_KEY_BY_TILE_ID`); "Core Web Vitals" instead scrolls to its own
 * real detail card higher on this same page (`onViewCoreWebVitals`) — it
 * already shows this exact tile's data, so its badge jumps there rather
 * than to a findings table that has no row for it. The 3 efficiency tiles
 * (`EFFICIENCY_TILE_IDS`) aren't scanner findings either, but they're
 * caching-related the same way Caching/CDN are, so their badge routes into
 * that same "Caching & Delivery" section rather than needing a
 * destination of their own.
 */
interface MetricsGridProps {
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
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
			getApiLink(appLocalizer, 'core-web-vitals'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
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
			const check = efficiencyData?.sections
				.flatMap((section) => section.checks)
				.find((item) => item.id === id);

			if (!check) {
				return NOT_TRACKED_BADGE;
			}

			return {
				text: check.badge,
				color: EFFICIENCY_STATUS_COLOR[check.status],
			};
		}

		return SECTION_STATUS_BY_TILE[id]?.badge ?? OPEN_FALLBACK_BADGE;
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
		<MetricTileGridComponent cols={3}>
			{METRIC_TILES.map((tile) => {
				const badge = badgeFor(tile.id);
				return (
					<MetricTileComponent
						key={tile.id}
						icon={tile.icon}
						title={tile.title}
					>
						<BadgeComponent
							text={badge.text}
							color={badge.color}
							className="metric-tile-badge-clickable"
							role="button"
							tabIndex={0}
							onClick={() => handleView(tile.id)}
							onKeyDown={(event) => {
								if ('Enter' === event.key || ' ' === event.key) {
									event.preventDefault();
									handleView(tile.id);
								}
							}}
						/>
						<div className="desc">{tile.desc}</div>
					</MetricTileComponent>
				);
			})}
		</MetricTileGridComponent>
	);
};

export default MetricsGrid;
