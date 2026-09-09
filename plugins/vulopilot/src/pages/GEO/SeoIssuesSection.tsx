import { SEO_SECTIONS } from './seoSections';
import { ALL_SEO_SCANNER_IDS } from './seoIssuesShared';
import IssuesSection from './IssuesSection';

interface CategoryFocus {
	key: string;
	token: number;
}

interface SeoIssuesSectionProps {
	categoryFocus?: CategoryFocus | null;
	/** SeoTab.tsx's own real PageAnalysisPanel trigger — see SeoIssuesByPageTable.tsx's own `onAnalyze` prop docblock. */
	onAnalyze?: (postId: number) => void;
	/** SeoTab.tsx's own `analyzingPostId` — threaded through to `IssuesSection.tsx`'s own identical prop, and from there to `SeoIssuesByPageTable.tsx`'s "Analyze"/"Viewing" toggle. */
	activePostId?: number | null;
}

/**
 * SEO's own thin, defaults-only wrapper around the generalized
 * `IssuesSection.tsx` — back to wrapping it directly (per direct
 * instruction: "Pages that need attention"'s own Score/Change columns and
 * its "Analyze"/"Viewing" toggle now live on `IssuesSection.tsx`'s own
 * "Pages & Posts" table instead of a separate standalone table), after a
 * brief detour through a simpler `useFindingsTable`+`TableCard` shape that
 * had no page-grouped rows to carry a per-page Score/Change column on.
 * `pageScore: true` is the one thing only this SEO usage sets — see
 * `IssuesSection.tsx`'s own `pageScore` prop docblock for what that joins
 * in and why AeoTab.tsx's/GeoTab.tsx's own usage never sets it.
 */
const SeoIssuesSection = ({ categoryFocus, onAnalyze, activePostId }: SeoIssuesSectionProps) => (
	<IssuesSection
		scannerIds={ALL_SEO_SCANNER_IDS}
		categories={SEO_SECTIONS}
		categoryFocus={categoryFocus}
		issuesColumnLabel="SEO Issues"
		onAnalyze={onAnalyze}
		activePostId={activePostId}
		pageScore
	/>
);

export default SeoIssuesSection;
