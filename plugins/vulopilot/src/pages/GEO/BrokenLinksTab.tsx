/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
	NoticeComponent,
	NoticeManager,
	PopupComponent,
} from '@zyra/components';
import { ButtonInput, SelectInput, TextInput, ToggleInput } from '@zyra/inputs';
import { TableCard } from '@zyra/table';
import { useFindingsTable, Finding } from '../../services/useFindingsTable';
import { formatWpDate } from '../../services/formatWpDate';
import ShowProPopup from '../../components/Popup/Popup';
import './GrowMyTraffic.scss';

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/** Scanners\Basic\BrokenLinksScanner + Scanners\Basic\BrokenImagesScanner — this tab's own two real data sources. */
const BROKEN_SCANNER_IDS = ['broken-links', 'broken-images'];

/**
 * `GET /findings` is a real `SELECT *` (AbstractRepository::find_all()),
 * so every row already carries the raw `meta`/`scanner_id` DB columns
 * even though the shared `Finding` type (useFindingsTable.tsx) doesn't
 * declare them — no other consumer of that hook has needed either
 * before; this tab is the first (it now spans two scanner ids in one
 * table, and needs the real broken URL for the redirect popup).
 */
interface BrokenLinkFinding extends Finding {
	meta?: string;
	scanner_id?: string;
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

interface RawBrokenFinding {
	id: number;
	scanner_id: string;
	status: 'open' | 'resolved' | 'ignored' | 'snoozed';
	meta?: string;
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
 * label/icon/onClick, see the `actions` array below) instead of only
 * rejecting the click after the fact, since RedirectManager.php can
 * never intercept a request that never reaches this site in the first
 * place.
 */
const isExternalFinding = (finding: BrokenLinkFinding): boolean =>
	!deriveSourcePath(getBrokenUrl(finding));

/**
 * Real, client-side CSV built straight from whatever rows are actually
 * loaded/selected in the table — no server endpoint exists for this, and
 * none is needed: every field here already came back from `GET /findings`.
 */
const downloadBrokenLinksCsv = (rows: BrokenLinkFinding[]) => {
	const header = [
		__('Source page', 'vulopilot'),
		__('Broken URL', 'vulopilot'),
		__('Type', 'vulopilot'),
		__('Status', 'vulopilot'),
		__('Detected', 'vulopilot'),
	];
	const lines = rows.map((row) =>
		[
			row.page ?? '',
			getBrokenUrl(row),
			'broken-images' === row.scanner_id
				? __('Image', 'vulopilot')
				: __('Link', 'vulopilot'),
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
 * real "Ignored" tile needs `status === 'ignored'` rows too, which an
 * `open`-only fetch would hide). Feeds only the stat tiles below, not the
 * table itself — the table keeps its own independently paginated fetch
 * via useFindingsTable.
 */
const fetchAllBrokenFindings = async (): Promise<RawBrokenFinding[]> => {
	const scannerParam = BROKEN_SCANNER_IDS.join(',');
	let page = 1;
	let all: RawBrokenFinding[] = [];

	// eslint-disable-next-line no-constant-condition
	while (true) {
		const response = await getApiResponse<{
			data: RawBrokenFinding[];
			total: number;
		}>(
			getApiLink(
				appLocalizer,
				`findings?scanner_id=${scannerParam}&per_page=${FINDINGS_PAGE_SIZE}&page=${page}&orderby=id&order=desc`
			),
			nonceHeaders
		);

		if (!response) {
			break;
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
	findings: RawBrokenFinding[]
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
 * "Broken Links" tab of "Grow My Traffic" — real, scanned results from
 * Scanners\Basic\BrokenLinksScanner AND BrokenImagesScanner
 * (`scanner_id: 'broken-links'|'broken-images'`), the same
 * `vulopilot_scan_findings` rows the SEO tab's own "Links & schema"
 * section already includes for broken links, filtered down to just these
 * two scanners here via `useFindingsTable`'s own `scannerIds` prop
 * rather than a second, hand-built fetch — same real hook/table
 * CrawlerTrafficTab.tsx's own "Blocked pages" card and every other
 * findings-backed tab in this codebase already use.
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
 * groups without fabricating anything:
 *   - "Need attention" (Broken links/Broken images/Couldn't verify) and
 *     "Ignored" come from `fetchAllBrokenFindings()` + `summarizeBrokenFindings()`
 *     below — a real, bounded fetch of every current finding row,
 *     bucketed by its own real `status` and the real `meta.reason`
 *     ('broken' vs 'unverified' — see BrokenLinksScanner::check_link()'s
 *     own docblock) each scanner now persists.
 *   - "Last scan" comes from `GET /broken-links/stats`
 *     (Controllers\BrokenLinksStats), reading each scanner's own real
 *     per-run coverage stats (BrokenLinksScanner::STATS_OPTION /
 *     BrokenImagesScanner::STATS_OPTION) — pages scanned, links/images
 *     checked, and how many were healthy, as of THAT scanner's most
 *     recent genuine run.
 * Deliberately NOT blended into one combined "X% healthy" figure: the
 * "Need attention" counts are a cumulative, all-time view of currently
 * open findings, while "Last scan" reflects only the single most recent
 * run — dividing one by the other would silently mix two different time
 * windows into a number that looks precise but isn't actually coherent.
 * Shown side by side instead, each honestly labeled for what it actually
 * is.
 *
 * "Show ignored" is a real, functional toggle — client-side hides/shows
 * `status === 'ignored'` rows from whatever page the table's own real
 * fetch already loaded (TableCard's own built-in status pill bar is
 * suppressed here in favor of this single control, matching the
 * reference mockup's own simpler toggle rather than a 4-way status
 * switcher).
 *
 * "Create redirect" (added to the shared hook's own row-action list,
 * alongside Resolve/Ignore/Reopen/Snooze/Fix) opens a real popup and, on
 * submit, calls the exact same `POST /redirects` RedirectsTab.tsx's own
 * "Add redirect" form uses — genuinely inserts into `vulopilot_redirects`,
 * not a mock. The popup's "From" field is auto-derived from the broken
 * URL itself (deriveSourcePath, above) and disabled — this system matches
 * redirects by an exact literal path (RedirectManager.php), not a regex,
 * so unlike a regex-pattern-style reference UI this field is a real path,
 * not a pattern the backend would never actually evaluate as one.
 *
 * For a finding whose broken URL is on a different site entirely
 * (isExternalFinding, above), this same action's label swaps to an
 * explanation and its onClick becomes a no-op instead of opening the
 * popup — RedirectManager.php can only ever intercept a request that
 * actually reaches this site, so a redirect "from" someone else's domain
 * would never fire. TableRowActions.tsx (zyra) always renders an action's
 * `label` as that action's own hover tooltip (inline icons) or the text
 * next to it (the "more" dropdown, once there are more than 2 actions,
 * which is always true here) — there's no separate disabled/tooltip prop
 * to hook into upstream, so swapping label+icon+onClick together based on
 * the row is what actually surfaces the explanation without a zyra change.
 *
 * Not built: the reference mockup's page-grouped table (one row per
 * source page, aggregating "1 page issue + 3 broken" style counts). This
 * tab keeps the existing flat one-row-per-finding table instead — a
 * separate, larger UI restructuring, not attempted alongside everything
 * else here.
 */
const BrokenLinksTab = () => {
	const {
		tableCardProps,
		error,
		refetch,
		isProPopupOpen,
		closeProPopup,
	} = useFindingsTable({
		scannerIds: BROKEN_SCANNER_IDS,
		description: __(
			'No broken links or images found yet. Make sure "Flag broken links"/"Flag broken images" are turned on under Settings → Scanning → SEO, then run a scan.',
			'vulopilot'
		),
	});

	const [summary, setSummary] = useState<BrokenFindingsSummary>(EMPTY_SUMMARY);
	const [isSummaryLoading, setIsSummaryLoading] = useState(true);
	const [stats, setStats] = useState<BrokenLinksStatsResponse | null>(null);
	const [showIgnored, setShowIgnored] = useState(false);

	const [redirectFinding, setRedirectFinding] =
		useState<BrokenLinkFinding | null>(null);
	const [redirectSourcePath, setRedirectSourcePath] = useState('');
	const [redirectTargetUrl, setRedirectTargetUrl] = useState('');
	const [redirectType, setRedirectType] = useState('301');
	const [isSavingRedirect, setIsSavingRedirect] = useState(false);

	const loadSummary = () => {
		setIsSummaryLoading(true);

		fetchAllBrokenFindings()
			.then((findings) => setSummary(summarizeBrokenFindings(findings)))
			.catch(() => setSummary(EMPTY_SUMMARY))
			.finally(() => setIsSummaryLoading(false));
	};

	useEffect(() => {
		loadSummary();

		getApiResponse<BrokenLinksStatsResponse>(
			getApiLink(appLocalizer, 'broken-links/stats'),
			nonceHeaders
		).then((response) => response && setStats(response));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

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
					// perspective now that a real redirect exists —
					// same real `POST /findings/{id}` status-update call
					// the shared hook's own "Mark resolved" row action
					// already makes.
					sendApiResponse(
						appLocalizer,
						getApiLink(appLocalizer, `findings/${redirectFinding.id}`),
						{ status: 'resolved' }
					).then(() => {
						refetch();
						loadSummary();
					});

					closeRedirectPopup();
				}
			})
			.finally(() => setIsSavingRedirect(false));
	};

	const handleExportCsv = (selectedIds: number[]) => {
		const rows = tableCardProps.rows as BrokenLinkFinding[];
		const scoped = selectedIds.length
			? rows.filter((row) => selectedIds.includes(row.id))
			: rows;

		if (!scoped.length) {
			NoticeManager.add({
				uniqueKey: 'broken-link-export-empty',
				type: 'error',
				position: 'float',
				message: __('Nothing to export.', 'vulopilot'),
			});
			return;
		}

		downloadBrokenLinksCsv(scoped);
	};

	const existingActions =
		(tableCardProps.headers as Record<string, any>).actions?.actions ?? [];

	const headers = {
		...tableCardProps.headers,
		actions: {
			...(tableCardProps.headers as Record<string, any>).actions,
			actions: [
				{
					// Both the label (also this action's hover/dropdown
					// tooltip text — TableRowActions.tsx renders it as
					// that regardless of which of the two row-action
					// layouts is in play) and the icon flip for an
					// external row, so hovering the disabled action
					// explains why instead of only rejecting the click
					// after the fact.
					label: (row?: Record<string, unknown>) =>
						row && isExternalFinding(row as BrokenLinkFinding)
							? __(
									"External links can't be redirected from this site",
									'vulopilot'
								)
							: __('Create redirect', 'vulopilot'),
					icon: (row?: Record<string, unknown>) =>
						row && isExternalFinding(row as BrokenLinkFinding)
							? 'lock'
							: 'link',
					onClick: (row?: Record<string, unknown>) => {
						if (!row || isExternalFinding(row as BrokenLinkFinding)) {
							return;
						}

						openRedirectPopup(row as BrokenLinkFinding);
					},
				},
				...existingActions,
			],
		},
	};

	// Real client-side "Show ignored" filter over whatever page of real
	// rows the table's own fetch already loaded — see this component's
	// own docblock for why TableCard's built-in status pill bar
	// (categoryCounts) is suppressed below in favor of this one toggle.
	const allRows = tableCardProps.rows as BrokenLinkFinding[];
	const visibleRows = showIgnored
		? allRows
		: allRows.filter((row) => 'ignored' !== row.status);

	const needAttentionTotal =
		summary.brokenLinks + summary.brokenImages + summary.couldntVerify;

	return (
		<>
			<ContainerComponent general>
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
								isLoading={isSummaryLoading}
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
								{!isSummaryLoading && 0 === needAttentionTotal && (
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
									'Real links and images found on your published posts/pages that returned a broken (non-2xx/3xx) response the last time they were checked. Use the "Run scan" button above to check again.',
									'vulopilot'
								)}
								action={
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
								}
							>
								{error ? (
									<ModuleGuardComponent
										icon="error"
										title={__('Could not load findings', 'vulopilot')}
										desc={error}
										buttonText={__('Retry', 'vulopilot')}
										onButtonClick={refetch}
									/>
								) : (
									<TableCard
										{...tableCardProps}
										headers={headers}
										rows={visibleRows}
										ids={visibleRows.map((row) => row.id)}
										categoryCounts={[]}
										onSelectCsvDownloadApply={handleExportCsv}
									/>
								)}
							</CardComponent>
						</>
					)}
				</ColumnComponent>
			</ContainerComponent>

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
				onClose={closeProPopup}
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

export default BrokenLinksTab;
