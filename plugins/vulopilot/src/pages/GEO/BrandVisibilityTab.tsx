/* global appLocalizer */
import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
	CardComponent,
	ColumnComponent,
	ModuleGuardComponent,
	NoticeComponent,
} from '@zyra/components';
import BrandScoreCard from './BrandScoreCard';
import SectionedFindingsTab from '../Security/SectionedFindingsTab';
import type { FindingsSection } from '../Security/SectionedFindingsTab';
import type { SectionedIssuesTab } from '../Security/SectionedIssuesTable';
import { useFilterSlot } from '../../services/useFilterSlot';

/**
 * Section → scanner_id grouping for Brand Intelligence's 7 scanners
 * (BRAND-INTELLIGENCE-MODULE.md) — this module's own 3 new `brand`-category
 * scanners, plus 4 existing `geo`-category scanners it reports on rather
 * than duplicates. Fed into SectionedFindingsTab (same shell GeoTab.tsx/
 * AeoTab.tsx/SeoTab.tsx use) per direct instruction, replacing what used to
 * be 3 separate FindingsTable cards. Same cross-category `scannerIds`-prop
 * mechanism Content.tsx's own CONTENT_SECTIONS already documents — no
 * `category` prop passed, same as before.
 */
const BRAND_SECTIONS: FindingsSection[] = [
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
 * "Brand Visibility" tab of "SEO & Visibility" — on-site Brand/Trust/
 * Authority/Entity scoring (BRAND-INTELLIGENCE-MODULE.md, real and always
 * available) alongside a real off-site mention card (OffSiteMentionsCard,
 * vulopilot-pro's own keyless Google News RSS feed — see
 * OffSiteMentionTracker.php's own docblock for why that source rather than
 * a paid Ahrefs-style index; falls back to the original static "Not
 * connected yet" card when Pro/the module isn't active, since the feature
 * genuinely doesn't run without it). Header content (BrandScoreCard + Pro
 * slots) sits above one real, unified findings table (SectionedFindingsTab.tsx,
 * same shell GeoTab.tsx/AeoTab.tsx/SeoTab.tsx use) per direct instruction,
 * replacing what used to be 3 separate FindingsTable cards; the "Why this
 * matters more than backlinks"/off-site mentions card — previously its own
 * side-by-side sidebar column next to the section list — now sits below the
 * table as `footer` content instead, since a single-column table no longer
 * has a natural second column to pair it with.
 */
const BrandVisibilityTab = () => {
	const [activeTab, setActiveTab] = useState<SectionedIssuesTab>('all');

	// useFilterSlot(), not a plain top-level applyFilters() read — that
	// pattern is a real, measured-live race (useFilterSlot.ts's own
	// docblock) that would otherwise leave every one of these 4 slots
	// stuck at null forever regardless of whether Pro/the module is
	// actually active, since Free's own bundle can finish importing and
	// evaluating this module before Pro's addFilter() calls have run.
	// Called unconditionally, before the early return below, per the
	// rules of hooks — a Pro slot resolving is irrelevant on the "module
	// off" branch anyway, so there's no behavior difference either way.
	const AuthorityTrendsCard = useFilterSlot(
		'vulopilot_brand_authority_trends_card'
	);
	const CompetitorComparisonCard = useFilterSlot(
		'vulopilot_brand_competitor_comparison_card'
	);
	const KnowledgePanelCard = useFilterSlot(
		'vulopilot_brand_knowledge_panel_card'
	);
	const OffSiteMentionsCard = useFilterSlot(
		'vulopilot_brand_offsite_mentions_card'
	);

	if (!isBrandModuleActive()) {
		return (
			<ColumnComponent>
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
			</ColumnComponent>
		);
	}

	return (
		<SectionedFindingsTab
			title={__('All Brand Visibility Issues', 'vulopilot')}
			sections={BRAND_SECTIONS}
			activeTab={activeTab}
			onTabChange={setActiveTab}
			header={
				<>
					<NoticeComponent
						displayPosition="inline-notice"
						title={__('In plain English:', 'vulopilot')}
						message={__(
							'This checks whether AI systems describe your business accurately, and treat it as trustworthy, when it comes up in an answer.',
							'vulopilot'
						)}
					/>
					<BrandScoreCard />
					{AuthorityTrendsCard && <AuthorityTrendsCard />}
					{CompetitorComparisonCard && <CompetitorComparisonCard />}
					{KnowledgePanelCard && <KnowledgePanelCard />}
				</>
			}
			footer={
				<>
					<NoticeComponent
						type="info"
						displayPosition="inline-notice"
						title={__('Why this matters more than backlinks:', 'vulopilot')}
						message={__(
							'Branded web mentions correlate with AI citation roughly 3x more strongly than backlinks. AI engines look for consensus across third-party sources, not just links pointing at your site.',
							'vulopilot'
						)}
					/>
					{OffSiteMentionsCard ? (
						<OffSiteMentionsCard />
					) : (
						<ModuleGuardComponent
							icon="lock"
							title={__('Off-site mention tracking: not connected yet', 'vulopilot')}
							desc={__(
								'Turn on the Brand Intelligence module (Settings → Modules) to start tracking real off-site news mentions and citing domains here — no account or API key needed.',
								'vulopilot'
							)}
						/>
					)}
				</>
			}
		/>
	);
};

export default BrandVisibilityTab;
