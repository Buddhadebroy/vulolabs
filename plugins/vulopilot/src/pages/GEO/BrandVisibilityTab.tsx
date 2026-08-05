/* global appLocalizer */
import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
} from '@zyra/components';
import FindingsTable from '../../components/FindingsTable';
import BrandScoreCard from './BrandScoreCard';

/**
 * Section → scanner_id grouping for Brand Intelligence's 7 scanners
 * (BRAND-INTELLIGENCE-MODULE.md) — this module's own 3 new `brand`-category
 * scanners, plus 4 existing `geo`-category scanners it reports on rather
 * than duplicates. Same cross-category `scannerIds`-prop mechanism
 * Content.tsx's own CONTENT_SECTIONS already documents — no `category`
 * prop passed below.
 */
const BRAND_SECTIONS: {
	key: string;
	title: string;
	description: string;
	emptyMessage: string;
	scannerIds: string[];
}[] = [
	{
		key: 'trust',
		title: __('Trust Signals', 'vulopilot'),
		description: __(
			'Whether this site has the baseline pages (About/Contact) AI engines expect before treating it as citable, and whether those pages have real substance.',
			'vulopilot'
		),
		emptyMessage: __(
			'No trust-signal findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['geo-trust-signals', 'about-page-analysis'],
	},
	{
		key: 'authority',
		title: __('Authority Signals', 'vulopilot'),
		description: __(
			'Author expertise and freshness signals — bio text, content updates, and machine-readable Person schema.',
			'vulopilot'
		),
		emptyMessage: __(
			'No authority findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['geo-eeat-signals', 'geo-author-info', 'author-schema'],
	},
	{
		key: 'entity',
		title: __('Entity Consistency', 'vulopilot'),
		description: __(
			'Whether this site\'s brand name is written consistently, and whether Organization schema exists to help AI engines resolve it as a real-world entity.',
			'vulopilot'
		),
		emptyMessage: __(
			'No entity findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['geo-entity-naming-consistency', 'organization-schema'],
	},
];

/**
 * Whether the Brand Intelligence module (Settings → Modules) is active —
 * same "genuinely gates scanning" posture Content.tsx's own
 * isContentModuleActive() already documents, for the identical reason:
 * this module's own 3 scanners only run while it's active.
 */
const isBrandModuleActive = () =>
	appLocalizer.active_modules?.includes('brand-intelligence') ?? false;

/**
 * "Authority Trends" — vulopilot-pro's BrandIntelligence module's own
 * sitewide score-history chart, same "register a source, don't modify the
 * host" slot pattern GeoVisibilityTrend's slot on GeoTab.tsx already uses.
 */
const AuthorityTrendsCard = applyFilters(
	'vulopilot_brand_authority_trends_card',
	null
) as ComponentType | null;

/**
 * "Competitor Comparison" — same slot pattern as ContentGapAnalysisCard's
 * slot on Content.tsx.
 */
const CompetitorComparisonCard = applyFilters(
	'vulopilot_brand_competitor_comparison_card',
	null
) as ComponentType | null;

/**
 * "Knowledge Panel Optimization" — same slot pattern as the two cards
 * above.
 */
const KnowledgePanelCard = applyFilters(
	'vulopilot_brand_knowledge_panel_card',
	null
) as ComponentType | null;

/**
 * "Brand Visibility" tab of "Grow My Traffic" — on-site Brand/Trust/
 * Authority/Entity scoring (BRAND-INTELLIGENCE-MODULE.md, real and always
 * available) alongside the pre-existing off-site brand-mention/
 * share-of-voice section below (still honestly "Not connected yet" — that
 * gap is unchanged by this move, see that card's own docblock). Body
 * extracted verbatim from the former standalone BrandVisibility.tsx page
 * (same "extract body, drop the header" move every other tab on this page
 * already made) — its own NavigatorHeaderComponent now lives once on
 * GEO.tsx's shared tab-shell header.
 */
const BrandVisibilityTab = () => {
	return (
		<ContainerComponent general>
			<ColumnComponent>
				{!isBrandModuleActive() ? (
					<CardComponent title={__('Brand', 'vulopilot')}>
						<ModuleGuardComponent
							icon="error"
							title={__(
								'Brand Intelligence module is turned off',
								'vulopilot'
							)}
							desc={__(
								'Turn the Brand Intelligence module back on from Settings → Modules to resume trust/authority/entity scanning and see its findings again here. Findings already found before it was turned off aren’t deleted — they still show up on the Health page.',
								'vulopilot'
							)}
						/>
					</CardComponent>
				) : (
					<>
						<BrandScoreCard />
						{AuthorityTrendsCard && <AuthorityTrendsCard />}
						{CompetitorComparisonCard && <CompetitorComparisonCard />}
						{KnowledgePanelCard && <KnowledgePanelCard />}
						{BRAND_SECTIONS.map((section) => (
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
					</>
				)}
			</ColumnComponent>
			<ColumnComponent>
				<CardComponent
					className="brand-visibility-why-card"
					title={__(
						'Why this matters more than backlinks',
						'vulopilot'
					)}
				>
					<div className="desc">
						{__(
							'Branded web mentions correlate with AI citation roughly 3x more strongly than backlinks. AI engines look for consensus across third-party sources, not just links pointing at your site.',
							'vulopilot'
						)}
					</div>
				</CardComponent>
				<ModuleGuardComponent
					icon="lock"
					title={__('Off-site mention tracking: not connected yet', 'vulopilot')}
					desc={__(
						'Connect an Ahrefs Brand Radar account from Settings to start tracking real mentions, share of voice, and citing domains here.',
						'vulopilot'
					)}
				/>
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default BrandVisibilityTab;
