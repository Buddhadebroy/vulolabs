import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { ContainerComponent, ColumnComponent } from '@zyra/components';
import IssuesSection from './IssuesSection';
import GeoAeoPageAnalysisPanel from './GeoAeoPageAnalysisPanel';
import GeoScoreSection from './GeoScoreSection';

const GEO_TOPICS: {
	key: string;
	title: string;
	titleIcon: string;
	description: string;
	emptyMessage: string;
	scannerIds: string[];
}[] = [
		{
			key: 'evidence-citations',
			title: __('Evidence & Citations', 'vulopilot'),
			titleIcon: 'report rose',
			description: __(
				'Statistic-shaped claims with no citation or outbound link backing them up.',
				'vulopilot'
			),
			emptyMessage: __(
				'No evidence findings yet - run a scan to check for uncited claims.',
				'vulopilot'
			),
			scannerIds: ['geo-citation-opportunities'],
		},
		{
			key: 'ai-readable-structure',
			title: __('AI-Readable Structure', 'vulopilot'),
			titleIcon: 'blocks lime',
			description: __(
				'Paragraph length and heading hierarchy - how easily an AI system can extract a clean chunk of this content.',
				'vulopilot'
			),
			emptyMessage: __(
				'No structure findings yet - run a scan to check paragraph length and heading hierarchy.',
				'vulopilot'
			),
			scannerIds: ['geo-chunking', 'geo-semantic-structure'],
		},
		{
			key: 'other-signals',
			title: __('Other Signals', 'vulopilot'),
			titleIcon: 'person yellow',
			description: __(
				'Author credentials, naming consistency, trust pages, llms.txt, and content freshness.',
				'vulopilot'
			),
			emptyMessage: __(
				'No other findings yet - run a scan to check author info, naming consistency, and freshness.',
				'vulopilot'
			),
			scannerIds: [
				'geo-author-info',
				'geo-eeat-signals',
				'geo-entity-naming-consistency',
				'geo-trust-signals',
				'llms-txt-missing',
				'stale-content',
			],
		},
	];

/**
 * GEO = Generative Engine Optimization - how discoverable/citable this
 * site is to AI answer engines (distinct from classic search-engine SEO).
 * Reusing real data already fetched elsewhere on this tab rather than
 * duplicating it (direct instruction):
 */
const GeoTab = () => {
	const [categoryFocus, setCategoryFocus] = useState<{
		key: string;
		token: number;
	} | null>(null);

	const allGeoScannerIds = GEO_TOPICS.flatMap((topic) => topic.scannerIds);

	/** Set by a real "Analyze" click in the "Pages & Posts" table below - opens `GeoAeoPageAnalysisPanel` as a real sidebar, same real "Analyze"/"Viewing" toggle + side panel SeoTab.tsx's own SEO table already has (see that panel's own docblock for why it shows real findings instead of a fabricated pass/fail checklist). */
	const [analyzingPostId, setAnalyzingPostId] = useState<number | null>(null);

	/**
	 * Sets a fresh `categoryFocus` (a new `token` even for the same `key`
	 * twice in a row) - `IssuesSection.tsx`'s own effect both switches its
	 * active filter to that topic (or resets to unfiltered for the literal
	 * `'all'`) and scrolls itself into view, so this doesn't also need its
	 * own `scrollToId()` call the way the old `SectionedFindingsTab`-based
	 * version did.
	 */
	const goToIssuesTable = (key: string = 'all') => {
		setCategoryFocus({ key, token: Date.now() });
	};

	return (
		<ContainerComponent>
			<GeoScoreSection onSelectSignal={goToIssuesTable} />

			<ColumnComponent grid={8}>
				<IssuesSection
					id="geo-all-issues-table"
					scannerIds={allGeoScannerIds}
					categories={GEO_TOPICS}
					categoryFocus={categoryFocus}
					title={__('All GEO Findings', 'vulopilot')}
					titleIcon="tools"
					desc={__('Every open GEO finding, filterable by priority.', 'vulopilot')}
					issuesColumnLabel={__('GEO Issues', 'vulopilot')}
					pageAnalysis={{
						scoreColumnLabel: __('AI Visibility', 'vulopilot'),
						exportFilename: 'geo-page-analysis.csv',
					}}
					onAnalyze={setAnalyzingPostId}
					activePostId={analyzingPostId}
				/>
			</ColumnComponent>
			{analyzingPostId && (
				<ColumnComponent grid={4}>
					<GeoAeoPageAnalysisPanel
						postId={analyzingPostId}
						scannerIds={allGeoScannerIds}
						title={__('Page Analysis', 'vulopilot')}
						desc={__(
							'A single page’s real GEO signals from your most recent scan.',
							'vulopilot'
						)}
						onClose={() => setAnalyzingPostId(null)}
					/>
				</ColumnComponent>
			)}
		</ContainerComponent>
	);
};

export default GeoTab;
