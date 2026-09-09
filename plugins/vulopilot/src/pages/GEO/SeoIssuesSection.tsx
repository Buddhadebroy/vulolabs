import { SEO_SECTIONS } from './seoSections';
import { ALL_SEO_SCANNER_IDS } from './seoIssuesShared';
import IssuesSection, { SiteWideIssuesData } from './IssuesSection';

interface CategoryFocus {
	key: string;
	token: number;
}

interface SeoIssuesSectionProps {
	categoryFocus?: CategoryFocus | null;
	/** SeoTab.tsx's own real PageAnalysisPanel trigger — see SeoIssuesByPageTable.tsx's own `onAnalyze` prop docblock. */
	onAnalyze?: (postId: number) => void;
	/**
	 * When given, this section hides its own `SeoSiteWideIssuesTable` and
	 * instead reports that same real data here — for SeoTab.tsx, which
	 * renders that table itself elsewhere on the page (between
	 * `PagesNeedingAttentionTable` and this section) rather than in its
	 * usual spot inside "All SEO Findings", per direct instruction. Omit
	 * for the original, unmoved layout.
	 */
	onSiteWideDataChange?: (data: SiteWideIssuesData) => void;
}

/**
 * SEO's own thin, defaults-only wrapper around the now-generalized
 * `IssuesSection.tsx` (extracted from what used to be this file's full
 * implementation, per direct instruction to give AEO's/GEO's own "All
 * Issues" tables the exact same real structure SEO's already has — see
 * IssuesSection.tsx's own docblock). Kept as its own file/name so
 * `SeoTab.tsx` didn't need to change at all: same import path, same
 * `categoryFocus` prop, identical behavior to before this split.
 */
const SeoIssuesSection = ({ categoryFocus, onAnalyze, onSiteWideDataChange }: SeoIssuesSectionProps) => (
	<IssuesSection
		scannerIds={ALL_SEO_SCANNER_IDS}
		categories={SEO_SECTIONS}
		categoryFocus={categoryFocus}
		issuesColumnLabel="SEO Issues"
		onAnalyze={onAnalyze}
		hideSiteWideTable={!!onSiteWideDataChange}
		onSiteWideDataChange={onSiteWideDataChange}
	/>
);

export default SeoIssuesSection;
