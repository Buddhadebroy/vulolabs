/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent, ListComponent, BadgeComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { SEO_ISSUE_QUERY_PARAM } from '../../services/seoIssueEditorTarget';
import { formatWpDate } from '../../services/formatWpDate';
import {
	fetchAllPagesWithScores,
	fetchOpenFindingsFor,
	worstFinding,
	GeoAnalysisPageRow,
	RawFinding,
	FindingSeverity,
} from './seoIssuesShared';
import './PageAnalysisPanel.scss';

interface GeoAeoPageAnalysisPanelProps {
	postId: number;
	/** This tab's own real scanner id set (`ALL_GEO_SCANNER_IDS`/`ALL_AEO_SCANNER_IDS`) — same set the "Pages & Posts" table below already scopes its own fetch to, so this panel's own real findings match exactly what that row's own "N issues" count is counting. */
	scannerIds: string[];
	/** "GEO Analysis"/"AEO Analysis" — GeoTab.tsx's/AeoTab.tsx's own real tab identity, since one real panel component serves both (same real data shape either way — see this file's own top docblock). */
	title: string;
	desc: string;
	onClose: () => void;
}

/** Same real severity→badge class convention `SeoSiteWideIssuesTable.tsx`'s/`IssuesList.tsx`'s own `titleBadges` already use (`badge-critical`/`badge-high`/…, real CSS classes already shipped for that exact convention) — reused here directly rather than a third copy of a severity→color map. */
const severityBadgeColor = (severity: FindingSeverity): string => `badge-${severity}`;

/**
 * Same real "zyra's icon font only ever ships `check`/`error`/`close`/
 * `close-delete` glyphs" constraint `PageAnalysisPanel.tsx`'s own
 * `STATUS_ICON` docblock already established — `close`/`error` (not a
 * made-up `info` glyph that would silently render nothing) for every real
 * severity here, since every row in this panel is already an open finding
 * (no "passed" state exists to reuse `check` for).
 */
const SEVERITY_ICON: Record<FindingSeverity, string> = {
	critical: 'close red',
	high: 'close red',
	medium: 'error orange',
	low: 'error orange',
	info: 'error',
};

/** Same real navigate-and-highlight deep link `SeoIssuesByPageTable.tsx`'s own `buildFixWithAiLink()` already establishes — duplicated locally per this codebase's own "duplicate small per-file logic" convention rather than exporting that file's own local helper. */
const buildFixWithAiLink = (editLink: string, scannerId: string): string =>
	`${editLink}&${SEO_ISSUE_QUERY_PARAM}=${encodeURIComponent(scannerId)}`;

/**
 * "Page Analysis" for GEO's/AEO's own "Pages & Posts" table — the same real
 * "Analyze"/"Viewing" toggle + right-side panel SEO's own `PageAnalysisPanel.tsx`
 * already has, requested to match it 1:1. Deliberately NOT a copy of that
 * component: SEO's panel is backed by a real per-page, per-check endpoint
 * (`GET /seo/analyze-page`, `Seo.php::get_page_analysis()`) that runs a
 * fixed checklist (title tag/H1/images/…) fresh for one page and returns
 * both passes and fails. GEO/AEO have no such endpoint — nothing in this
 * codebase computes a full pass/fail checklist for one page on demand for
 * either tab. Building a fake one (inventing "passed" rows with no real
 * check behind them) would be fabricated data, which this codebase's own
 * docblocks consistently refuse to do elsewhere (see `RecentContentCard.tsx`'s
 * own docblock on capabilities it deliberately doesn't rebuild).
 *
 * What IS real and shown here instead: this exact page's own real open
 * findings, scoped to this tab's own scanner ids — the same real findings
 * `SeoIssuesByPageTable.tsx`'s own expandable row already lists for this
 * page, just surfaced as a side panel instead of an inline expansion, to
 * match SEO's own panel *shape* (title/permalink header, a real row list,
 * Edit/View/Fix-with-AI footer) without inventing checklist rows this
 * codebase has no real data for. A page with zero open findings shows a
 * real "no open findings" success state rather than an empty list.
 *
 * Two more real requests rather than reusing `IssuesSection.tsx`'s own
 * in-flight fetch: that component's own `rows` aren't threaded out to its
 * caller (GeoTab.tsx/AeoTab.tsx only get `onAnalyze(postId)`), and both of
 * these are the same real, already-established fetches `IssuesSection.tsx`
 * itself uses for `pageAnalysis` mode (`fetchAllPagesWithScores`) and every
 * mode (`fetchOpenFindingsFor`) — same "one more real GET rather than prop-
 * drill through an unrelated component" call `useAeoPageAnalysis.ts`'s own
 * docblock already makes.
 */
const GeoAeoPageAnalysisPanel = ({
	postId,
	scannerIds,
	title,
	desc,
	onClose,
}: GeoAeoPageAnalysisPanelProps) => {
	const [page, setPage] = useState<GeoAnalysisPageRow | null>(null);
	const [findings, setFindings] = useState<RawFinding[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const scannerIdsKey = scannerIds.join(',');

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		setError(null);

		Promise.all([
			fetchAllPagesWithScores(scannerIds),
			fetchOpenFindingsFor(scannerIds),
		])
			.then(([pages, allFindings]) => {
				if (cancelled) {
					return;
				}

				const matchedPage = pages.find((p) => p.post_id === postId) ?? null;

				if (!matchedPage) {
					setError(
						__('Could not analyze this page. Please try again.', 'vulopilot')
					);
					return;
				}

				setPage(matchedPage);
				setFindings(
					allFindings.filter(
						(finding) => finding.object_ref === String(postId)
					)
				);
			})
			.catch(() =>
				setError(
					__('Could not analyze this page. Please try again.', 'vulopilot')
				)
			)
			.finally(() => {
				if (!cancelled) {
					setIsLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [postId, scannerIdsKey]);

	/** Same real "pick the worst one" posture `SeoIssuesByPageTable.tsx`'s own row-level "Fix with AI" already uses (`worstFinding()`) — `null` (button disabled) when this page has no real open finding to fix. */
	const primaryFinding = findings.length > 0 ? worstFinding(findings) : null;

	return (
		<CardComponent
			className="page-analysis-panel"
			title={title}
			titleIcon="search"
			desc={desc}
			action={
				<div className="page-analysis-panel-actions">
					<button
						type="button"
						className="page-analysis-panel-close"
						onClick={onClose}
						aria-label={__('Close', 'vulopilot')}
					>
						<i className="adminfont-close" />
					</button>
				</div>
			}
			isLoading={isLoading}
		>
			{error && (
				<ModuleGuardComponent
					icon="error"
					title={__('Something went wrong', 'vulopilot')}
					desc={error}
				/>
			)}
			{page && (
				<>
					<div className="page-analysis-search-preview">
						<div className="page-analysis-search-preview-meta">
							{sprintf(
								/* translators: %s: this site's own Settings → General → Date Format, e.g. "10/09/2026". */
								__('Last scanned %s', 'vulopilot'),
								formatWpDate(page.date)
							)}
						</div>
						<div className="page-analysis-search-preview-title">
							{page.title}
						</div>
						<div className="page-analysis-search-preview-url">
							{page.permalink}
						</div>
					</div>

					{findings.length > 0 ? (
						<ListComponent
							className="mini-card report hover"
							items={findings.map((finding) => ({
								id: String(finding.id),
								icon: SEVERITY_ICON[finding.severity],
								title: finding.title,
								action: () => {
									window.location.href = buildFixWithAiLink(
										page.edit_link,
										finding.scanner_id
									);
								},
								tags: (
									<>
										<BadgeComponent
											color={severityBadgeColor(finding.severity)}
											text={finding.severity}
										/>
										<i className="adminfont-pagination-right-arrow ai-copilot-row-arrow" />
									</>
								),
							}))}
						/>
					) : (
						<ModuleGuardComponent
							icon="check"
							title={__('No open findings', 'vulopilot')}
							desc={__(
								'This page has no open findings for this tab’s own checks right now.',
								'vulopilot'
							)}
						/>
					)}

					<ButtonInput
						position="full-width"
						buttons={[
							{
								icon: 'edit',
								color: 'border-green',
								text: __('Edit', 'vulopilot'),
								onClick: () => {
									window.location.href = page.edit_link;
								},
							},
							{
								icon: 'eye',
								color: 'border-blue',
								text: __('View', 'vulopilot'),
								disabled: !page.permalink,
								onClick: () => {
									if (page.permalink) {
										window.open(page.permalink, '_blank', 'noreferrer');
									}
								},
							},
							{
								icon: 'ai',
								color: 'orange-bg',
								text: __('Fix with AI', 'vulopilot'),
								disabled: !primaryFinding,
								onClick: () => {
									if (primaryFinding) {
										window.location.href = buildFixWithAiLink(
											page.edit_link,
											primaryFinding.scanner_id
										);
									}
								},
							},
						]}
					/>
				</>
			)}
		</CardComponent>
	);
};

export default GeoAeoPageAnalysisPanel;
