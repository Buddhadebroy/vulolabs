import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	NavigatorHeaderComponent,
} from '@zyra/components';
import FindingsTable from '../../components/FindingsTable';
import TopPagesCard from './TopPagesCard';

/**
 * Section → scanner_id grouping for GEO's 12 scanners (Free's original 9,
 * GEO-MODULE.md, plus GeoInsights' 2 Pro ones, plus Free's own
 * AeoSchemaScanner), mirroring the SEO.tsx SEO_SECTIONS pattern: each
 * section is its own independent
 * FindingsTable (own fetch/pagination/search/bulk actions) scoped by
 * scannerIds rather than one flat category="geo" table. Unlike SEO's
 * mixed categories, every GEO scanner already shares category 'geo' — the
 * split here is purely presentational, grouping by what a finding affects
 * (an AI summary block vs. heading structure vs. entity naming) rather
 * than a real backend distinction.
 */
const GEO_SECTIONS: {
	key: string;
	title: string;
	description: string;
	emptyMessage: string;
	scannerIds: string[];
}[] = [
	{
		key: 'summary',
		title: __('AI Summary', 'vulopilot'),
		description: __(
			'Whether pages have an extractable AI summary block or answer questions readers would plausibly ask.',
			'vulopilot'
		),
		emptyMessage: __(
			'No AI summary findings yet — run a scan to check for summary blocks and FAQ opportunities.',
			'vulopilot'
		),
		scannerIds: ['geo-summary-block', 'geo-faq-opportunity'],
	},
	{
		key: 'evidence',
		title: __('Evidence & Data', 'vulopilot'),
		description: __(
			'Statistic-shaped claims with no citation or outbound link backing them up.',
			'vulopilot'
		),
		emptyMessage: __(
			'No evidence findings yet — run a scan to check for uncited claims.',
			'vulopilot'
		),
		scannerIds: ['geo-citation-opportunities'],
	},
	{
		key: 'structure',
		title: __('Structure', 'vulopilot'),
		description: __(
			'Paragraph length and heading hierarchy — how easily an AI system can extract a clean chunk of this content.',
			'vulopilot'
		),
		emptyMessage: __(
			'No structure findings yet — run a scan to check paragraph length and heading hierarchy.',
			'vulopilot'
		),
		scannerIds: ['geo-chunking', 'geo-semantic-structure'],
	},
	{
		key: 'entities',
		title: __('Entities & Trust', 'vulopilot'),
		description: __(
			'Author credentials, consistent naming, and baseline trust pages (About/Contact) AI systems weigh before citing a source.',
			'vulopilot'
		),
		emptyMessage: __(
			'No entity/trust findings yet — run a scan to check author info and naming consistency.',
			'vulopilot'
		),
		scannerIds: [
			'geo-author-info',
			'geo-eeat-signals',
			'geo-entity-naming-consistency',
			'geo-trust-signals',
		],
	},
	{
		key: 'crawlability',
		title: __('Crawlability', 'vulopilot'),
		description: __(
			'Whether AI crawlers can find a curated index of this site’s content.',
			'vulopilot'
		),
		emptyMessage: __(
			'No crawlability findings yet — run a scan to check llms.txt.',
			'vulopilot'
		),
		scannerIds: ['llms-txt-missing'],
	},
	{
		key: 'freshness',
		title: __('Freshness', 'vulopilot'),
		description: __(
			'Pages that haven’t been updated recently — AI answer engines favor actively-maintained content.',
			'vulopilot'
		),
		emptyMessage: __(
			'No freshness findings yet — run a scan to check for stale content.',
			'vulopilot'
		),
		scannerIds: ['stale-content'],
	},
	{
		key: 'aeo',
		title: __('AEO (Answer Engine Optimization)', 'vulopilot'),
		description: __(
			'Content already shaped like an FAQ or a how-to guide, but missing the schema.org markup that lets AI answer engines recognize it as one.',
			'vulopilot'
		),
		emptyMessage: __(
			'No AEO schema findings yet — run a scan to check FAQ/HowTo-shaped content for missing schema.',
			'vulopilot'
		),
		scannerIds: ['aeo-schema'],
	},
];

/**
 * Both slots below are Pro's vulopilot-pro/modules/GeoInsights — same
 * "register a source, don't modify the host" pattern already used for
 * Reports'/Automation's own panel slots (see those pages' own docblocks).
 * Neither slot has a Pro-upsell fallback: unlike Automation/Reports, these
 * are bonus widgets above the always-real findings table below, not a
 * blocked action, so Free with no Pro (or GeoInsights not enabled) simply
 * renders the findings table on its own, same as before either slot existed.
 *
 * GeoScoreCard is GEO-MODULE.md's per-post "Generate GEO Score" card. This
 * call was previously removed from this page (nothing rendered the slot),
 * leaving the card fully built in Pro but shown nowhere — restored here.
 */
const GeoScoreCard = applyFilters(
	'vulopilot_geo_score_card',
	null
) as ComponentType | null;

/**
 * Sitewide AI-visibility summary — GeoInsights\VisibilitySnapshotBuilder's
 * cached, sample-based average of GeoAnalyzer's 8 AI-judged dimensions
 * across this site's most recently updated pages (GeoAnalyzer itself only
 * ever scores one post at a time — see that class's own docblock).
 */
const GeoVisibilitySummary = applyFilters(
	'vulopilot_geo_visibility_summary',
	null
) as ComponentType | null;

/**
 * Historical Trends (AI-VISIBILITY-MODULE.md) — sitewide GEO score over
 * time, one point per day VisibilitySnapshotBuilder ran. Same "register a
 * source, don't modify the host" slot pattern as the two above.
 */
const GeoVisibilityTrend = applyFilters(
	'vulopilot_geo_visibility_trend',
	null
) as ComponentType | null;

/**
 * Competitor Visibility (AI-VISIBILITY-MODULE.md) — real, on-demand
 * structural comparison against competitor URLs (Settings → GEO's
 * `geo_competitor_urls`). Same slot pattern as the three above.
 */
const GeoCompetitorVisibility = applyFilters(
	'vulopilot_geo_competitor_visibility',
	null
) as ComponentType | null;

/**
 * GEO = Generative Engine Optimization — how discoverable/citable this
 * site is to AI answer engines (distinct from classic search-engine SEO).
 * Same header + findings-table shape every other category page (SEO,
 * Performance, Accessibility, WooCommerce, Security) already uses, plus
 * the two optional Pro widgets above the table (see their own docblocks).
 * llms.txt's toggle/preview/live-link live under Settings → GEO
 * (Scanning/Geo.ts + LlmsTxtCard.tsx), not on this page.
 */
const GEO = () => (
	<>
		<NavigatorHeaderComponent
			headerIcon="globe"
			headerTitle={__('GEO', 'vulopilot')}
			headerDescription={__(
				'Generative Engine Optimization — how discoverable and citable this site is to AI answer engines.',
				'vulopilot'
			)}
		/>
		<ContainerComponent general>
			<ColumnComponent>
				{GeoVisibilitySummary && <GeoVisibilitySummary />}
				{GeoVisibilityTrend && <GeoVisibilityTrend />}
				{GeoCompetitorVisibility && <GeoCompetitorVisibility />}
				{GeoScoreCard && <GeoScoreCard />}
				<TopPagesCard />
				{GEO_SECTIONS.map((section) => (
					<CardComponent
						key={section.key}
						title={section.title}
						desc={section.description}
					>
						<FindingsTable
							title={section.title}
							description={section.emptyMessage}
							scannerIds={section.scannerIds}
						/>
					</CardComponent>
				))}
			</ColumnComponent>
		</ContainerComponent>
	</>
);

export default GEO;
