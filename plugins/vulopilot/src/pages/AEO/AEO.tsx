/* global appLocalizer */
import { __ } from '@wordpress/i18n';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
	NavigatorHeaderComponent,
} from '@zyra/components';
import FindingsTable from '../../components/FindingsTable';
import OpenIssuesGlimpse from '../../components/OpenIssuesGlimpse';
import ProLockedCard from '../../components/ProLockedCard';
import { useRunScan } from '../../services/useRunScan';
import { useSectionStatus } from '../../services/useSectionStatus';

/**
 * Which AEO_SECTIONS card (below) each scanner's findings live under — same
 * "a glimpse row only has a scanner_id, not a section key" reasoning
 * GEO.tsx's own SCANNER_TO_SECTION documents.
 */
const SCANNER_TO_SECTION: Record<string, string> = {
	'geo-summary-block': 'answers',
	'geo-faq-opportunity': 'coverage',
	'aeo-schema': 'structure',
	'geo-citation-opportunities': 'citation',
	'llms-txt-missing': 'crawlability',
};

/**
 * Section → scanner_id grouping for AEO's 5 real scanners — the subset of
 * GEO's own 12 GEO-category scanners (see GEO.tsx's own docblock) that
 * specifically concern getting a direct answer extracted and cited, rather
 * than GEO's broader "can an AI understand this page" scope. Same
 * "category 'geo' shared by every scanner, split here is presentational"
 * reasoning GEO.tsx's own GEO_SECTIONS documents — a finding can
 * legitimately show up grouped under both GEO's own "AI Summary"/"AEO"
 * sections and here, since AEO is its own complete lens over the same
 * finding data, not a disjoint subset.
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
		titleIcon: 'answer',
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
		titleIcon: 'question',
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
		titleIcon: 'blocks',
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
		titleIcon: 'report',
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
		titleIcon: 'search-discovery',
		description: __(
			'Whether AI crawlers can find a curated index of this site’s content.',
			'vulopilot'
		),
		emptyMessage: __(
			'No crawlability findings yet — run a scan to check llms.txt.',
			'vulopilot'
		),
		scannerIds: ['llms-txt-missing'],
		proModule: 'geo-insights',
	},
];

/**
 * Same `active_modules` gate GEO.tsx's own isGeoInsightsActive() uses —
 * 'geo-insights' is GeoInsights' folder name kebab-cased
 * (Modules.php::camel_to_kebab()).
 */
const isGeoInsightsActive = () =>
	appLocalizer.active_modules?.includes('geo-insights') ?? false;

/**
 * One AEO_SECTIONS card — its own component (not inlined in the `.map()`
 * below) because it calls useSectionStatus(), and every section here always
 * has a real, non-empty scannerIds list, so that hook call is always safe
 * (same scannerIds for a given mounted instance's whole lifetime). `toggle`
 * is zyra CardComponent's own built-in collapse affordance (a chevron in
 * the card header that shows/hides the body) — reused here instead of a
 * custom switch, so every section's toggle is positioned identically for
 * free.
 */
const AeoSectionCard = ({
	section,
}: {
	section: (typeof AEO_SECTIONS)[number];
}) => {
	const { badge } = useSectionStatus('geo', section.scannerIds);
	const isLocked = Boolean(section.proModule) && !isGeoInsightsActive();

	return (
		<CardComponent
			id={`aeo-section-${section.key}`}
			title={section.title}
			titleIcon={section.titleIcon}
			desc={section.description}
			badges={badge ? [badge] : []}
			toggle
			defaultExpanded
		>
			{isLocked ? (
				<ProLockedCard moduleName={section.proModule as string} />
			) : (
				<FindingsTable
					title={section.title}
					description={section.emptyMessage}
					scannerIds={section.scannerIds}
					layout="compact"
				/>
			)}
		</CardComponent>
	);
};

/**
 * AEO = Answer Engine Optimization — whether AI systems can extract,
 * structure, and cite a direct answer from this site's pages (distinct from
 * GEO's broader "can an AI understand this page at all" scope, and from
 * classic search-engine SEO). Same header + findings-table shape every
 * other category page (GEO, SEO, Performance, Accessibility, WooCommerce,
 * Security) already uses.
 *
 * Three cards on this page have no real backend anywhere in this codebase
 * today (neither Free nor Pro) — a per-signal "Answerability" score
 * breakdown, live citation testing against named AI answer engines
 * (ChatGPT, Perplexity, etc, "Answer engine coverage"), and per-engine
 * re-test tracking ("Engine Testing", its own card rather than folded into
 * Answer engine coverage — both are real, separate concepts: one is
 * whether an engine currently cites this site at all, the other is
 * whether a specific fixed finding got re-verified against an engine).
 * Rather than fabricate numbers for any of them (this plugin's own
 * Knowledge Graph page's standing rule: "Real data only — nothing here is
 * generated or guessed"), all three render an honest not-built-yet notice
 * with a "Not tracked yet" badge, same posture AIContent.tsx already takes
 * for its own not-yet-scored signals. "Simulated Citation Checks" on
 * Answer engine coverage previews what that card's data source will be
 * once built (a deterministic structural check, not a live AI call) —
 * it's not claiming the check already runs.
 */
const AEO = () => {
	const { runScanButton } = useRunScan();

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="answer"
				headerTitle={__('AEO', 'vulopilot')}
				headerDescription={__(
					'Answer Engine Optimization — whether AI systems can extract, structure, and cite a direct answer from your pages.',
					'vulopilot'
				)}
				buttons={[runScanButton]}
			/>
		<ContainerComponent general>
			<ColumnComponent>
				<CardComponent
					title={__('Answerability signals', 'vulopilot')}
					titleIcon="analytics"
					badges={[
						{ text: __('Not tracked yet', 'vulopilot'), color: 'indigo' },
					]}
					toggle
					defaultExpanded
				>
					<ModuleGuardComponent
						icon="info"
						title={__('Not scoring answerability signals yet', 'vulopilot')}
						desc={__(
							'A dedicated per-signal AEO score breakdown hasn’t been built yet. The overall GEO score on the GEO page already includes several AEO-related dimensions (answer-first structure, question coverage, citation readiness) for VuloPilot Pro users.',
							'vulopilot'
						)}
					/>
				</CardComponent>
				<OpenIssuesGlimpse
					category="geo"
					titleIcon="notification"
					scannerIds={AEO_SECTIONS.flatMap((section) => section.scannerIds)}
					sectionMap={SCANNER_TO_SECTION}
					fallbackSection="answers"
					anchorPrefix="aeo-section-"
					emptyTitle={__("You're all caught up", 'vulopilot')}
					emptyDesc={__('No open AEO findings right now.', 'vulopilot')}
				/>
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
					defaultExpanded
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
					id="aeo-section-engine-testing"
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
					defaultExpanded
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
				{AEO_SECTIONS.map((section) => (
					<AeoSectionCard key={section.key} section={section} />
				))}
			</ColumnComponent>
		</ContainerComponent>
	</>
	);
};

export default AEO;
