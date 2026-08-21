/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	BadgeComponent,
	CardComponent,
	ColumnComponent,
	ModuleGuardComponent,
	NoticeComponent,
	NoticeManager,
	PopupComponent,
} from '@zyra/components';
import { ButtonInput, SelectInput, TextInput, ToggleInput } from '@zyra/inputs';
import { TableCard, TableRow } from '@zyra/table';
import { Finding, getFindingFixHandler } from '../../services/useFindingsTable';
import { formatWpDate } from '../../services/formatWpDate';
import { useApiList } from '../../services/useApiList';
import { RowAction, RowActionsMenu } from './seoIssuesShared';
import ShowProPopup from '../../components/Popup/Popup';
import './SeoVisibility.scss';

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/** Scanners\Basic\BrokenLinksScanner + Scanners\Basic\BrokenImagesScanner — this tab's own two real data sources. */
const BROKEN_SCANNER_IDS = ['broken-links', 'broken-images'];

/**
 * `GET /findings` is a real `SELECT *` (AbstractRepository::find_all()),
 * so every row already carries the raw `meta`/`scanner_id`/`object_ref`
 * DB columns even though the shared `Finding` type (useFindingsTable.tsx)
 * only declares the fields every OTHER findings-backed tab has needed so
 * far. `object_ref` is a single real post id string for both these
 * scanners (never the comma-joined list DuplicateContentScanner's own
 * multi-page findings use — see each scanner's own `scan()`).
 */
interface BrokenLinkFinding extends Finding {
	meta?: string;
	scanner_id?: string;
	object_ref?: string;
}

interface RunStats {
	pages_scanned: number;
	links_checked: number;
	healthy_count: number;
	checked_at: number | null;
}

interface BrokenLinksStatsResponse {
	links: RunStats;
	images: RunStats;
}

interface BrokenFindingsSummary {
	brokenLinks: number;
	brokenImages: number;
	couldntVerify: number;
	ignored: number;
}

const EMPTY_SUMMARY: BrokenFindingsSummary = {
	brokenLinks: 0,
	brokenImages: 0,
	couldntVerify: 0,
	ignored: 0,
};

/**
 * Same real "seo module gates its own scanners" check SeoTab.tsx and
 * CrawlerTrafficTab.tsx already use — both BrokenLinksScanner and
 * BrokenImagesScanner are registered by modules/Seo/Module.php, not
 * unconditionally like GeoInsights' own scanners, so their findings
 * simply don't exist while SEO is off.
 */
const isSeoModuleActive = () =>
	appLocalizer.active_modules?.includes('seo') ?? false;

/**
 * Scanners\Basic\BrokenLinksScanner/BrokenImagesScanner::scan() both
 * store `{"url": "...", "reason": "broken"|"unverified"}` in the
 * finding's own `meta` column — this reads that JSON defensively since
 * `meta` is free-form per scanner.
 */
const getFindingMeta = (
	finding: Pick<BrokenLinkFinding, 'meta'>
): { url?: string; reason?: string } => {
	try {
		return JSON.parse(finding.meta || '{}');
	} catch {
		return {};
	}
};

const getBrokenUrl = (finding: BrokenLinkFinding): string =>
	getFindingMeta(finding).url || '';

/**
 * Resolves a broken URL down to a real, literal path
 * `RedirectManager::maybe_apply_redirect()` can actually intercept — that
 * class matches on an exact `source_path` string, not a regex, so this
 * has to be a real path on THIS site. Returns null for an external dead
 * link (a different domain entirely), which has no path on this site to
 * redirect from — creating a same-site redirect rule for someone else's
 * broken URL wouldn't do anything.
 */
const deriveSourcePath = (url: string): string | null => {
	if (!url) {
		return null;
	}

	try {
		const target = new URL(url, appLocalizer.site_url);
		const site = new URL(appLocalizer.site_url);

		if (target.origin !== site.origin) {
			return null;
		}

		return target.pathname || '/';
	} catch {
		return null;
	}
};

/**
 * True when a finding's broken URL points at a different site entirely —
 * i.e. deriveSourcePath() above returns null for it. Used to disable the
 * "Create redirect" row action up front for these rows (dynamic
 * label/icon/onClick, see the `actions` column below) instead of only
 * rejecting the click after the fact, since RedirectManager.php can
 * never intercept a request that never reaches this site in the first
 * place.
 */
const isExternalFinding = (finding: BrokenLinkFinding): boolean =>
	!deriveSourcePath(getBrokenUrl(finding));

/**
 * A short, real status key derived from the scanner's own real
 * `meta.reason` + `description` — a 'broken' finding always carries a
 * real `HTTP %d` in its description (BrokenLinksScanner::check_link()'s
 * own sprintf), so that code IS the key; an 'unverified' finding carries
 * a real cURL error message, narrowed to 'dns' when it says "resolve"
 * (covers both "Could not resolve host" and "Resolving timed out" — cURL
 * error 6 and the DNS-phase flavor of error 28) or 'timeout' for any
 * other "timed out", falling back to a generic 'unverified'.
 *
 * Deliberately does NOT invent categories neither scanner has any way to
 * actually detect — a "Soft 404" or a redirect "Chain" (the reference
 * mockup's own other status pills) would need following redirects and
 * inspecting the destination page's own content/status, which
 * check_link()/check_image() don't do today (a single HEAD request,
 * `redirection: 5` handled transparently by wp_remote_head() itself, so
 * this code never even sees an intermediate hop to call a "chain"). See
 * this file's own docblock for the full list of what was and wasn't
 * built to match that mockup.
 */
const deriveStatusKey = (finding: BrokenLinkFinding): string => {
	const { reason } = getFindingMeta(finding);
	const description = finding.description || '';

	if ('broken' === reason) {
		const match = description.match(/HTTP (\d+)/);
		return match ? match[1] : 'broken';
	}

	if (/resolv/i.test(description)) {
		return 'dns';
	}

	if (/timed out/i.test(description)) {
		return 'timeout';
	}

	return 'unverified';
};

/** Human label for a deriveStatusKey() result — real HTTP codes pass through unchanged (they're already the label). */
const statusKeyLabel = (key: string): string => {
	switch (key) {
		case 'broken':
			return __('Broken', 'vulopilot');
		case 'dns':
			return __('DNS', 'vulopilot');
		case 'timeout':
			return __('Timeout', 'vulopilot');
		case 'unverified':
			return __('Unverified', 'vulopilot');
		default:
			return key; // a real numeric HTTP status code
	}
};

/** Lower rank = shown as the page-group's own worst/representative status when it has several findings — a confirmed HTTP error outranks an unverified/DNS/timeout result, since it's the more certain problem. */
const statusKeyRank = (key: string): number => {
	if (/^\d+$/.test(key)) {
		return 0;
	}

	switch (key) {
		case 'dns':
			return 1;
		case 'timeout':
			return 2;
		default:
			return 3;
	}
};

/** Every distinct status a page-group's own findings actually carry, first-occurrence order (findings arrive newest-first — see groupFindingsByPage's own docblock — so this reads left-to-right as "most-recently-detected status first," not severity-ranked) — a group with a mix of e.g. DNS and 503 findings shows both badges instead of silently collapsing to just one. */
const distinctStatusKeys = (keys: string[]): string[] => {
	const seen = new Set<string>();
	const distinct: string[] = [];

	keys.forEach((key) => {
		if (!seen.has(key)) {
			seen.add(key);
			distinct.push(key);
		}
	});

	return distinct;
};

/** Palette color name (BadgeComponent's own `color` prop — common.scss's `$color-palette`) — a confirmed HTTP error or DNS failure reads as more severe (red) than an unverified/timed-out check this scanner just couldn't confirm either way (yellow), same distinction the "Broken" vs "Couldn't verify" stat tiles above already draw. */
const statusKeyColor = (key: string): string =>
	0 === statusKeyRank(key) || 'dns' === key ? 'red' : 'yellow';

/**
 * Real, client-side CSV built straight from whatever findings are
 * currently visible (all of them — search/show-ignored already applied
 * by the caller — not just one page's worth, now that this tab fetches
 * every finding up front for the page-grouped table below).
 */
const downloadBrokenLinksCsv = (rows: BrokenLinkFinding[]) => {
	const header = [
		__('Source page', 'vulopilot'),
		__('Broken URL', 'vulopilot'),
		__('Type', 'vulopilot'),
		__('Status', 'vulopilot'),
		__('Finding status', 'vulopilot'),
		__('Detected', 'vulopilot'),
	];
	const lines = rows.map((row) =>
		[
			row.page ?? '',
			getBrokenUrl(row),
			'broken-images' === row.scanner_id
				? __('Image', 'vulopilot')
				: __('Link', 'vulopilot'),
			statusKeyLabel(deriveStatusKey(row)),
			row.status,
			row.created_at,
		]
			.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`)
			.join(',')
	);
	const csv = [header.join(','), ...lines].join('\n');
	const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');

	link.href = url;
	link.download = 'broken-links.csv';
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
};

const FINDINGS_PAGE_SIZE = 100;
/** Safety ceiling for the pagination loop below — both scanners are bounded to ~40 checks/run by design, so a real site needs a long history of distinct broken URLs to ever approach this. */
const MAX_FINDINGS = 500;

/**
 * Fetches every real broken-link/broken-image finding, any status —
 * bounded pagination loop, same real shape seoIssuesShared.tsx's own
 * fetchAllOpenSeoFindings uses, just not status-filtered up front (the
 * "Ignored" tile and "Show ignored" toggle both need `status === 'ignored'`
 * rows too, which an `open`-only fetch would hide). Feeds both the stat
 * tiles AND the page-grouped table below from this one fetch — grouping
 * by page only makes sense over the FULL result set, not one server-paged
 * slice of it, so this tab no longer uses useFindingsTable's own
 * per-page fetch for its main table (see this file's own docblock).
 */
const fetchAllBrokenFindings = async (): Promise<BrokenLinkFinding[]> => {
	const scannerParam = BROKEN_SCANNER_IDS.join(',');
	let page = 1;
	let all: BrokenLinkFinding[] = [];

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const response = await getApiResponse<{
			data: BrokenLinkFinding[];
			total: number;
		}>(
			getApiLink(
				appLocalizer,
				`findings?scanner_id=${scannerParam}&per_page=${FINDINGS_PAGE_SIZE}&page=${page}&orderby=id&order=desc`
			),
			nonceHeaders
		);

		if (!response) {
			throw new Error('findings fetch failed');
		}

		all = all.concat(response.data ?? []);

		const gotFullPage = (response.data ?? []).length === FINDINGS_PAGE_SIZE;
		const moreRemain = all.length < (response.total ?? 0);

		if (!gotFullPage || !moreRemain || all.length >= MAX_FINDINGS) {
			break;
		}

		page += 1;
	}

	return all;
};

const summarizeBrokenFindings = (
	findings: BrokenLinkFinding[]
): BrokenFindingsSummary => {
	const summary = { ...EMPTY_SUMMARY };

	findings.forEach((finding) => {
		if ('ignored' === finding.status) {
			summary.ignored += 1;
			return;
		}

		if ('open' !== finding.status) {
			return; // Resolved/snoozed don't count toward "Need attention".
		}

		if ('unverified' === getFindingMeta(finding).reason) {
			summary.couldntVerify += 1;
			return;
		}

		if ('broken-images' === finding.scanner_id) {
			summary.brokenImages += 1;
		} else {
			summary.brokenLinks += 1;
		}
	});

	return summary;
};

const formatCheckedAt = (unixSeconds: number | null): string =>
	unixSeconds
		? formatWpDate(new Date(unixSeconds * 1000).toISOString())
		: __('Never run yet', 'vulopilot');

/**
 * One row per SOURCE PAGE, its findings nested as real expandable
 * sub-rows — zyra `TableCard`'s own native `expandable` mechanism
 * (`row.variation: BrokenLinkFinding[]`), the same real, already-shipped
 * pattern SeoIssuesByPageTable.tsx uses for its own page-grouped SEO
 * issues table, not a hand-rolled tree. `id`s are `page:${path}` strings
 * for group rows (a real finding's own numeric `id` would never collide
 * with one, but namespacing it removes any doubt) and the real finding
 * `id` for its own sub-rows.
 */
interface PageGroupRow extends TableRow {
	id: string;
	isFinding?: false;
	page: string;
	findings: BrokenLinkFinding[];
}

type BrokenLinkRow = PageGroupRow | (BrokenLinkFinding & { isFinding: true });

const isFindingRow = (
	row: BrokenLinkRow
): row is BrokenLinkFinding & { isFinding: true } => true === row.isFinding;

/**
 * Collapses duplicate findings for the exact same broken URL on the exact
 * same page/scanner/status down to just the newest one — a scan re-run
 * that finds a link is STILL broken re-adds a fresh open finding for it
 * each time rather than updating the existing one for any row already
 * persisted before ScanPersistenceListener's own dedup-on-rescan fix
 * (Services/ScanPersistenceListener.php), so this is what actually makes
 * an already-duplicated row disappear from the table for a site that had
 * this happen before that fix shipped, without needing a one-off DB
 * cleanup. Scoped to (scanner_id, object_ref, url, status) rather than
 * just (scanner_id, object_ref, url) — an old *resolved* finding and a
 * newly-detected *open* one for the same URL are two genuinely different,
 * both-worth-showing rows, not a duplicate. Relies on `findings` already
 * being newest-first (`orderby=id&order=desc`, same ordering
 * groupFindingsByPage() below depends on) — the first occurrence of a key
 * is already the most recent one, so this only needs one pass.
 */
const dedupeBrokenFindings = (
	findings: BrokenLinkFinding[]
): BrokenLinkFinding[] => {
	const seen = new Set<string>();

	return findings.filter((finding) => {
		const key = [
			finding.scanner_id,
			finding.object_ref,
			getBrokenUrl(finding),
			finding.status,
		].join('::');

		if (seen.has(key)) {
			return false;
		}

		seen.add(key);
		return true;
	});
};

/** Splits a flat finding list into one row per real `page` path (Controllers/Findings.php's own `add_page_field()` — always populated for these two scanners, both `object_type: 'post'`). Map insertion order is what decides display order here — `findings` is already fetched newest-first (`orderby=id&order=desc`), so a page's group naturally sorts by when its most recent finding was detected, with no second sort pass needed. */
const groupFindingsByPage = (findings: BrokenLinkFinding[]): PageGroupRow[] => {
	const byPage = new Map<string, BrokenLinkFinding[]>();

	findings.forEach((finding) => {
		const page = finding.page || __('Unknown page', 'vulopilot');
		byPage.set(page, [...(byPage.get(page) || []), finding]);
	});

	return Array.from(byPage.entries()).map(([page, pageFindings]) => ({
		id: `page:${page}`,
		page,
		findings: pageFindings,
	}));
};

/**
 * zyra `Table.tsx`'s own expand/collapse state (`expandedRows`) is fully
 * internal — the only way to toggle it from outside is a real click on the
 * chevron `<i>` it renders itself inside `td.admin-column.expand` (see
 * that component's own source; SeoIssuesByPageTable.tsx's own docblock
 * confirms the same). That chevron is small and easy to miss on a row that
 * otherwise reads as plain text, so the Status badge and "N broken" count
 * below both also walk up to their row and fire a real `click` on the
 * (still visible, unlike SeoIssuesByPageTable.tsx's own hidden one) chevron
 * — giving a page row two large, obvious click targets in addition to the
 * chevron itself, not just the one small icon. A no-op on a finding
 * sub-row (no chevron there to find, since sub-rows never render one).
 */
const toggleRowExpansion = (event: React.MouseEvent<HTMLElement>) => {
	const rowEl = event.currentTarget.closest('tr.admin-row');
	const expandIcon = rowEl?.querySelector<HTMLElement>(
		':scope > td.admin-column.expand > i'
	);
	expandIcon?.click();
};

/** First real candidate a page-group's own "Create redirect" action can act on — skips ignored/external findings, same eligibility a single finding row's own action already enforces. Multiple eligible findings on one page still each get their own "Create redirect" once the group is expanded; this only picks ONE target for the group row's own single action, since one click can't sensibly redirect several different broken URLs to one destination at once. */
const firstRedirectCandidate = (
	findings: BrokenLinkFinding[]
): BrokenLinkFinding | null =>
	findings.find(
		(finding) => 'ignored' !== finding.status && !isExternalFinding(finding)
	) ?? null;

/**
 * "Broken Links" inner section of the merged "Crawl & URLs" tab (renamed
 * and moved here — was its own top-level "Broken Links" tab,
 * BrokenLinksTab.tsx — direct instruction: "Broken Links + Redirects +
 * Crawler Traffic are fragmented... one main tab: Crawl & URLs"): real,
 * scanned results from Scanners\Basic\BrokenLinksScanner AND
 * BrokenImagesScanner (`scanner_id: 'broken-links'|'broken-images'`), the
 * same `vulopilot_scan_findings` rows the SEO tab's own "Links & schema"
 * section used to also include for broken links (before that overlap was
 * fixed too — see SeoTab.tsx's own docblock).
 *
 * The 404 log this tab used to also render below "Broken Link Monitoring"
 * split out into its own real NotFoundLogSection.tsx (this same merge's
 * own "404s" inner tab) — a 404 visit and a broken link/image finding are
 * both "something's broken on this site," but the requested "Overview |
 * Broken Links | Redirects | 404s | Robots & Sitemap" structure gives
 * each its own real tab rather than bundling them under this one's name.
 * Nothing about the split logic itself changed — NotFoundLogSection.tsx's
 * own `notFoundLogs`/`convertingLog`/convert-to-redirect flow is the
 * exact same code, just in its own file, since it never shared any real
 * state with this tab's own broken-link/image findings (confirmed before
 * splitting: its own `POST /not-found-logs/{id}/convert` call is fully
 * self-contained, same as this tab's own separate `openRedirectPopup`
 * flow for a broken-link finding is).
 *
 * No separate "Enabled"/frequency/"Scan now" controls on this tab per
 * direct instruction — GEO.tsx's own page-level "Run scan" button already
 * covers the `links`/`images` categories. The
 * `flag_broken_links`/`flag_broken_images` settings (and their own
 * frequencies) are still real and live — reachable from Settings →
 * Scanning → SEO.
 *
 * Stat tiles are real, not decorative, per direct instruction to match
 * the reference mockup's own "Need attention"/"Ignored"/"Last scan"
 * groups without fabricating anything — see summarizeBrokenFindings()'s
 * own docblock. Deliberately NOT blended into one combined "X% healthy"
 * figure: "Need attention" is a cumulative, all-time view of currently
 * open findings, while "Last scan" reflects only the single most recent
 * run — dividing one by the other would silently mix two different time
 * windows into a number that looks precise but isn't actually coherent.
 *
 * The main table is grouped by source page, per direct instruction to
 * match the reference mockup's own layout — one row per page (real path,
 * from `Finding.page`), its own broken links/images nested underneath as
 * real expandable sub-rows (zyra `TableCard`'s native `expandable`
 * mechanism, the same one SeoIssuesByPageTable.tsx already uses; unlike
 * that table, this one leaves zyra's own expand chevron visible rather
 * than hiding it, matching the mockup's own visible caret). Two real
 * things the mockup shows that this table deliberately does NOT
 * reproduce, because there's no real data behind them in this codebase:
 *   - Its "Findings" column sometimes reads "1 page issue + N broken" —
 *     the "page issue" half implies the SOURCE PAGE ITSELF is broken
 *     (soft-404, etc.), which can't happen here: both scanners only ever
 *     scan already-published posts/pages for broken `<a href>`/`<img
 *     src>` INSIDE their content, so a "source page" row is always a
 *     real, live page. This table's own "Findings" column just reads "N
 *     broken" — a real, honest count of that page's own findings, no
 *     invented second category.
 *   - Its "Status" pills include "DNS"/"Chain"/"Soft 404" alongside real
 *     HTTP codes. "DNS" is real here too (deriveStatusKey() below reads
 *     it straight off a real cURL "could not resolve host" error); "Soft
 *     404" and "Chain" aren't — both would need actually following a
 *     redirect chain and inspecting the destination's own content/status,
 *     which neither scanner does (a single HEAD request; wp_remote_head()
 *     already follows up to 5 redirects transparently, so this code never
 *     even sees an intermediate hop). Every status pill this table shows
 *     is a real value straight off that finding's own `meta.reason`/
 *     `description` — a real HTTP code, "DNS", "Timeout", or a generic
 *     "Unverified", never a guess.
 *
 * A page-group row's own "Create redirect"/"Ignore" actions are real bulk
 * shortcuts, not per-finding actions relocated up a level: "Ignore"
 * ignores every currently-open finding on that page in one real batch of
 * `POST /findings/{id}` calls (handleBulkIgnore); "Create redirect" opens
 * the same real popup RedirectsTab.tsx's own "Add redirect" form uses,
 * targeting the first eligible (open, non-ignored, same-site) finding on
 * that page (firstRedirectCandidate) — genuinely disabled with an
 * explanatory hover label, same isExternalFinding pattern a single
 * finding row's own action already uses, when nothing on that page
 * qualifies. Expanding a page still shows each finding's own full action
 * set (Create redirect/Resolve/Ignore/Snooze/Fix) for anything the bulk
 * shortcut doesn't cover.
 *
 * "Fix" reuses useFindingsTable.tsx's own exported getFindingFixHandler()
 * — same real Pro-gating (vulopilot-pro's OneClickFix module registers
 * the real handler; Free shows the Pro popup when it isn't active) other
 * findings tables get from that hook directly, without pulling the whole
 * hook in here: this tab builds its own grouped rows/headers rather than
 * rendering useFindingsTable's tableCardProps, and needs the exact same
 * fetch-after-every-action data flow as its "Need attention" tiles and
 * "Show ignored" toggle (loadFindings(), below) — which a component
 * bound to that hook's own internal refetch() can't guarantee, since its
 * row-action closures don't expose a completion callback to chain onto.
 *
 * "Show ignored" is a real, functional toggle — client-side hides/shows
 * `status === 'ignored'` findings from the one real, full-site fetch this
 * tab already makes (loadFindings(), below) before grouping by page, so a
 * page whose only findings are all ignored disappears entirely with the
 * toggle off, same as before.
 */
const BrokenLinksSection = () => {
	const [allFindings, setAllFindings] = useState<BrokenLinkFinding[]>([]);
	const [isLoadingFindings, setIsLoadingFindings] = useState(true);
	const [findingsError, setFindingsError] = useState<string | null>(null);
	const [stats, setStats] = useState<BrokenLinksStatsResponse | null>(null);
	const [showIgnored, setShowIgnored] = useState(false);
	const [searchTerm, setSearchTerm] = useState('');
	const [typeFilter, setTypeFilter] = useState<'all' | 'broken-links' | 'broken-images'>('all');
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);

	const [redirectFinding, setRedirectFinding] =
		useState<BrokenLinkFinding | null>(null);
	const [redirectSourcePath, setRedirectSourcePath] = useState('');
	const [redirectTargetUrl, setRedirectTargetUrl] = useState('');
	const [redirectType, setRedirectType] = useState('301');
	const [isSavingRedirect, setIsSavingRedirect] = useState(false);

	const loadFindings = () => {
		setIsLoadingFindings(true);

		fetchAllBrokenFindings()
			.then((findings) => {
				setAllFindings(dedupeBrokenFindings(findings));
				setFindingsError(null);
			})
			.catch(() =>
				setFindingsError(
					__(
						'Something went wrong fetching this data. Please try again.',
						'vulopilot'
					)
				)
			)
			.finally(() => setIsLoadingFindings(false));
	};

	useEffect(() => {
		loadFindings();

		getApiResponse<BrokenLinksStatsResponse>(
			getApiLink(appLocalizer, 'broken-links/stats'),
			nonceHeaders
		).then((response) => response && setStats(response));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const summary = summarizeBrokenFindings(allFindings);
	const needAttentionTotal =
		summary.brokenLinks + summary.brokenImages + summary.couldntVerify;

	const handleSetStatus = (
		finding: BrokenLinkFinding,
		status: 'resolved' | 'ignored' | 'open',
		successMessage: string
	) => {
		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, `findings/${finding.id}`),
			{ status }
		).then((response) => {
			NoticeManager.add({
				uniqueKey: `broken-link-${status}-${finding.id}`,
				type: response ? 'success' : 'error',
				position: 'float',
				message: response
					? successMessage
					: __(
							'Could not update this finding. Please try again.',
							'vulopilot'
						),
			});

			if (response) {
				loadFindings();
			}
		});
	};

	const handleResolve = (finding: BrokenLinkFinding) =>
		handleSetStatus(
			finding,
			'resolved',
			__('Finding marked as resolved.', 'vulopilot')
		);

	const handleIgnore = (finding: BrokenLinkFinding) =>
		handleSetStatus(finding, 'ignored', __('Finding ignored.', 'vulopilot'));

	const handleReopen = (finding: BrokenLinkFinding) =>
		handleSetStatus(finding, 'open', __('Finding reopened.', 'vulopilot'));

	const handleSnooze = (finding: BrokenLinkFinding) => {
		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, `findings/${finding.id}/actions/snooze-finding`),
			{}
		).then(
			(response: { success?: boolean; message?: string } | undefined) => {
				NoticeManager.add({
					uniqueKey: `broken-link-snooze-${finding.id}`,
					type: response?.success ? 'success' : 'error',
					position: 'float',
					message:
						response?.message ||
						__(
							'Could not snooze this finding. Please try again.',
							'vulopilot'
						),
				});

				if (response?.success) {
					loadFindings();
				}
			}
		);
	};

	const handleFix = (finding: BrokenLinkFinding) => {
		const findingFixHandler = getFindingFixHandler();

		if (typeof findingFixHandler === 'function') {
			Promise.resolve(
				findingFixHandler(finding) as
					| Promise<{ success: boolean; message: string }>
					| undefined
			).then((outcome) => {
				if (outcome?.message) {
					NoticeManager.add({
						uniqueKey: `broken-link-fix-${finding.id}`,
						type: outcome.success ? 'success' : 'error',
						position: 'float',
						message: outcome.message,
					});
				}

				loadFindings();
			});
			return;
		}

		setIsProPopupOpen(true);
	};

	const handleBulkIgnore = (findings: BrokenLinkFinding[]) => {
		const openFindings = findings.filter(
			(finding) => 'open' === finding.status
		);

		if (!openFindings.length) {
			return;
		}

		Promise.all(
			openFindings.map((finding) =>
				sendApiResponse(
					appLocalizer,
					getApiLink(appLocalizer, `findings/${finding.id}`),
					{ status: 'ignored' }
				)
			)
		).then((responses) => {
			const succeeded = responses.filter(Boolean).length;

			NoticeManager.add({
				uniqueKey: `broken-link-bulk-ignore-${openFindings[0]?.id ?? 'x'}`,
				type: succeeded === responses.length ? 'success' : 'error',
				position: 'float',
				message:
					succeeded === responses.length
						? sprintf(
								/* translators: %d: number of findings ignored. */
								_n(
									'%d finding ignored.',
									'%d findings ignored.',
									succeeded,
									'vulopilot'
								),
								succeeded
							)
						: __(
								'Some findings could not be ignored. Please try again.',
								'vulopilot'
							),
			});

			if (succeeded > 0) {
				loadFindings();
			}
		});
	};

	const openRedirectPopup = (finding: BrokenLinkFinding) => {
		const brokenUrl = getBrokenUrl(finding);
		const sourcePath = deriveSourcePath(brokenUrl);

		if (!sourcePath) {
			NoticeManager.add({
				uniqueKey: `broken-link-external-${finding.id}`,
				type: 'error',
				position: 'float',
				message: __(
					'This broken URL points to a different site — a redirect can only be created for a path on this site.',
					'vulopilot'
				),
			});
			return;
		}

		setRedirectFinding(finding);
		setRedirectSourcePath(sourcePath);
		setRedirectTargetUrl('');
		setRedirectType('301');
	};

	const closeRedirectPopup = () => setRedirectFinding(null);

	const handleCreateRedirect = () => {
		if (!redirectFinding || '' === redirectTargetUrl.trim()) {
			return;
		}

		setIsSavingRedirect(true);

		sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'redirects'), {
			source_path: redirectSourcePath,
			target_url: redirectTargetUrl,
			redirect_type: Number(redirectType),
		})
			.then((response) => {
				NoticeManager.add({
					uniqueKey: 'broken-link-redirect-save',
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __('Redirect created.', 'vulopilot')
						: __(
								'Could not create this redirect — a redirect for this path may already exist.',
								'vulopilot'
							),
				});

				if (response && redirectFinding) {
					// The underlying problem is fixed from a visitor's
					// perspective now that a real redirect exists — same
					// real `POST /findings/{id}` status-update call
					// handleResolve() above makes.
					sendApiResponse(
						appLocalizer,
						getApiLink(appLocalizer, `findings/${redirectFinding.id}`),
						{ status: 'resolved' }
					).then(() => loadFindings());

					closeRedirectPopup();
				}
			})
			.finally(() => setIsSavingRedirect(false));
	};

	const handleExportCsv = () => {
		if (!visibleFindings.length) {
			NoticeManager.add({
				uniqueKey: 'broken-link-export-empty',
				type: 'error',
				position: 'float',
				message: __('Nothing to export.', 'vulopilot'),
			});
			return;
		}

		downloadBrokenLinksCsv(visibleFindings);
	};

	const buildFindingActions = (finding: BrokenLinkFinding): RowAction[] => [
		{
			label: isExternalFinding(finding)
				? __(
						"External links can't be redirected from this site",
						'vulopilot'
					)
				: __('Create redirect', 'vulopilot'),
			icon: isExternalFinding(finding) ? 'lock' : 'link',
			onClick: () => {
				if (!isExternalFinding(finding)) {
					openRedirectPopup(finding);
				}
			},
		},
		{
			label:
				'resolved' === finding.status
					? __('Reopen', 'vulopilot')
					: __('Mark resolved', 'vulopilot'),
			icon: 'resolved' === finding.status ? 'toggle' : 'check',
			onClick: () =>
				'resolved' === finding.status
					? handleReopen(finding)
					: handleResolve(finding),
		},
		{
			label:
				'ignored' === finding.status
					? __('Unignore', 'vulopilot')
					: __('Ignore', 'vulopilot'),
			icon: 'eye-blocked',
			onClick: () =>
				'ignored' === finding.status
					? handleReopen(finding)
					: handleIgnore(finding),
		},
		{
			label: __('Snooze', 'vulopilot'),
			icon: 'clock',
			onClick: () => handleSnooze(finding),
		},
		{
			label: __('Fix', 'vulopilot'),
			icon: 'tools',
			onClick: () => handleFix(finding),
		},
	];

	// Real client-side "Show ignored" filter + search over the one full
	// fetch this tab already makes (loadFindings(), above) — applied
	// BEFORE grouping by page, so a fully-ignored/filtered-out page
	// disappears from the grouped table entirely rather than showing an
	// empty group.
	const visibleFindings = allFindings
		.filter((finding) => showIgnored || 'ignored' !== finding.status)
		.filter(
			(finding) => 'all' === typeFilter || finding.scanner_id === typeFilter
		)
		.filter((finding) => {
			if ('' === searchTerm.trim()) {
				return true;
			}

			const term = searchTerm.trim().toLowerCase();

			return (
				(finding.page || '').toLowerCase().includes(term) ||
				getBrokenUrl(finding).toLowerCase().includes(term)
			);
		});

	const pageGroups = groupFindingsByPage(visibleFindings);

	const headers = {
		page: {
			label: __('Source page', 'vulopilot'),
			render: (row: BrokenLinkRow) => {
				if (isFindingRow(row)) {
					const url = getBrokenUrl(row);

					return (
						<div className="broken-link-finding-source">
							<span className="broken-link-finding-arrow">↳</span>
							<a href={url} target="_blank" rel="noreferrer">
								{url}
							</a>
						</div>
					);
				}

				const group = row as PageGroupRow;
				const pageUrl = `${appLocalizer.site_url}${group.page}`;

				return (
					<a href={pageUrl} target="_blank" rel="noreferrer">
						{group.page}
					</a>
				);
			},
		},
		status: {
			label: __('Status', 'vulopilot'),
			render: (row: BrokenLinkRow) => {
				if (isFindingRow(row)) {
					const key = deriveStatusKey(row);
					return (
						<BadgeComponent color={statusKeyColor(key)} text={statusKeyLabel(key)} />
					);
				}

				const keys = distinctStatusKeys(
					(row as PageGroupRow).findings.map(deriveStatusKey)
				);

				return (
					<span
						className="broken-link-row-expand-trigger broken-link-status-badges"
						onClick={toggleRowExpansion}
					>
						{keys.map((key) => (
							<BadgeComponent
								key={key}
								color={statusKeyColor(key)}
								text={statusKeyLabel(key)}
							/>
						))}
					</span>
				);
			},
		},
		findings_summary: {
			label: __('Findings', 'vulopilot'),
			render: (row: BrokenLinkRow) => {
				if (isFindingRow(row)) {
					return (
						<span className="broken-link-finding-type">
							{'broken-images' === row.scanner_id
								? __('Image', 'vulopilot')
								: __('Link', 'vulopilot')}
						</span>
					);
				}

				const count = (row as PageGroupRow).findings.length;

				return (
					<span
						className="broken-link-row-expand-trigger"
						onClick={toggleRowExpansion}
					>
						{sprintf(
							/* translators: %d: number of broken links/images found on this page. */
							_n('%d broken', '%d broken', count, 'vulopilot'),
							count
						)}
					</span>
				);
			},
		},
		actions: {
			label: __('Actions', 'vulopilot'),
			render: (row: BrokenLinkRow) => {
				if (isFindingRow(row)) {
					return <RowActionsMenu actions={buildFindingActions(row)} />;
				}

				const group = row as PageGroupRow;
				const redirectCandidate = firstRedirectCandidate(group.findings);
				const openFindings = group.findings.filter(
					(finding) => 'open' === finding.status
				);

				const actions: RowAction[] = [
					{
						label: redirectCandidate
							? __('Create redirect', 'vulopilot')
							: __('No redirectable link on this page', 'vulopilot'),
						icon: redirectCandidate ? 'link' : 'lock',
						onClick: () => {
							if (redirectCandidate) {
								openRedirectPopup(redirectCandidate);
							}
						},
					},
					{
						label: openFindings.length
							? __('Ignore all on this page', 'vulopilot')
							: __('Already ignored', 'vulopilot'),
						icon: 'eye-blocked',
						onClick: () => handleBulkIgnore(group.findings),
					},
				];

				return <RowActionsMenu actions={actions} />;
			},
		},
	};

	const tableRows: BrokenLinkRow[] = pageGroups.map((group) => ({
		...group,
		variation: group.findings.map((finding) => ({
			...finding,
			isFinding: true as const,
		})),
	}));

	return (
		<>
			<ColumnComponent>
					<NoticeComponent
						// type="banner"
						displayPosition="inline"
						message={sprintf(
							'<strong>%1$s</strong> %2$s',
							__('In plain English:', 'vulopilot'),
							__(
								'These are real links and images on your published pages that pointed somewhere broken the last time this site checked them.',
								'vulopilot'
							)
						)}
					/>

					{!isSeoModuleActive() ? (
						<CardComponent title={__('Broken Links', 'vulopilot')}>
							<ModuleGuardComponent
								icon="error"
								title={__('SEO module is turned off', 'vulopilot')}
								desc={__(
									'Turn the SEO module back on from Settings → Modules to resume broken-link/image scanning and see findings again here. Findings already found before it was turned off aren’t deleted — they still show up on the Health page, which lists every category.',
									'vulopilot'
								)}
							/>
						</CardComponent>
					) : (
						<>
							<CardComponent
								title={__('Need attention', 'vulopilot')}
								titleIcon="error"
								isLoading={isLoadingFindings}
							>
								<div className="kg-glance-grid">
									<div className="kg-glance-item">
										<div className="kg-glance-icon">
											<i className="adminfont-link" />
										</div>
										<div>
											<div className="kg-glance-label">
												{__('Broken links', 'vulopilot')}
											</div>
											<div className="kg-glance-value">
												{summary.brokenLinks}
											</div>
										</div>
									</div>
									<div className="kg-glance-item">
										<div className="kg-glance-icon">
											<i className="adminfont-attachment" />
										</div>
										<div>
											<div className="kg-glance-label">
												{__('Broken images', 'vulopilot')}
											</div>
											<div className="kg-glance-value">
												{summary.brokenImages}
											</div>
										</div>
									</div>
									<div className="kg-glance-item">
										<div className="kg-glance-icon">
											<i className="adminfont-info" />
										</div>
										<div>
											<div className="kg-glance-label">
												{__('Couldn’t verify', 'vulopilot')}
											</div>
											<div className="kg-glance-value">
												{summary.couldntVerify}
											</div>
										</div>
									</div>
									<div className="kg-glance-item">
										<div className="kg-glance-icon">
											<i className="adminfont-eye-blocked" />
										</div>
										<div>
											<div className="kg-glance-label">
												{__('Ignored', 'vulopilot')}
											</div>
											<div className="kg-glance-value">
												{summary.ignored}
											</div>
										</div>
									</div>
								</div>
								{!isLoadingFindings && 0 === needAttentionTotal && (
									<p className="desc">
										{__(
											'Nothing needs attention right now.',
											'vulopilot'
										)}
									</p>
								)}
							</CardComponent>

							{stats && (
								<CardComponent
									title={__('Last scan', 'vulopilot')}
									titleIcon="search"
									desc={__(
										'Real coverage from each scanner’s most recent genuine run — a separate real number from "Need attention" above, not a percentage blended from the two (they cover different time windows).',
										'vulopilot'
									)}
								>
									<div className="kg-glance-grid">
										<div className="kg-glance-item">
											<div className="kg-glance-icon">
												<i className="adminfont-link" />
											</div>
											<div>
												<div className="kg-glance-label">
													{__('Links checked', 'vulopilot')}
												</div>
												<div className="kg-glance-value">
													{sprintf(
														/* translators: 1: healthy count, 2: total checked */
														__('%1$d / %2$d healthy', 'vulopilot'),
														stats.links.healthy_count,
														stats.links.links_checked
													)}
												</div>
												<div className="desc">
													{sprintf(
														/* translators: 1: pages scanned, 2: formatted date/"Never run yet" */
														__('Across %1$d pages · %2$s', 'vulopilot'),
														stats.links.pages_scanned,
														formatCheckedAt(stats.links.checked_at)
													)}
												</div>
											</div>
										</div>
										<div className="kg-glance-item">
											<div className="kg-glance-icon">
												<i className="adminfont-attachment" />
											</div>
											<div>
												<div className="kg-glance-label">
													{__('Images checked', 'vulopilot')}
												</div>
												<div className="kg-glance-value">
													{sprintf(
														/* translators: 1: healthy count, 2: total checked */
														__('%1$d / %2$d healthy', 'vulopilot'),
														stats.images.healthy_count,
														stats.images.links_checked
													)}
												</div>
												<div className="desc">
													{sprintf(
														/* translators: 1: pages scanned, 2: formatted date/"Never run yet" */
														__('Across %1$d pages · %2$s', 'vulopilot'),
														stats.images.pages_scanned,
														formatCheckedAt(stats.images.checked_at)
													)}
												</div>
											</div>
										</div>
									</div>
								</CardComponent>
							)}

							<CardComponent
								title={__('Broken Link Monitoring', 'vulopilot')}
								titleIcon="link"
								desc={__(
									'Real links and images found on your published posts/pages that returned a broken (non-2xx/3xx) response the last time they were checked, grouped by the page they live on. Use the "Run scan" button above to check again.',
									'vulopilot'
								)}
								action={
									<div className="broken-link-monitoring-actions">
										<TextInput
											name="broken_link_search"
											placeholder={__(
												'Search by URL or source page…',
												'vulopilot'
											)}
											value={searchTerm}
											onChange={(value) =>
												setSearchTerm(value as string)
											}
										/>
										<SelectInput
											name="broken_link_type_filter"
											value={typeFilter}
											options={[
												{ label: __('All issues', 'vulopilot'), value: 'all' },
												{ label: __('Links', 'vulopilot'), value: 'broken-links' },
												{ label: __('Images', 'vulopilot'), value: 'broken-images' },
											]}
											onChange={(value) =>
												setTypeFilter(
													value as 'all' | 'broken-links' | 'broken-images'
												)
											}
											size="10rem"
										/>
										<ToggleInput
											options={[
												{
													key: 'show_ignored',
													value: 'show_ignored',
													label: __('Show ignored', 'vulopilot'),
												},
											]}
											value={showIgnored ? ['show_ignored'] : []}
											multiSelect
											modules={[]}
											onChange={() =>
												setShowIgnored((current) => !current)
											}
										/>
										<ButtonInput
											buttons={{
												text: __('Export CSV', 'vulopilot'),
												icon: 'export',
												color: 'plain',
												onClick: handleExportCsv,
											}}
										/>
									</div>
								}
							>
								{findingsError ? (
									<ModuleGuardComponent
										icon="error"
										title={__('Could not load findings', 'vulopilot')}
										desc={findingsError}
										buttonText={__('Retry', 'vulopilot')}
										onButtonClick={loadFindings}
									/>
								) : (
									<TableCard
										showMenu={false}
										expandable
										className="transparent-table broken-link-monitoring-table"
										headers={headers}
										rows={tableRows}
										ids={pageGroups.map((group) => group.id)}
										totalRows={pageGroups.length}
										isLoading={isLoadingFindings}
										emptyMessage={__(
											'No broken links or images found yet. Make sure "Flag broken links"/"Flag broken images" are turned on under Settings → Scanning → SEO, then run a scan.',
											'vulopilot'
										)}
									/>
								)}
							</CardComponent>
						</>
				)}
			</ColumnComponent>

			<PopupComponent
				open={!!redirectFinding}
				onClose={closeRedirectPopup}
				width={28}
				height="auto"
				position="lightbox"
				header={{ title: __('Create redirect', 'vulopilot') }}
			>
				<div className="broken-link-redirect-form">
					<p className="desc">
						{__(
							'Redirect this broken URL to a working destination.',
							'vulopilot'
						)}
					</p>
					<TextInput
						name="redirect_source_path"
						inputLabel={__('From (path)', 'vulopilot')}
						value={redirectSourcePath}
						disabled
						onChange={() => {}}
					/>
					<p className="desc broken-link-redirect-note">
						{__(
							'Auto-generated from the broken URL. Edit or fine-tune it afterward from the Redirects tab if you need something more specific.',
							'vulopilot'
						)}
					</p>
					<TextInput
						name="redirect_target_url"
						inputLabel={__('To', 'vulopilot')}
						placeholder="https://example.com/new-page/"
						value={redirectTargetUrl}
						onChange={(value) => setRedirectTargetUrl(value as string)}
					/>
					<SelectInput
						name="redirect_type"
						value={redirectType}
						options={[
							{ label: __('301 (Permanent)', 'vulopilot'), value: '301' },
							{ label: __('302 (Temporary)', 'vulopilot'), value: '302' },
						]}
						onChange={(value) => setRedirectType(value as string)}
						size="12rem"
					/>
					<div className="broken-link-redirect-actions">
						<ButtonInput
							buttons={{
								text: __('Cancel', 'vulopilot'),
								color: 'plain',
								onClick: closeRedirectPopup,
							}}
						/>
						<ButtonInput
							buttons={{
								text: isSavingRedirect
									? __('Creating…', 'vulopilot')
									: __('Create redirect', 'vulopilot'),
								onClick: handleCreateRedirect,
								disabled:
									isSavingRedirect || '' === redirectTargetUrl.trim(),
							}}
						/>
					</div>
				</div>
			</PopupComponent>

			<PopupComponent
				open={isProPopupOpen}
				onClose={() => setIsProPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{appLocalizer.khali_dabba ? (
					<ShowProPopup moduleName="one-click-fix" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</>
	);
};

export default BrokenLinksSection;
