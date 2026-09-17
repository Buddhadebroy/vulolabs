import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ListComponent, BadgeComponent } from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { useApiList } from '../services/useApiList';
import { SEO_SECTIONS } from '../pages/GEO/seoSections';
import { ALL_AEO_SCANNER_IDS } from '../pages/GEO/AeoTab';
import { WidgetProps } from './types';

interface FindingRow {
	id: number;
}

/** Every real SEO scanner id (`SEO_SECTIONS`' own union) — not a plain `category=seo` filter, since 2 of SeoTab.tsx's own real scanners (`ImagesScanner`/`InternalLinkingScanner`) store `category` as `'images'`/`'links'` instead — see that file's own docblock for the full breakdown. Kept in sync with SeoTab.tsx's own SEO-tab scope by importing this shared union rather than re-declaring it. */
const SEO_SCANNER_IDS = SEO_SECTIONS.flatMap((section) => section.scannerIds);

type GlanceRow = {
	key: 'seo' | 'geo' | 'aeo';
	label: string;
	subtab: string;
	/** `scanner_id`/`category` REST params to count real open findings with — see each row's own definition below for why GEO uses `category` while SEO/AEO use an explicit `scanner_id` list. */
	params: Record<string, string>;
};

/**
 * "Issues at a glance" — real open-finding counts for the 3 "SEO &
 * Visibility" sub-tabs (SEO/GEO/AEO), each read via the same shared
 * `GET /findings` endpoint every findings table on this plugin already
 * uses (`status=open`, `per_page=1` since only the real `total` count is
 * needed here, not the rows themselves).
 *
 * GEO's own `category=geo` filter is sufficient on its own (every real GEO
 * scanner id shares that one `category` column value — GeoAnalyzer.php's
 * own docblock confirms this), but SEO/AEO can't be filtered that cleanly:
 * SEO_SECTIONS.tsx's own docblock explains why 2 real SEO scanners don't
 * share `category='seo'`, and AEO has no dedicated `category` value at all
 * (AeoTab.tsx's own `ALL_AEO_SCANNER_IDS` union — largely overlapping with
 * GEO's own scanner ids by design, per that file's docblock — is the only
 * real way to scope "AEO" findings). Both use an explicit `scanner_id`
 * allowlist instead, imported from each tab's own real single source of
 * truth rather than a 2nd, hand-copied list here.
 *
 * Replaces this widget's former "Key pages at a glance" — a real
 * page-by-page open-finding ranking (`GET /geo-analysis/top-pages`) — per
 * direct instruction to show a per-topic glance instead; the "View all
 * pages" header link is gone too (each row below links to its own real
 * tab instead of one shared destination).
 */
const GLANCE_ROWS: GlanceRow[] = [
	{
		key: 'seo',
		label: __('SEO', 'vulopilot'),
		subtab: 'seo',
		params: { scanner_id: SEO_SCANNER_IDS.join(',') },
	},
	{
		key: 'geo',
		label: __('GEO', 'vulopilot'),
		subtab: 'geo',
		params: { category: 'geo' },
	},
	{
		key: 'aeo',
		label: __('AEO', 'vulopilot'),
		subtab: 'aeo',
		params: { scanner_id: ALL_AEO_SCANNER_IDS.join(',') },
	},
];

const KeyPagesWidget: React.FC<WidgetProps> = ({
	isLoading: parentLoading,
	onHide,
	isCustomizing,
}) => {
	// Hooks can't be called in a loop/map, so each of the (fixed, always
	// exactly 3) rows gets its own real `useApiList` call rather than one
	// dynamic list — same reasoning any other fixed-cardinality multi-fetch
	// component in this codebase already follows.
	const seo = useApiList<FindingRow>('findings', {
		...GLANCE_ROWS[0].params,
		status: 'open',
		per_page: 1,
	});
	const geo = useApiList<FindingRow>('findings', {
		...GLANCE_ROWS[1].params,
		status: 'open',
		per_page: 1,
	});
	const aeo = useApiList<FindingRow>('findings', {
		...GLANCE_ROWS[2].params,
		status: 'open',
		per_page: 1,
	});

	const totals: Record<GlanceRow['key'], number> = {
		seo: seo.total,
		geo: geo.total,
		aeo: aeo.total,
	};
	const isLoading = seo.isLoading || geo.isLoading || aeo.isLoading;

	return (
		<DashboardWidget
			title={__('Issues at a glance', 'vulopilot')}
			desc={__('Open issues across SEO, GEO, and AEO.', 'vulopilot')}
			icon="web-page-website"
			isLoading={parentLoading || isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
		>
			<ListComponent
				className="mini-card report"
				items={GLANCE_ROWS.map((row) => {
					const total = totals[row.key];

					return {
						id: row.key,
						title: row.label,
						action: () => {
							window.location.href = `?page=vulopilot#&tab=seo-visibility&subtab=${row.subtab}`;
						},
						tags: (
							<BadgeComponent
								color={total > 0 ? 'red' : 'green'}
								text={
									0 === total
										? __('No issues', 'vulopilot')
										: 1 === total
											? __('1 issue', 'vulopilot')
											: sprintf(
													/* translators: %d: number of real open findings for this sub-tab. */
													__('%d issues', 'vulopilot'),
													total
												)
								}
							/>
						),
					};
				})}
			/>
		</DashboardWidget>
	);
};

export default KeyPagesWidget;
