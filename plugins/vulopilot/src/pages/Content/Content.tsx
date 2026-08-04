/* global appLocalizer */
import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
	NavigatorHeaderComponent,
} from '@zyra/components';
import FindingsTable from '../../components/FindingsTable';
import ContentScoreCard from './ContentScoreCard';
import { useRunScan } from '../../services/useRunScan';

/**
 * Section → scanner_id grouping for Content Intelligence's 6 scanners —
 * this module's own new ReadabilityScanner (category `content`), plus 5
 * existing `seo`-category scanners it reports on rather than duplicates
 * (CONTENT-INTELLIGENCE-MODULE.md's audit: recategorizing
 * ThinContentScanner/DuplicateContentScanner/HeadingStructureScanner/
 * InternalLinkingScanner/OrphanPageScanner out of `seo` would break
 * SEO.tsx's own SEO_SECTIONS grouping). Same cross-category
 * `scannerIds`-prop mechanism SEO.tsx's own docblock already documents for
 * its own mixed-category scanner list — no `category` prop passed below.
 */
const CONTENT_SECTIONS: {
	key: string;
	title: string;
	description: string;
	emptyMessage: string;
	scannerIds: string[];
}[] = [
	{
		key: 'readability',
		title: __('Readability', 'vulopilot'),
		description: __(
			'How easy this content is to read — a standard Flesch Reading Ease score.',
			'vulopilot'
		),
		emptyMessage: __(
			'No readability findings yet — run a scan to check sentence/word complexity.',
			'vulopilot'
		),
		scannerIds: ['readability'],
	},
	{
		key: 'depth',
		title: __('Content Depth', 'vulopilot'),
		description: __(
			'Pages with too little substance, or duplicating another page\'s title outright.',
			'vulopilot'
		),
		emptyMessage: __(
			'No thin/duplicate content findings yet — run a scan to check.',
			'vulopilot'
		),
		scannerIds: ['thin-content', 'duplicate-content'],
	},
	{
		key: 'structure',
		title: __('Structure', 'vulopilot'),
		description: __(
			'Heading hierarchy and internal links — how easily a reader (or crawler) can navigate this content.',
			'vulopilot'
		),
		emptyMessage: __(
			'No structure findings yet — run a scan to check headings and internal links.',
			'vulopilot'
		),
		scannerIds: ['heading-structure', 'internal-linking', 'orphan-pages'],
	},
];

/**
 * Whether the Content Intelligence module (Settings → Modules) is active
 * — same "genuinely gates scanning" posture SEO.tsx's own
 * isSeoModuleActive() already documents, for the identical reason: this
 * module's own scanner (ReadabilityScanner) only runs while it's active.
 */
const isContentModuleActive = () =>
	appLocalizer.active_modules?.includes('content-intelligence') ?? false;

/**
 * "Topic Authority" — vulopilot-pro's ContentIntelligence module's own
 * per-post AI card, same "register a source, don't modify the host" slot
 * pattern GEO.tsx's own GeoScoreCard slot already uses.
 */
const TopicAuthorityCard = applyFilters(
	'vulopilot_content_topic_authority_card',
	null
) as ComponentType | null;

/**
 * "Content Gap Analysis" (+ Competitor Content Suggestions when
 * `geo_competitor_urls` is set) — same slot pattern as
 * GeoVisibilitySummary's own slot on GEO.tsx.
 */
const ContentGapAnalysisCard = applyFilters(
	'vulopilot_content_gap_analysis_card',
	null
) as ComponentType | null;

/**
 * Content Intelligence — depth, readability, and structure across pages
 * and posts. Same header + findings-table shape every other category page
 * (SEO, GEO, Performance, Accessibility, WooCommerce, Security) already
 * uses, plus the two optional Pro widgets above the table.
 */
const Content = () => {
	const { runScanButton } = useRunScan();

	return (
	<>
		<NavigatorHeaderComponent
			headerIcon="image"
			headerTitle={__('Content', 'vulopilot')}
			headerDescription={__(
				'Depth, originality, and readability across pages and posts.',
				'vulopilot'
			)}
			buttons={[runScanButton]}
		/>
		<ContainerComponent general>
			<ColumnComponent>
				{!isContentModuleActive() ? (
					<CardComponent title={__('Content', 'vulopilot')}>
						<ModuleGuardComponent
							icon="error"
							title={__(
								'Content Intelligence module is turned off',
								'vulopilot'
							)}
							desc={__(
								'Turn the Content Intelligence module back on from Settings → Modules to resume readability scanning and see its findings again here. Findings already found before it was turned off aren’t deleted — they still show up on the Health page.',
								'vulopilot'
							)}
						/>
					</CardComponent>
				) : (
					<>
						<ContentScoreCard />
						{TopicAuthorityCard && <TopicAuthorityCard />}
						{ContentGapAnalysisCard && <ContentGapAnalysisCard />}
						{CONTENT_SECTIONS.map((section) => (
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
		</ContainerComponent>
	</>
	);
};

export default Content;
