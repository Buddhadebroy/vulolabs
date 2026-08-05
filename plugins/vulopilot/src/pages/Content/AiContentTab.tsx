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
import OpenIssuesGlimpse from '../../components/OpenIssuesGlimpse';
import ContentScoreCard from '../Content/ContentScoreCard';

/**
 * Which AI_CONTENT_SECTIONS card (below) each scanner's findings live under
 * — same "a glimpse row only has a scanner_id, not a section key" reasoning
 * GeoTab.tsx's/AeoTab.tsx's own SCANNER_TO_SECTION documents.
 */
const SCANNER_TO_SECTION: Record<string, string> = {
	'thin-content': 'depth',
	readability: 'formatting',
	'heading-structure': 'formatting',
};

/**
 * Section → scanner_id grouping for "AI Content" — the content-quality
 * signals AI assistants weigh (depth, trust, visuals, scannable formatting,
 * terminology), distinct from GEO's technical retrieval/crawlability
 * concerns and AEO's citation-testing concerns.
 *
 * Only 2 of these 5 categories have a real, existing scanner behind them
 * today — `thin-content` (category 'seo') and `readability`/
 * `heading-structure` (category 'content'/'seo'), the same scanners
 * Content.tsx's own CONTENT_SECTIONS already surfaces under its own
 * "Content Depth"/"Readability"/"Structure" lens (a finding legitimately
 * showing up grouped differently across pages — same cross-page overlap
 * GeoTab.tsx and AeoTab.tsx already established for their own shared
 * scanners). Trust & Credibility, Multimedia & Visual Aids, and
 * Terminology & Tone have no scanner anywhere in this codebase, Free or
 * Pro — checking any of them (an expert-quote citation, a tone shift, a
 * missing diagram) needs real judgment, not pattern-matching, and this
 * codebase's own established posture is that AI-judged checks are always a
 * Pro-gated engine (GeoAnalysis\GeoAnalyzer, ContentIntelligence\
 * ContentAnalyzer's own `topic_authority` dimension), never a Free
 * ScannerInterface implementer. `scannerIds: []` renders an honest "not
 * built yet" notice for those three, same posture this page's own prior
 * placeholder already took, rather than a findings table that would sit
 * permanently and misleadingly empty.
 */
const AI_CONTENT_SECTIONS: {
	key: string;
	title: string;
	description: string;
	emptyMessage: string;
	scannerIds: string[];
	notBuiltDesc?: string;
}[] = [
	{
		key: 'depth',
		title: __('Depth & Completeness', 'vulopilot'),
		description: __(
			'Pages with too little substance for a reader to walk away informed, or that leave an obvious follow-up question unanswered.',
			'vulopilot'
		),
		emptyMessage: __(
			'No depth findings yet — run a scan to check for thin content.',
			'vulopilot'
		),
		scannerIds: ['thin-content'],
	},
	{
		key: 'trust',
		title: __('Trust & Credibility', 'vulopilot'),
		description: __(
			'Expert quotes, customer proof points, and other credibility signals AI assistants weigh before summarizing or citing a page.',
			'vulopilot'
		),
		emptyMessage: '',
		scannerIds: [],
		notBuiltDesc: __(
			'Detecting expert quotes, third-party validation, and customer proof points isn’t built yet — flag if you want it scoped next.',
			'vulopilot'
		),
	},
	{
		key: 'multimedia',
		title: __('Multimedia & Visual Aids', 'vulopilot'),
		description: __(
			'Diagrams, screenshots, and other visual aids that make a step-by-step explanation easier to follow.',
			'vulopilot'
		),
		emptyMessage: '',
		scannerIds: [],
		notBuiltDesc: __(
			'Detecting missing diagrams or screenshots in step-by-step content isn’t built yet — flag if you want it scoped next.',
			'vulopilot'
		),
	},
	{
		key: 'formatting',
		title: __('Scannable Formatting', 'vulopilot'),
		description: __(
			'Reading complexity and heading structure — how easily a reader (or an AI system) can scan and extract this content.',
			'vulopilot'
		),
		emptyMessage: __(
			'No formatting findings yet — run a scan to check readability and heading structure.',
			'vulopilot'
		),
		scannerIds: ['readability', 'heading-structure'],
	},
	{
		key: 'tone',
		title: __('Terminology & Tone', 'vulopilot'),
		description: __(
			'Consistent terminology and a steady tone throughout a page — jargon-heavy or inconsistent phrasing confuses both readers and AI summarizers.',
			'vulopilot'
		),
		emptyMessage: '',
		scannerIds: [],
		notBuiltDesc: __(
			'Detecting jargon-heavy phrasing, inconsistent terminology, or tone shifts isn’t built yet — flag if you want it scoped next.',
			'vulopilot'
		),
	},
];

/**
 * Same "genuinely gates scanning" posture Content.tsx's own
 * isContentModuleActive() already documents — this page reuses the exact
 * same scanners (readability/thin-content/heading-structure), which only
 * run while Content Intelligence is active.
 */
const isContentModuleActive = () =>
	appLocalizer.active_modules?.includes('content-intelligence') ?? false;

/**
 * "Topic Authority" — vulopilot-pro's ContentIntelligence module's own
 * per-post AI-judged depth/expertise score. Same slot Content.tsx's own
 * page already renders; relevant here too since it's the one real
 * AI-judged signal that overlaps this tab's own "Depth & Completeness"
 * category.
 */
const TopicAuthorityCard = applyFilters(
	'vulopilot_content_topic_authority_card',
	null
) as ComponentType | null;

/**
 * "AI Content" tab of "Grow My Traffic" — the content-quality signals AI
 * assistants weigh when deciding what to summarize and cite: depth, trust,
 * visuals, scannable formatting, and tone. Body extracted verbatim from
 * the former standalone AIContent.tsx page (same "extract body, drop the
 * header" move GeoTab.tsx/AeoTab.tsx already made) — its own
 * NavigatorHeaderComponent (and runScanButton) now lives once on GEO.tsx's
 * shared tab-shell header.
 */
const AiContentTab = () => {
	return (
		<ContainerComponent general>
			<ColumnComponent>
				{!isContentModuleActive() ? (
					<CardComponent title={__('AI Content', 'vulopilot')}>
						<ModuleGuardComponent
							icon="error"
							title={__(
								'Content Intelligence module is turned off',
								'vulopilot'
							)}
							desc={__(
								'Turn the Content Intelligence module back on from Settings → Modules to resume scanning and see its findings again here. Findings already found before it was turned off aren’t deleted — they still show up on the Health page.',
								'vulopilot'
							)}
						/>
					</CardComponent>
				) : (
					<>
						<ContentScoreCard />
						{TopicAuthorityCard && <TopicAuthorityCard />}
						<OpenIssuesGlimpse
							scannerIds={AI_CONTENT_SECTIONS.flatMap(
								(section) => section.scannerIds
							)}
							sectionMap={SCANNER_TO_SECTION}
							fallbackSection="depth"
							anchorPrefix="ai-content-section-"
							emptyTitle={__("You're all caught up", 'vulopilot')}
							emptyDesc={__(
								'No open AI Content findings right now.',
								'vulopilot'
							)}
						/>
						{AI_CONTENT_SECTIONS.map((section) => (
							<CardComponent
								key={section.key}
								id={`ai-content-section-${section.key}`}
								title={section.title}
								desc={section.description}
							>
								{section.scannerIds.length > 0 ? (
									<FindingsTable
										title={section.title}
										description={section.emptyMessage}
										scannerIds={section.scannerIds}
										layout="compact"
									/>
								) : (
									<ModuleGuardComponent
										icon="info"
										title={__('Not available yet', 'vulopilot')}
										desc={section.notBuiltDesc}
									/>
								)}
							</CardComponent>
						))}
					</>
				)}
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default AiContentTab;
