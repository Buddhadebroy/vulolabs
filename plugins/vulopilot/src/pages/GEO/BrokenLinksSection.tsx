/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	BadgeComponent,
	CardComponent,
	ColumnComponent,
	MetricTileComponent,
	ModuleGuardComponent,
	NoticeManager,
	PopupComponent,
	TooltipComponent,
} from '@zyra/components';
import { ButtonInput, SelectInput, TextInput } from '@zyra/inputs';
import { TableCard } from '@zyra/table';
import { Finding, getFindingFixHandler } from '../../services/useFindingsTable';
import { formatWpDate } from '../../services/formatWpDate';
import { RowAction, RowActionsMenu } from './seoIssuesShared';
import ShowProPopup from '../../components/Popup/Popup';
import './SeoVisibility.scss';

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/** Scanners\Basic\BrokenLinksScanner + Scanners\Basic\BrokenImagesScanner — this tab's own two real data sources. */
const BROKEN_SCANNER_IDS = ['broken-links', 'broken-images'];

/**
 * `GET /findings` is a real `SELECT *` (AbstractRepository::find_all()),
 * so every row already carries the raw `meta`/`scanner_id`/`object_ref`/
 * `last_seen_at` DB columns even though the shared `Finding` type
 * (useFindingsTable.tsx) only declares the fields every OTHER
 * findings-backed tab has needed so far. `object_ref` is a single real
 * post id string for both these scanners (never the comma-joined list
 * DuplicateContentScanner's own multi-page findings use — see each
 * scanner's own `scan()`). `last_seen_at` is real, distinct from
 * `created_at`: ScanPersistenceListener bumps it every time a rescan
 * still finds the same broken URL, while `created_at` stays frozen at
 * first detection — the "First Found"/"Last Checked" columns below read
 * these two real columns directly, nothing derived/fabricated.
 */
interface BrokenLinkFinding extends Finding {
	meta?: string;
	scanner_id?: string;
	object_ref?: string;
	last_seen_at?: string;
}

interface RunStats {
	pages_scanned: number;
	links_checked: number;
	healthy_count: number;
	checked_at: number | null;
}

/** `ScanRepository::get_latest_completed()` — the most recent genuinely-finished run of either scanner, real `vulopilot_scans` columns. Null when neither has ever completed one. */
interface LastRunStats {
	duration_ms: number;
	finished_at: number;
}

interface BrokenLinksStatsResponse {
	links: RunStats;
	images: RunStats;
	last_run: LastRunStats | null;
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
 * i.e. deriveSourcePath() above returns null for it. Backs both the
 * "Link Type" column (Internal/External) and the "Create redirect"
 * action's disabled state: RedirectManager.php can never intercept a
 * request that never reaches this site in the first place.
 */
const isExternalFinding = (finding: BrokenLinkFinding): boolean =>
	!deriveSourcePath(getBrokenUrl(finding));

/** Real HTTP reason phrases for the status codes these two scanners actually see in practice — anything not listed here still shows the real numeric code alone rather than a guessed phrase. */
const HTTP_STATUS_PHRASES: Record<string, string> = {
	'400': __('Bad Request', 'vulopilot'),
	'401': __('Unauthorized', 'vulopilot'),
	'403': __('Forbidden', 'vulopilot'),
	'404': __('Not Found', 'vulopilot'),
	'410': __('Gone', 'vulopilot'),
	'429': __('Too Many Requests', 'vulopilot'),
	'500': __('Internal Server Error', 'vulopilot'),
	'502': __('Bad Gateway', 'vulopilot'),
	'503': __('Service Unavailable', 'vulopilot'),
	'504': __('Gateway Timeout', 'vulopilot'),
};

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
 * actually detect — a "Soft 404" or a redirect "Chain" would need
 * following redirects and inspecting the destination page's own content/
 * status, which check_link()/check_image() don't do (a single HEAD
 * request; wp_remote_head() already follows up to 5 redirects
 * transparently, so this code never even sees an intermediate hop).
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

/** Human label for a deriveStatusKey() result — a real numeric HTTP code gets its real reason phrase appended when known (HTTP_STATUS_PHRASES); otherwise the code is shown alone rather than guessing. */
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
			return HTTP_STATUS_PHRASES[key]
				? `${key} ${HTTP_STATUS_PHRASES[key]}`
				: key; // a real numeric HTTP status code with no known phrase
	}
};

/** A confirmed HTTP error or DNS failure reads as more severe (red) than an unverified/timed-out check this scanner just couldn't confirm either way (yellow), same distinction the "Broken" vs "Couldn't verify" stat tiles above already draw. */
const statusKeyColor = (key: string): string =>
	/^\d+$/.test(key) || 'dns' === key ? 'red' : 'yellow';

/** mm:ss (or hh:mm:ss past an hour) — real `vulopilot_scans.duration_ms` for the scan's own "Last scan completed" banner. */
const formatDurationMs = (ms: number): string => {
	const totalSeconds = Math.max(0, Math.round(ms / 1000));
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	const pad = (value: number) => String(value).padStart(2, '0');

	return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

/**
 * Real, client-side CSV built straight from whatever findings currently
 * pass every active filter (search/issue/link-type/page/status) — not
 * just one page's worth, since the endpoint itself returns every
 * matching row unpaginated and this tab slices client-side.
 */
const downloadBrokenLinksCsv = (rows: BrokenLinkFinding[]) => {
	const header = [
		__('Source page', 'vulopilot'),
		__('Target URL', 'vulopilot'),
		__('Type', 'vulopilot'),
		__('Link type', 'vulopilot'),
		__('Status', 'vulopilot'),
		__('Finding status', 'vulopilot'),
		__('First found', 'vulopilot'),
		__('Last checked', 'vulopilot'),
	];
	const lines = rows.map((row) =>
		[
			row.page ?? '',
			getBrokenUrl(row),
			'broken-images' === row.scanner_id
				? __('Image', 'vulopilot')
				: __('Link', 'vulopilot'),
			isExternalFinding(row)
				? __('External', 'vulopilot')
				: __('Internal', 'vulopilot'),
			statusKeyLabel(deriveStatusKey(row)),
			row.status,
			row.created_at,
			row.last_seen_at ?? row.created_at,
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
/** This table's own client-side page size (rows already fetched in full above; TableCard's footer/page-size selector just slices them, same pattern PagesNeedingAttentionTable.tsx/SlowPagesTab.tsx use). */
const DEFAULT_PER_PAGE = 10;

/**
 * Fetches every real broken-link/broken-image finding, any status —
 * bounded pagination loop, same real shape seoIssuesShared.tsx's own
 * fetchAllOpenSeoFindings uses, just not status-filtered up front (the
 * stat tiles AND the "All status" filter both need `status === 'ignored'`/
 * `'resolved'` rows too, which an `open`-only fetch would hide).
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

/**
 * Collapses duplicate findings for the exact same broken URL on the exact
 * same page/scanner/status down to just the newest one — a scan re-run
 * that finds a link is STILL broken now bumps that same row's own
 * `last_seen_at` (ScanPersistenceListener's dedup-on-rescan) rather than
 * inserting a fresh one, but this still cleans up any legacy duplicate
 * rows created before that fix shipped. Scoped to (scanner_id,
 * object_ref, url, status) rather than just (scanner_id, object_ref,
 * url) — an old *resolved* finding and a newly-detected *open* one for
 * the same URL are two genuinely different, both-worth-showing rows, not
 * a duplicate. Relies on `findings` already being newest-first
 * (`orderby=id&order=desc`), so the first occurrence of a key is already
 * the most recent one.
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

type IssueFilter = 'all' | 'broken-links' | 'broken-images' | 'unverified';
type LinkTypeFilter = 'all' | 'internal' | 'external';
type StatusFilter = 'all' | 'open' | 'resolved' | 'ignored' | 'snoozed';

/**
 * "Broken Links" inner section of the "Crawl & URLs" tab
 * (BrokenLinksSection.tsx): real, scanned results from
 * Scanners\Basic\BrokenLinksScanner AND BrokenImagesScanner
 * (`scanner_id: 'broken-links'|'broken-images'`), the same real
 * `vulopilot_scan_findings` rows other findings tabs read from.
 *
 * Rebuilt to match the reference mockup 1:1 wherever the underlying data
 * genuinely supports it (see this repo's own investigation before this
 * pass — `classes/Install.php`'s `vulopilot_scan_findings`/`vulopilot_scans`
 * schemas):
 *   - 4 standalone stat tiles (Broken links/Broken images/Couldn't
 *     verify/Ignored) — real counts from summarizeBrokenFindings(), no
 *     fabricated "since last scan" delta (STATS_OPTION is overwritten,
 *     not accumulated, each run — there is no real previous-run snapshot
 *     to diff against).
 *   - A real "Last scan completed" banner: `vulopilot_scans.duration_ms`/
 *     `finished_at` for the latest genuinely-completed run of either
 *     scanner (ScanRepository::get_latest_completed(), added alongside
 *     this pass — BrokenLinksStats controller didn't expose this before).
 *   - A flat table, one row per real finding (no page-grouping) —
 *     Source page / Status / Link Type (Internal/External,
 *     isExternalFinding) / Target URL (`meta.url`) / First Found
 *     (`created_at`) / Last Checked (`last_seen_at`, a real, distinct,
 *     rescan-refreshed column — confirmed via ScanPersistenceListener,
 *     not derived/guessed) / Actions.
 *   - Real "All issues"/"All link types"/"All pages"/"All status"
 *     filters alongside search + Export CSV, all client-side over the one
 *     full fetch this tab already makes (fetchAllBrokenFindings()).
 *
 * Two things the mockup shows that this deliberately does NOT reproduce,
 * because there's no real data behind them: a numeric "+N since last
 * scan" delta on the stat tiles (see above), and "Soft 404"/"Chain"
 * status pills (would need following redirect chains and inspecting the
 * destination's own content/status, which neither scanner does).
 *
 * "Fix" reuses useFindingsTable.tsx's own exported getFindingFixHandler()
 * — same real Pro-gating (vulopilot-pro's OneClickFix module registers
 * the real handler; Free shows the Pro popup when it isn't active) other
 * findings tables get from that hook.
 */
const BrokenLinksSection = () => {
	const [allFindings, setAllFindings] = useState<BrokenLinkFinding[]>([]);
	const [isLoadingFindings, setIsLoadingFindings] = useState(true);
	const [findingsError, setFindingsError] = useState<string | null>(null);
	const [stats, setStats] = useState<BrokenLinksStatsResponse | null>(null);
	const [searchTerm, setSearchTerm] = useState('');
	const [issueFilter, setIssueFilter] = useState<IssueFilter>('all');
	const [linkTypeFilter, setLinkTypeFilter] = useState<LinkTypeFilter>('all');
	const [pageFilter, setPageFilter] = useState('all');
	const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
	const [paged, setPaged] = useState(1);
	const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);
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

	// Any filter/search change can shrink the result set below the
	// currently-viewed page — reset to page 1 rather than showing an
	// empty table stuck on e.g. page 3.
	useEffect(() => {
		setPaged(1);
	}, [searchTerm, issueFilter, linkTypeFilter, pageFilter, statusFilter]);

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

	// Real client-side filters over the one full fetch this tab already
	// makes (loadFindings(), above) — search/issue/link-type/page/status
	// all compose, matching the mockup's own toolbar of independent
	// dropdowns.
	const visibleFindings = allFindings
		.filter((finding) => 'all' === statusFilter || finding.status === statusFilter)
		.filter((finding) => {
			if ('all' === issueFilter) {
				return true;
			}

			if ('unverified' === issueFilter) {
				return 'unverified' === getFindingMeta(finding).reason;
			}

			return (
				finding.scanner_id === issueFilter &&
				'unverified' !== getFindingMeta(finding).reason
			);
		})
		.filter((finding) => {
			if ('all' === linkTypeFilter) {
				return true;
			}

			return (
				('external' === linkTypeFilter) === isExternalFinding(finding)
			);
		})
		.filter((finding) => 'all' === pageFilter || finding.page === pageFilter)
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

	const pageOptions = Array.from(
		new Set(allFindings.map((finding) => finding.page).filter(Boolean))
	) as string[];

	const pageRows = visibleFindings.slice(
		(paged - 1) * perPage,
		paged * perPage
	);

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

	const buildFindingMoreActions = (finding: BrokenLinkFinding): RowAction[] => [
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

	const headers = {
		page: {
			label: __('Source page', 'vulopilot'),
			render: (row: BrokenLinkFinding) => {
				const pageUrl = `${appLocalizer.site_url}${row.page}`;

				return (
					<div className="broken-link-source-cell">
						<i
							className={`adminfont-${'broken-images' === row.scanner_id ? 'attachment' : 'link'} broken-link-source-icon`}
						/>
						<a href={pageUrl} target="_blank" rel="noreferrer">
							{row.page}
						</a>
					</div>
				);
			},
		},
		status: {
			label: __('Status', 'vulopilot'),
			render: (row: BrokenLinkFinding) => {
				const key = deriveStatusKey(row);
				return (
					<BadgeComponent
						color={statusKeyColor(key)}
						text={statusKeyLabel(key)}
					/>
				);
			},
		},
		link_type: {
			label: __('Link Type', 'vulopilot'),
			render: (row: BrokenLinkFinding) => (
				<span
					className={`broken-link-type-pill ${isExternalFinding(row) ? 'is-external' : 'is-internal'}`}
				>
					{isExternalFinding(row)
						? __('External', 'vulopilot')
						: __('Internal', 'vulopilot')}
				</span>
			),
		},
		target_url: {
			label: __('Target URL', 'vulopilot'),
			render: (row: BrokenLinkFinding) => {
				const url = getBrokenUrl(row);

				return (
					<a
						href={url}
						target="_blank"
						rel="noreferrer"
						className="broken-link-target-url"
						title={url}
					>
						{url}
					</a>
				);
			},
		},
		first_found: {
			label: __('First Found', 'vulopilot'),
			render: (row: BrokenLinkFinding) => (
				<span className="typography-body-xs">
					{formatWpDate(row.created_at)}
				</span>
			),
		},
		last_checked: {
			label: __('Last Checked', 'vulopilot'),
			render: (row: BrokenLinkFinding) => (
				<span className="typography-body-xs">
					{formatWpDate(row.last_seen_at || row.created_at)}
				</span>
			),
		},
		actions: {
			label: __('Actions', 'vulopilot'),
			render: (row: BrokenLinkFinding) => {
				const url = getBrokenUrl(row);
				const external = isExternalFinding(row);

				return (
					<div className="broken-link-row-actions">
						<TooltipComponent text={__('Open URL', 'vulopilot')}>
							<button
								type="button"
								className="broken-link-icon-btn"
								onClick={() =>
									window.open(url, '_blank', 'noopener,noreferrer')
								}
							>
								<i className="adminfont-eye" />
							</button>
						</TooltipComponent>
						<TooltipComponent
							text={
								external
									? __(
										"External links can't be redirected from this site",
										'vulopilot'
									)
									: __('Create redirect', 'vulopilot')
							}
						>
							<button
								type="button"
								className="broken-link-icon-btn"
								disabled={external}
								onClick={() => openRedirectPopup(row)}
							>
								<i className="adminfont-link" />
							</button>
						</TooltipComponent>
						<RowActionsMenu actions={buildFindingMoreActions(row)} />
					</div>
				);
			},
		},
	};

	return (
		<>
			<ColumnComponent>
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
						<MetricTileComponent
							cols={4}
							isLoading={isLoadingFindings}
							data={[
								{
									id: 'broken-links',
									icon: 'link',
									iconColor: '#dc2626',
									title: __('Broken Links', 'vulopilot'),
									number: (
										<span className="broken-link-stat-value">
											{summary.brokenLinks}
										</span>
									),
									desc: __('Currently open — needs attention', 'vulopilot'),
								},
								{
									id: 'broken-images',
									icon: 'attachment',
									iconColor: '#dc2626',
									title: __('Broken Images', 'vulopilot'),
									number: (
										<span className="broken-link-stat-value">
											{summary.brokenImages}
										</span>
									),
									desc: __('Currently open — needs attention', 'vulopilot'),
								},
								{
									id: 'unverified',
									icon: 'info',
									iconColor: '#b45309',
									title: __("Couldn't Verify", 'vulopilot'),
									number: (
										<span className="broken-link-stat-value is-attention">
											{summary.couldntVerify}
										</span>
									),
									desc: __('Timed out or DNS failed on last check', 'vulopilot'),
								},
								{
									id: 'ignored',
									icon: 'eye-blocked',
									title: __('Ignored', 'vulopilot'),
									number: (
										<span className="broken-link-stat-value is-muted">
											{summary.ignored}
										</span>
									),
									desc: __('Hidden from “needs attention”', 'vulopilot'),
								},
							]}
						/>

						{!isLoadingFindings && 0 === needAttentionTotal && (
							<p className="desc">
								{__('Nothing needs attention right now.', 'vulopilot')}
							</p>
						)}

						<div className="broken-link-scan-summary-row">
							<div className="broken-link-scan-banner">
								<i className="adminfont-yes-alt broken-link-scan-banner-icon" />
								<div>
									<div className="broken-link-scan-banner-title">
										{__('Last scan completed', 'vulopilot')}
									</div>
									<div className="broken-link-scan-banner-meta">
										{stats?.last_run
											? sprintf(
												/* translators: 1: formatted date/time, 2: duration as hh:mm:ss */
												__('%1$s · Duration %2$s', 'vulopilot'),
												formatWpDate(
													new Date(
														stats.last_run.finished_at * 1000
													).toISOString()
												),
												formatDurationMs(stats.last_run.duration_ms)
											)
											: __(
												'No scan has completed yet — use "Run scan" above to start one.',
												'vulopilot'
											)}
									</div>
									{stats && (stats.links.checked_at || stats.images.checked_at) && (
										<div className="broken-link-scan-banner-meta">
											{sprintf(
												/* translators: 1: healthy/total links checked, 2: healthy/total images checked */
												__('%1$d/%2$d links healthy · %3$d/%4$d images healthy', 'vulopilot'),
												stats.links.healthy_count,
												stats.links.links_checked,
												stats.images.healthy_count,
												stats.images.links_checked
											)}
										</div>
									)}
								</div>
							</div>
							<div className="broken-link-why-fix">
								<div className="broken-link-why-fix-title">
									<i className="adminfont-info" />
									{__('Why fix broken links?', 'vulopilot')}
								</div>
								<ul>
									<li>{__('Better user experience', 'vulopilot')}</li>
									<li>{__('Improved SEO rankings', 'vulopilot')}</li>
									<li>{__('More crawlable pages', 'vulopilot')}</li>
								</ul>
							</div>
						</div>

						<CardComponent
							title={__('Broken Link Monitoring', 'vulopilot')}
							titleIcon="link"
							desc={__(
								'Real links and images found on your published posts/pages that returned a broken (non-2xx/3xx) response the last time they were checked. Use the "Run scan" button above to check again.',
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
										name="broken_link_issue_filter"
										value={issueFilter}
										options={[
											{ label: __('All issues', 'vulopilot'), value: 'all' },
											{ label: __('Broken links', 'vulopilot'), value: 'broken-links' },
											{ label: __('Broken images', 'vulopilot'), value: 'broken-images' },
											{ label: __("Couldn't verify", 'vulopilot'), value: 'unverified' },
										]}
										onChange={(value) =>
											setIssueFilter(value as IssueFilter)
										}
										size="10rem"
									/>
									<SelectInput
										name="broken_link_type_filter"
										value={linkTypeFilter}
										options={[
											{ label: __('All link types', 'vulopilot'), value: 'all' },
											{ label: __('Internal', 'vulopilot'), value: 'internal' },
											{ label: __('External', 'vulopilot'), value: 'external' },
										]}
										onChange={(value) =>
											setLinkTypeFilter(value as LinkTypeFilter)
										}
										size="10rem"
									/>
									<SelectInput
										name="broken_link_page_filter"
										value={pageFilter}
										options={[
											{ label: __('All pages', 'vulopilot'), value: 'all' },
											...pageOptions.map((page) => ({
												label: page,
												value: page,
											})),
										]}
										onChange={(value) => setPageFilter(value as string)}
										size="10rem"
									/>
									<SelectInput
										name="broken_link_status_filter"
										value={statusFilter}
										options={[
											{ label: __('All status', 'vulopilot'), value: 'all' },
											{ label: __('Open', 'vulopilot'), value: 'open' },
											{ label: __('Resolved', 'vulopilot'), value: 'resolved' },
											{ label: __('Ignored', 'vulopilot'), value: 'ignored' },
											{ label: __('Snoozed', 'vulopilot'), value: 'snoozed' },
										]}
										onChange={(value) =>
											setStatusFilter(value as StatusFilter)
										}
										size="10rem"
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
									className="transparent-table broken-link-monitoring-table"
									headers={headers}
									rows={pageRows}
									ids={pageRows.map((row) => row.id)}
									totalRows={visibleFindings.length}
									isLoading={isLoadingFindings}
									onQueryUpdate={(query: { paged?: number | string; per_page?: number | string }) => {
										setPaged(Number(query.paged) || 1);
										setPerPage(Number(query.per_page) || DEFAULT_PER_PAGE);
									}}
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
						onChange={() => { }}
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
