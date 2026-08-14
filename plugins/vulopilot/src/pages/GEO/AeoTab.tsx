/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import {
	CardComponent,
	ChartComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
} from '@zyra/components';
import SectionedFindingsTab from '../Security/SectionedFindingsTab';
import type { FindingsSection } from '../Security/SectionedFindingsTab';
import type { SectionedIssuesTab } from '../Security/SectionedIssuesTable';
import ProLockedCard from '../../components/ProLockedCard';
import GeoFixTheseFirstCard from './GeoFixTheseFirstCard';
import GeoByTopicGrid from './GeoByTopicGrid';
import { useAllFindingGroups } from './useAllFindingGroups';
import { sumGroupCounts } from './useGeoFindingGroups';
import { useGeoVisibilitySnapshot } from './useGeoVisibilitySnapshot';

/**
 * Section → scanner_id grouping for AEO's 5 real scanners — the subset of
 * GEO's own 12 GEO-category scanners (see GeoTab.tsx's own docblock) that
 * specifically concern getting a direct answer extracted and cited, rather
 * than GEO's broader "can an AI understand this page" scope. Fed into
 * SectionedFindingsTab (same shell GeoTab.tsx now uses) per direct
 * instruction, replacing what used to be 5 separate collapsible
 * `AeoSectionCard` cards — same "category 'geo' shared by every scanner,
 * split here is presentational" reasoning GeoTab.tsx's own GEO_SECTIONS
 * documents — a finding can legitimately show up grouped under both GEO's
 * own "AI Summary"/"AEO" sections and here, since AEO is its own complete
 * lens over the same finding data, not a disjoint subset. `titleIcon` is
 * used by the restyled tab's own "AEO Checks at a Glance" grid
 * (GeoByTopicGrid.tsx, reused generically — same component GeoTab.tsx's
 * own "By Topic" grid uses).
 */
const AEO_SECTIONS: {
	key: string;
	title: string;
	titleIcon: string;
	description: string;
	emptyMessage: string;
	scannerIds: string[];
	proModule?: string;
}[] = [
	{
		key: 'answers',
		title: __('Direct Answers', 'vulopilot'),
		titleIcon: 'analytics',
		description: __(
			'Whether pages have an extractable, up-front answer an AI system can lift directly, rather than one buried in the middle of the content.',
			'vulopilot'
		),
		emptyMessage: __(
			'No direct-answer findings yet — run a scan to check for AI summary blocks.',
			'vulopilot'
		),
		scannerIds: ['geo-summary-block'],
	},
	{
		key: 'coverage',
		title: __('Question Coverage', 'vulopilot'),
		titleIcon: 'form-phone',
		description: __(
			'Commonly-asked questions a page plausibly answers, but with no FAQ or Q&A block making that answer easy to extract.',
			'vulopilot'
		),
		emptyMessage: __(
			'No question-coverage findings yet — run a scan to check for FAQ opportunities.',
			'vulopilot'
		),
		scannerIds: ['geo-faq-opportunity'],
	},
	{
		key: 'structure',
		title: __('Answer Structure', 'vulopilot'),
		titleIcon: 'editor-code',
		description: __(
			'Content already shaped like an FAQ or a how-to guide, but missing the schema.org markup that lets AI answer engines recognize it as one.',
			'vulopilot'
		),
		emptyMessage: __(
			'No answer-structure findings yet — run a scan to check FAQ/HowTo-shaped content for missing schema.',
			'vulopilot'
		),
		scannerIds: ['aeo-schema'],
	},
	{
		key: 'citation',
		title: __('Citation Readiness', 'vulopilot'),
		titleIcon: 'attachment',
		description: __(
			'Statistic-shaped claims with no citation or outbound link backing them up — the evidence an AI system needs before it will cite a source.',
			'vulopilot'
		),
		emptyMessage: __(
			'No citation-readiness findings yet — run a scan to check for uncited claims.',
			'vulopilot'
		),
		scannerIds: ['geo-citation-opportunities'],
	},
	{
		key: 'crawlability',
		title: __('llms.txt & Crawlability', 'vulopilot'),
		titleIcon: 'update',
		description: __(
			'Whether AI crawlers can find a curated index of this site’s content.',
			'vulopilot'
		),
		emptyMessage: __(
			'No crawlability findings yet — run a scan to check llms.txt.',
			'vulopilot'
		),
		scannerIds: ['llms-txt-missing'],
		proModule: 'aeo-insights',
	},
];

const ALL_AEO_SCANNER_IDS = AEO_SECTIONS.flatMap((section) => section.scannerIds);

/**
 * Same `active_modules` gate GeoTab.tsx's own isGeoInsightsActive() uses —
 * 'geo-insights' is GeoInsights' folder name kebab-cased
 * (Modules.php::camel_to_kebab()). This is the real gating condition for
 * the crawlability section above even though its own `proModule` (used
 * only for ProLockedCard's popup deep-link) reads 'aeo-insights' — that's a
 * more relevant display name for this tab, not a second real module slug.
 */
const isGeoInsightsActive = () =>
	appLocalizer.active_modules?.includes('geo-insights') ?? false;

const getRating = (score: number): string => {
	if (score >= 70) {
		return __('Good', 'vulopilot');
	}
	if (score >= 40) {
		return __('Needs Work', 'vulopilot');
	}
	return __('Poor', 'vulopilot');
};

const ratingClass = (score: number): string => {
	if (score >= 70) {
		return 'is-good';
	}
	if (score >= 40) {
		return 'is-attention';
	}
	return 'is-poor';
};

const average = (values: number[]): number =>
	values.length
		? Math.round(values.reduce((sum, n) => sum + n, 0) / values.length)
		: 0;

/**
 * AEO = Answer Engine Optimization — whether AI systems can extract,
 * structure, and cite a direct answer from this site's pages (distinct from
 * GEO's broader "can an AI understand this page at all" scope, and from
 * classic search-engine SEO). Restyled to match the reference mockup's own
 * information architecture, reusing real components already built for the
 * GEO tab generically rather than duplicating them: a real "AEO Score"
 * gauge (a genuine average of the 3 real Pro visibility-snapshot dimensions
 * most relevant to answer extraction — answer_first_structure/
 * question_coverage/citation_readiness — same honest-bucketing technique
 * GeoVisibilityOverviewRow.tsx's own "4 things AI checks for" already
 * uses, Pro-gated the same way), a real "Open Issues" count, "What Needs
 * Your Attention" (GeoFixTheseFirstCard.tsx, reused), and "AEO Checks at a
 * Glance" (GeoByTopicGrid.tsx, reused) — then the same real, unified
 * findings table (SectionedFindingsTab.tsx) with the same 3 honestly-not-
 * built-yet cards (a per-signal Answerability breakdown, live citation
 * testing, and per-engine re-test tracking — none of these have any real
 * backend anywhere in this codebase today, Free or Pro) this tab already
 * documented before the restyle. There's deliberately no "AEO score over
 * time" trend chart here the way GeoTrendCompactCard.tsx has one for
 * GEO — the visibility-history table only ever stores one combined
 * `overall_score` per day (GeoInsights\VisibilitySnapshotBuilder), not a
 * per-dimension breakdown, so there's no real historical AEO-bucket data to
 * chart yet.
 */
const AeoTab = () => {
	const [activeTab, setActiveTab] = useState<SectionedIssuesTab>('all');
	const { groups, isLoading: isLoadingGroups } = useAllFindingGroups();
	const { snapshot, isLoading: isLoadingSnapshot } = useGeoVisibilitySnapshot();

	const aeoSections: FindingsSection[] = AEO_SECTIONS.map((section) => ({
		key: section.key,
		title: section.title,
		description: section.description,
		emptyMessage: section.emptyMessage,
		scannerIds: section.scannerIds,
		proModule: section.proModule,
		locked: Boolean(section.proModule) && !isGeoInsightsActive(),
	}));

	const totalOpenFindings = sumGroupCounts(groups, ALL_AEO_SCANNER_IDS);
	// GeoFixTheseFirstCard (reused generically, see its own docblock) sorts
	// and shows whatever `groups` it's given as-is — it doesn't filter by
	// scanner id itself, since GeoTab.tsx's own usage already passes a
	// category-scoped fetch. useAllFindingGroups() here deliberately fetches
	// every category (aeo-schema/llms-txt-missing don't share GEO's own
	// 'geo' category — see this file's own useAllFindingGroups.ts docblock),
	// so it has to be narrowed to just this tab's own 5 scanner ids before
	// handing it to a "top findings" card, or "What Needs Your Attention"
	// would show the single worst finding sitewide (e.g. a Security
	// finding) instead of an AEO one.
	const aeoGroups = groups.filter((group) =>
		ALL_AEO_SCANNER_IDS.includes(group.scanner_id)
	);

	const scrollToId = (id: string) => {
		const el = document.getElementById(id);
		if (!el) {
			return;
		}
		el.scrollIntoView({ behavior: 'smooth', block: 'start' });
		el.classList.add('vulopilot-glimpse-highlight');
		setTimeout(() => el.classList.remove('vulopilot-glimpse-highlight'), 1200);
	};

	const goToIssuesTable = (tab: SectionedIssuesTab = 'all') => {
		setActiveTab(tab);
		setTimeout(() => scrollToId('aeo-all-issues-table'), 50);
	};

	const hasSnapshot = snapshot && snapshot.ai_scores && snapshot.sub_scores;
	const aeoScore = hasSnapshot
		? average([
				snapshot!.ai_scores!.answer_first_structure,
				snapshot!.ai_scores!.question_coverage,
				snapshot!.sub_scores!.citation_readiness,
			])
		: 0;

	return (
		<>
			<div className="geo-info-banner">
				<i className="adminfont-info" />
				<span>
					<strong>{__('In plain English:', 'vulopilot')}</strong>{' '}
					{__(
						'When someone asks ChatGPT, Perplexity, or Google’s AI a question your page could answer, this checks whether your content is written so AI can actually quote it directly.',
						'vulopilot'
					)}
				</span>
			</div>

			<ContainerComponent>
				<ColumnComponent grid={6}>
					<CardComponent
						title={__('AEO Score', 'vulopilot')}
						desc={__(
							'How ready your content is to be extracted and quoted directly by AI answer engines.',
							'vulopilot'
						)}
						isLoading={isLoadingSnapshot}
					>
						{!isLoadingSnapshot && !hasSnapshot ? (
							<ProLockedCard moduleName="geo-insights" />
						) : (
							<div className="geo-overall-visibility">
								<ChartComponent
									type="pie"
									height={140}
									centerLabel={
										<>
											<span className="score-ring-number">
												{aeoScore}
											</span>
											<span className="score-ring-label">/100</span>
											<span
												className={`score-ring-label geo-overall-rating ${ratingClass(aeoScore)}`}
											>
												{getRating(aeoScore)}
											</span>
										</>
									}
									data={[
										{
											label: __('Score', 'vulopilot'),
											value: aeoScore,
											color: '#7C3AED',
										},
										{
											label: __('Remaining', 'vulopilot'),
											value: 100 - aeoScore,
											color: '#e5e7eb',
										},
									]}
								/>
							</div>
						)}
					</CardComponent>
				</ColumnComponent>
				<ColumnComponent grid={6}>
					<CardComponent
						title={__('Open Issues', 'vulopilot')}
						desc={__(
							'Real open findings across all 5 AEO checks below.',
							'vulopilot'
						)}
						isLoading={isLoadingGroups}
					>
						<div className="crawler-stat-value">{totalOpenFindings}</div>
						<p className="desc">
							{__(
								'Fixing these raises how often AI answer engines can quote this site directly.',
								'vulopilot'
							)}
						</p>
					</CardComponent>
				</ColumnComponent>
			</ContainerComponent>

			<ContainerComponent>
				<GeoFixTheseFirstCard
					groups={aeoGroups}
					isLoading={isLoadingGroups}
					total={totalOpenFindings}
					title={__('What Needs Your Attention', 'vulopilot')}
					emptyMessage={__(
						'No open AEO findings right now — nothing to fix.',
						'vulopilot'
					)}
					onViewAll={() => goToIssuesTable('all')}
					onSelectScanner={(scannerId) => {
						const section = AEO_SECTIONS.find((s) =>
							s.scannerIds.includes(scannerId)
						);
						goToIssuesTable(section?.key ?? 'all');
					}}
				/>
			</ContainerComponent>

			<GeoByTopicGrid
				topics={AEO_SECTIONS}
				groups={groups}
				isLoading={isLoadingGroups}
				title={__('AEO Checks at a Glance', 'vulopilot')}
				desc={__(
					'Key areas that help answer engines understand and use your content.',
					'vulopilot'
				)}
				onViewTopic={(key) => goToIssuesTable(key)}
			/>

			<div id="aeo-all-issues-table">
				<SectionedFindingsTab
					title={__('All AEO Issues', 'vulopilot')}
					sections={aeoSections}
					activeTab={activeTab}
					onTabChange={setActiveTab}
					header={
						<>
							<CardComponent
								title={__('Answerability signals', 'vulopilot')}
								titleIcon="analytics"
								badges={[
									{ text: __('Not tracked yet', 'vulopilot'), color: 'indigo' },
								]}
								toggle
							>
								<ModuleGuardComponent
									icon="info"
									title={__('Not scoring answerability signals yet', 'vulopilot')}
									desc={__(
										'A dedicated per-signal AEO score breakdown hasn’t been built yet. The AEO Score above already reflects several real answer-extraction dimensions for VuloPilot Pro users.',
										'vulopilot'
									)}
								/>
							</CardComponent>
							<CardComponent
								title={__('Answer engine coverage', 'vulopilot')}
								titleIcon="global-community"
								desc={__(
									'Whether AI answer engines currently cite this site when asked questions its content answers.',
									'vulopilot'
								)}
								badges={[
									{
										text: __('Simulated Citation Checks', 'vulopilot'),
										color: 'purple',
									},
								]}
								toggle
							>
								<ModuleGuardComponent
									icon="info"
									title={__('Not available yet', 'vulopilot')}
									desc={__(
										'Live citation testing against ChatGPT, Perplexity, and other AI answer engines isn’t built yet — flag if you want it scoped next.',
										'vulopilot'
									)}
								/>
							</CardComponent>
							<CardComponent
								title={__('Engine Testing', 'vulopilot')}
								titleIcon="intelligence"
								desc={__(
									'Re-verifies a previously-flagged finding against an AI answer engine once you’ve fixed it, instead of waiting for the next full scan.',
									'vulopilot'
								)}
								badges={[
									{ text: __('Not tracked yet', 'vulopilot'), color: 'indigo' },
								]}
								toggle
							>
								<ModuleGuardComponent
									icon="info"
									title={__('Not available yet', 'vulopilot')}
									desc={__(
										'Per-engine re-test tracking isn’t built yet — flag if you want it scoped next.',
										'vulopilot'
									)}
								/>
							</CardComponent>
						</>
					}
				/>
			</div>
		</>
	);
};

export default AeoTab;
