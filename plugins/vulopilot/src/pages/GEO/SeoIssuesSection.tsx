/* global appLocalizer */
import { useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { TabsComponent } from '@zyra/components';
import { SEO_SECTIONS } from './seoSections';
import {
	ALL_SEO_SCANNER_IDS,
	PageRow,
	RawFinding,
	bucketFindingsByPage,
	buildEditLink,
	fetchAllOpenSeoFindings,
	fetchPagesByIds,
	nonceHeaders,
} from './seoIssuesShared';
import SeoSiteWideIssuesTable from './SeoSiteWideIssuesTable';
import SeoIssuesByPageTable from './SeoIssuesByPageTable';

interface FindingGroupRow {
	scanner_id: string;
	label: string;
	count: number;
}

interface CategoryFocus {
	key: string;
	token: number;
}

interface SeoIssuesSectionProps {
	categoryFocus?: CategoryFocus | null;
}

/**
 * Orchestrates the two real tables that replaced one combined "All SEO
 * Issues" card, per direct instruction: "Site-wide Issues"
 * (`SeoSiteWideIssuesTable.tsx`) and a page/post-wise table
 * (`SeoIssuesByPageTable.tsx`). Owns the ONE real fetch+bucket (findings →
 * `{byPostId, siteWide}` → `rows`) both tables render, passed down as
 * props — previously each table did its own independent fetch, which
 * meant the filter pills (built from a separate `GET /findings/groups`
 * aggregate) could show a count bigger than what was actually visible
 * for site-wide-only scanners (sitemap/robots.txt), since
 * `bucketFindingsByPage`'s own dedup only happens client-side, after the
 * server's raw count was already computed. Centralizing the fetch here
 * means the pill counts (`realScannerCounts` below) are recomputed from
 * the exact same deduped data both tables render, so a pill's number
 * always matches what clicking it actually reveals.
 *
 * `categoryFocus` lets `SeoTab.tsx`'s own "SEO checks at a glance" tiles
 * drive this section from outside, per direct instruction: clicking a
 * tile sets a new `{key, token}` (a fresh `token` even for the same `key`
 * twice in a row, so re-clicking the same tile still re-triggers the
 * scroll+filter) which this component picks up in an effect, switches the
 * active filter to that category's real scanner ids (`SEO_SECTIONS`'s own
 * grouping — the same one the glance tiles' own scores are computed from),
 * and scrolls this whole section into view.
 */
const SeoIssuesSection = ({ categoryFocus }: SeoIssuesSectionProps) => {
	const [rows, setRows] = useState<PageRow[]>([]);
	const [siteWideFindings, setSiteWideFindings] = useState<RawFinding[]>([]);
	const [groups, setGroups] = useState<FindingGroupRow[]>([]);
	const [activeFilter, setActiveFilter] = useState('all');
	const [isLoading, setIsLoading] = useState(true);
	const [hasError, setHasError] = useState(false);
	const [reloadToken, setReloadToken] = useState(0);
	const sectionRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		setHasError(false);

		(async () => {
			try {
				const findings = await fetchAllOpenSeoFindings();
				const { byPostId, siteWide } = bucketFindingsByPage(findings);
				const pageIds = Array.from(byPostId.keys());

				const [posts, pages] = await Promise.all([
					fetchPagesByIds('posts', pageIds),
					fetchPagesByIds('pages', pageIds),
				]);

				const builtRows: PageRow[] = [...posts, ...pages].map((post) => ({
					id: post.id,
					title: post.title.rendered,
					status: post.status,
					date: post.date,
					editLink: buildEditLink(post.id),
					viewLink: 'publish' === post.status ? post.link : null,
					findings: byPostId.get(post.id) || [],
				}));

				if (!cancelled) {
					setRows(
						builtRows.sort(
							(a, b) =>
								new Date(b.date).getTime() - new Date(a.date).getTime()
						)
					);
					setSiteWideFindings(siteWide);
				}
			} catch (error) {
				if (!cancelled) {
					setHasError(true);
				}
			} finally {
				if (!cancelled) {
					setIsLoading(false);
				}
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [reloadToken]);

	useEffect(() => {
		getApiResponse<{ data: FindingGroupRow[] }>(
			getApiLink(appLocalizer, 'findings/groups?per_page=100'),
			nonceHeaders
		)
			.then((response) =>
				setGroups(
					(response?.data ?? []).filter((group) =>
						ALL_SEO_SCANNER_IDS.includes(group.scanner_id)
					)
				)
			)
			.catch(() => setGroups([]));
	}, [reloadToken]);

	useEffect(() => {
		if (!categoryFocus) {
			return;
		}

		setActiveFilter(`category:${categoryFocus.key}`);
		sectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		// Only the category tile click (a fresh `token` each time) should
		// re-trigger this — not every re-render that happens to pass a new
		// `categoryFocus` object reference.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [categoryFocus?.token]);

	const refetch = () => setReloadToken((current) => current + 1);

	/** Only used for each pill's human `label` now — see `realScannerCounts` below for why its own `count` isn't used directly. */
	const scannerLabelMap = new Map(groups.map((group) => [group.scanner_id, group.label]));

	/**
	 * Real, displayed-count-accurate per-scanner totals — deliberately NOT
	 * `group.count` from `GET /findings/groups`. That raw aggregate counts
	 * every open Finding row server-side, including the exact duplicate
	 * rows the pre-existing scan/rescan pipeline gap creates
	 * (`bucketFindingsByPage`'s own docblock in seoIssuesShared.tsx) —
	 * `SeoSiteWideIssuesTable.tsx` dedupes those before display, so a pill
	 * built from the raw count would show a bigger number than what's
	 * actually visible for site-wide-only scanners (sitemap/robots.txt).
	 * Recomputed here from the exact same bucketed+deduped `rows`/
	 * `siteWideFindings` both tables render.
	 */
	const realScannerCounts = new Map<string, number>();
	siteWideFindings.forEach((finding) => {
		realScannerCounts.set(
			finding.scanner_id,
			(realScannerCounts.get(finding.scanner_id) || 0) + 1
		);
	});
	rows.forEach((row) =>
		row.findings.forEach((finding) => {
			realScannerCounts.set(
				finding.scanner_id,
				(realScannerCounts.get(finding.scanner_id) || 0) + 1
			);
		})
	);

	const totalOpenIssues = Array.from(realScannerCounts.values()).reduce(
		(total, count) => total + count,
		0
	);

	const filterPills: { id: string; label: string; count: number }[] = [
		{ id: 'all', label: __('All', 'vulopilot'), count: totalOpenIssues },
		...groups.map((group) => ({
			id: `scanner:${group.scanner_id}`,
			label: group.label,
			count: realScannerCounts.get(group.scanner_id) || 0,
		})),
	];

	/** Resolves the active filter (`'all'`, `scanner:<id>`, or `category:<key>`) down to the concrete scanner ids both tables filter their findings by. */
	const activeScannerIds: 'all' | string[] = (() => {
		if ('all' === activeFilter) {
			return 'all';
		}

		if (activeFilter.startsWith('category:')) {
			const key = activeFilter.slice('category:'.length);
			const section = SEO_SECTIONS.find((candidate) => candidate.key === key);
			return section ? section.scannerIds : [];
		}

		return [activeFilter.slice('scanner:'.length)];
	})();

	return (
		<div className="seo-issues-section" ref={sectionRef}>
			<TabsComponent
				className="seo-issues-filter-tabs"
				activeIndex={Math.max(
					filterPills.findIndex((pill) => pill.id === activeFilter),
					0
				)}
				onTabChange={(index: number) => setActiveFilter(filterPills[index].id)}
				tabs={filterPills.map((pill) => ({
					label: sprintf('%1$s (%2$d)', pill.label, pill.count),
				}))}
			/>

			<SeoSiteWideIssuesTable
				findings={siteWideFindings}
				activeScannerIds={activeScannerIds}
				isLoading={isLoading}
				hasError={hasError}
				onRetry={refetch}
			/>
			<SeoIssuesByPageTable
				rows={rows}
				activeScannerIds={activeScannerIds}
				scannerLabelMap={scannerLabelMap}
				isLoading={isLoading}
				hasError={hasError}
				onRetry={refetch}
			/>
		</div>
	);
};

export default SeoIssuesSection;
