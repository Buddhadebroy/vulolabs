/* global appLocalizer */
import React, { useEffect, useMemo, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	CardComponent,
	InformationItemComponent,
	NoticeManager,
	PopupComponent,
	BadgeComponent,
	TooltipComponent,
} from '@zyra/components';
import {
	ButtonInput,
	MultiCheckboxInput,
	SelectInput,
	TextInput,
} from '@zyra/inputs';
import { TableCard } from '@zyra/table';
import ShowProPopup from '../../components/Popup/Popup';

/**
 * `GenerateLandingPageAction::META_KEY`'s literal string — this plugin has
 * no localization pipeline exposing PHP action constants to this page's
 * JS bundle (`PostEditorAssets` only does that for the block editor
 * sidebar), so it's duplicated here as a plain string rather than adding
 * a whole new mechanism for one value. Must stay in sync with that
 * class's own `META_KEY` constant.
 */
const LANDING_PAGE_META_KEY = '_vulopilot_landing_page';

/**
 * The 3 real scanners that flag per-post content-quality findings — same
 * set the now-removed "Content Quality Issues"/"AI Content" tabs already
 * covered (see FindingsTable.tsx's own `Finding` interface and
 * classes/Scanners/Basic/{ThinContent,Readability,HeadingStructure}Scanner.php,
 * all 3 of which write `object_type: 'post', object_ref: (string) $post->ID`
 * — the same id space `ContentRow.id` already uses, so joining on it below
 * needs no extra lookup).
 */
const CONTENT_SCANNER_IDS = ['thin-content', 'readability', 'heading-structure'];

type ContentCategory = 'blog-post' | 'landing-page' | 'product' | 'other';
type Tab = 'all' | ContentCategory;
type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';
type SeverityFilter = 'all' | FindingSeverity;
type FindingStatus = 'open' | 'resolved' | 'ignored' | 'snoozed';

/**
 * One raw row from `GET /findings` — a superset of FindingsTable.tsx's own
 * `Finding` interface: `object_type`/`object_ref` aren't declared there
 * (that component never needs them, `page` is added server-side instead),
 * but they're real columns `FindingRepository::find_all()`'s `SELECT *`
 * already returns, needed here to join a finding back to the post row it
 * belongs to. `fix_action_id` is added by vulopilot-pro's OneClickFix
 * module (see FindingsTable.tsx's own `getFindingFixHandler` docblock) —
 * absent/null when Pro isn't active or this finding's scanner has no
 * mapped fix.
 */
interface RawFinding {
	id: number;
	title: string;
	severity: FindingSeverity;
	status: FindingStatus;
	scanner_id: string;
	object_type: string;
	object_ref: string;
	fix_action_id?: string | null;
}

interface FindingsResponse {
	data: RawFinding[];
	total: number;
}

interface ContentRow {
	id: number;
	category: ContentCategory;
	title: string;
	status: string;
	date: string;
	wordCount: number;
	editLink: string;
	viewLink: string | null;
	findings: RawFinding[];
}

interface WpRestPost {
	id: number;
	title: { rendered: string };
	content: { rendered: string };
	status: string;
	date: string;
	link: string;
	meta?: Record<string, unknown>;
}

interface WcRestProduct {
	id: number;
	name: string;
	description: string;
	status: string;
	date_created: string;
	permalink: string;
}

/** What a registered fix handler resolves to — same shape FindingsTable.tsx's own FixOutcome uses. */
interface FixOutcome {
	success: boolean;
	message: string;
}

const CATEGORY_LABELS: Record<ContentCategory, string> = {
	'blog-post': __('Blog Post', 'vulopilot'),
	'landing-page': __('Landing Page', 'vulopilot'),
	product: __('Product Description', 'vulopilot'),
	other: __('Page', 'vulopilot'),
};

const CATEGORY_ICONS: Record<ContentCategory, string> = {
	'blog-post': 'document',
	'landing-page': 'web-page-website',
	product: 'cart',
	other: 'document',
};

const SEVERITY_RANK: Record<FindingSeverity, number> = {
	critical: 0,
	high: 1,
	medium: 2,
	low: 3,
	info: 4,
};

const RESOURCE_OPTIONS: { id: Tab; label: string }[] = [
	{ id: 'all', label: __('All resources', 'vulopilot') },
	{ id: 'blog-post', label: __('Blog Posts', 'vulopilot') },
	{ id: 'landing-page', label: __('Landing Pages', 'vulopilot') },
	{ id: 'product', label: __('Products', 'vulopilot') },
	{ id: 'other', label: __('Other', 'vulopilot') },
];

const SEVERITY_LABELS: Record<FindingSeverity, string> = {
	critical: __('Critical', 'vulopilot'),
	high: __('High', 'vulopilot'),
	medium: __('Medium', 'vulopilot'),
	low: __('Low', 'vulopilot'),
	info: __('Info', 'vulopilot'),
};

/**
 * `label` deliberately empty — zyra's `look="toggle"` variant renders the
 * switch pill via CSS on the SAME `<label>` element that would carry
 * `option.label`'s text (`.toggle-checkbox label` styles it as a
 * 44×19px pill; that rule's higher specificity than `.checkbox-label`
 * wins), so any real text passed there gets visually swallowed into the
 * switch shape instead of reading as a label (confirmed live). Every
 * other `look="toggle"` caller in this codebase already leaves `label`
 * empty for the same reason (ManageAutomationsSection.tsx's own
 * `StatusToggleCell`) — the visible "Show ignored" text below is
 * rendered externally instead, next to the switch.
 */
const SHOW_IGNORED_OPTION = [
	{
		key: 'show-ignored',
		value: 'show-ignored',
		label: '',
	},
];

/** Shown next to the switch, and in full on hover (TooltipComponent) — see SHOW_IGNORED_OPTION's own docblock for why the switch itself can't carry this text. */
const SHOW_IGNORED_LABEL = __('Show ignored', 'vulopilot');
const SHOW_IGNORED_TOOLTIP = __(
	'Also count and show findings you’ve already dismissed with "Ignore" in the list below.',
	'vulopilot'
);

/**
 * Real word count from real rendered HTML — the only honest way to show
 * "2,450 words" without a dedicated word-count column anywhere in this
 * schema (same reasoning ContentStatsCard.tsx's own docblock gives for
 * why "Words Generated" stays an honest "Not tracked yet" instead:
 * unlike that stat, which would need every historical generation summed,
 * a single row's word count is fully derivable right now from its own
 * real content).
 */
const countWords = (html: string): number => {
	const text = html
		.replace(/<[^>]+>/g, ' ')
		.replace(/&[a-z0-9#]+;/gi, ' ')
		.trim();

	return text ? text.split(/\s+/).length : 0;
};

const timeAgo = (dateString: string): string => {
	const seconds = Math.max(
		0,
		Math.floor((Date.now() - new Date(dateString).getTime()) / 1000)
	);

	if (seconds < 60) {
		return __('just now', 'vulopilot');
	}
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) {
		return `${minutes}m ago`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return `${hours}h ago`;
	}
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
};

/**
 * Every real scanner behind these findings writes its title as
 * "{issue description}: {post title}" (confirmed by reading
 * ThinContentScanner/ReadabilityScanner/HeadingStructureScanner's own
 * `sprintf()` calls) — the post title is already shown once as the row's
 * own heading in this grouped view, so repeating it on every one of its
 * findings is pure duplication. Strips that exact real suffix when
 * present; leaves the title untouched otherwise (e.g. a future scanner
 * with a different format) rather than guessing at a truncation.
 */
const stripRedundantPostTitle = (
	findingTitle: string,
	postTitle: string
): string => {
	const suffix = `: ${postTitle}`;

	return findingTitle.endsWith(suffix)
		? findingTitle.slice(0, -suffix.length)
		: findingTitle;
};

/** Worst (lowest-rank) severity across a set of findings, for a row's at-a-glance issue-count badge. */
const worstSeverity = (findings: RawFinding[]): FindingSeverity =>
	findings.reduce<FindingSeverity>(
		(worst, finding) =>
			SEVERITY_RANK[finding.severity] < SEVERITY_RANK[worst]
				? finding.severity
				: worst,
		'info'
	);

/**
 * Real "Fix" handler resolution — same `vulopilot_finding_fix_handler`
 * filter FindingsTable.tsx's own `getFindingFixHandler()` reads (see that
 * function's own docblock for the full reasoning: registered by
 * vulopilot-pro's OneClickFix module when active, `null` otherwise, in
 * which case clicking "Fix with AI" opens the same Pro popup). Read fresh
 * on every click rather than cached, for the same reason given there.
 */
const getFindingFixHandler = () =>
	applyFilters('vulopilot_finding_fix_handler', null);

/**
 * "Recent Content" — real `wp/v2/posts`/`pages` + `wc/v3/products` data
 * (zero new backend needed for the list itself), categorized into 4 real
 * buckets: `post` → Blog Post; `product` → Product Description; a `page`
 * carrying the real `_vulopilot_landing_page` meta GenerateLandingPageAction
 * now sets on every page it creates → Landing Page; any other `page` →
 * the honest fallback "Other" (an "About Us"/"Contact" page has the
 * identical post_type to a landing page — this meta flag is the only
 * real signal telling them apart, see GenerateLandingPageAction's own
 * docblock). Word counts are computed client-side from each item's real
 * rendered content. Each row's kebab menu (Edit/View/Delete) is fully
 * real: Edit/View are real WP edit-screen/permalink links, Delete is a
 * real `DELETE` against the same REST route the row was read from
 * (trashes, recoverable — WP/WooCommerce's own default), removing the
 * row locally on success rather than a full refetch.
 *
 * Each row also carries its own real content-quality findings (same
 * `GET /findings` data the now-removed "Content Quality Issues" card
 * used, joined here per-post via `object_ref`), grouped/collapsed behind
 * a chevron rather than always shown — a source page expands to reveal
 * its own findings, same shape a broken-links checker groups individual
 * broken URLs under the page they live on. The toolbar's search/severity/
 * resource filters and "Show ignored" toggle all operate on this same
 * real data (no second parallel dataset); "Export CSV" exports exactly
 * what's currently on screen, same real client-side pattern
 * HistoryTab.tsx's own handleExport already uses. Fix/Resolve/Ignore/
 * Reopen reuse the exact same real REST calls and
 * `vulopilot_finding_fix_handler` filter FindingsTable.tsx's own row
 * actions do, not a parallel implementation.
 */
const RecentContentCard = () => {
	const [rows, setRows] = useState<ContentRow[]>([]);
	const [resourceFilter, setResourceFilter] = useState<Tab>('all');
	const [severityFilter, setSeverityFilter] = useState<SeverityFilter>('all');
	const [search, setSearch] = useState('');
	const [showIgnored, setShowIgnored] = useState(false);
	const [isLoading, setIsLoading] = useState(true);
	const [deletingId, setDeletingId] = useState<number | null>(null);
	const [fixingFindingId, setFixingFindingId] = useState<number | null>(null);
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);

	useEffect(() => {
		const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

		const fetchPosts = (endpoint: 'posts' | 'pages') =>
			getApiResponse<WpRestPost[]>(
				getApiLink(
					appLocalizer,
					`${endpoint}?per_page=10&orderby=date&order=desc&_fields=id,title,content,status,date,link,meta`,
					'wp/v2'
				),
				nonceHeaders
			)
				.then((response) =>
					(response || []).map((post): ContentRow => {
						const isLandingPage =
							'pages' === endpoint &&
							true === post.meta?.[LANDING_PAGE_META_KEY];

						return {
							id: post.id,
							category: isLandingPage
								? 'landing-page'
								: 'posts' === endpoint
									? 'blog-post'
									: 'other',
							title: post.title.rendered,
							status: post.status,
							date: post.date,
							wordCount: countWords(post.content.rendered),
							editLink: `${appLocalizer.site_url}/wp-admin/post.php?post=${post.id}&action=edit`,
							viewLink:
								'publish' === post.status ? post.link : null,
							findings: [],
						};
					})
				)
				.catch(() => [] as ContentRow[]);

		const fetchProducts = () =>
			getApiResponse<WcRestProduct[]>(
				getApiLink(
					appLocalizer,
					'products?per_page=10&orderby=date&order=desc&_fields=id,name,description,status,date_created,permalink',
					'wc/v3'
				),
				nonceHeaders
			)
				.then((response) =>
					(response || []).map((product): ContentRow => ({
						id: product.id,
						category: 'product',
						title: product.name,
						status: product.status,
						date: product.date_created,
						wordCount: countWords(product.description),
						editLink: `${appLocalizer.site_url}/wp-admin/post.php?post=${product.id}&action=edit`,
						viewLink:
							'publish' === product.status
								? product.permalink
								: null,
						findings: [],
					}))
				)
				.catch(() => [] as ContentRow[]);

		/**
		 * Real findings for the 3 content-quality scanners, both `open` and
		 * `ignored` (two real requests — the `/findings` `status` filter
		 * only accepts one value at a time, unlike `scanner_id`, see
		 * Controllers/Findings.php's own `get_items()`), grouped by the
		 * post id they belong to (`object_ref`). Ignored ones are fetched
		 * up front too, not only when "Show ignored" is switched on, so
		 * toggling it is instant rather than triggering a second load.
		 */
		const fetchFindingsByPost = (status: 'open' | 'ignored') =>
			getApiResponse<FindingsResponse>(
				getApiLink(
					appLocalizer,
					`findings?scanner_id=${CONTENT_SCANNER_IDS.join(',')}&status=${status}&per_page=100&orderby=id&order=desc`
				),
				nonceHeaders
			)
				.then((response) => response?.data || [])
				.catch(() => [] as RawFinding[]);

		Promise.all([
			fetchPosts('posts'),
			fetchPosts('pages'),
			fetchProducts(),
			fetchFindingsByPost('open'),
			fetchFindingsByPost('ignored'),
		])
			.then(([posts, pages, products, openFindings, ignoredFindings]) => {
				const byPostId = new Map<number, RawFinding[]>();

				[...openFindings, ...ignoredFindings].forEach((finding) => {
					if ('post' !== finding.object_type) {
						return;
					}

					const postId = Number(finding.object_ref);
					byPostId.set(postId, [
						...(byPostId.get(postId) || []),
						finding,
					]);
				});

				const merged = [...posts, ...pages, ...products].map(
					(row) => ({
						...row,
						findings: byPostId.get(row.id) || [],
					})
				);

				setRows(
					merged.sort(
						(a, b) =>
							new Date(b.date).getTime() -
							new Date(a.date).getTime()
					)
				);
			})
			.finally(() => setIsLoading(false));
	}, []);

	/**
	 * Severity filter options, built from the severities actually present
	 * in this card's own real findings — not a fixed 5-level list. All 3
	 * scanners this card reads from (thin-content/readability/heading-structure)
	 * only ever emit `Severity::LOW` findings (see each scanner's own
	 * `get_severity()`/`Severity::LOW` call) — a hardcoded Critical/High/
	 * Medium/Low dropdown would offer 3 options that can never match a
	 * single row, which reads as "the filter is broken" rather than what it
	 * actually is (this content-quality check just doesn't have severity
	 * tiers above Low). Recomputed whenever the real data changes, so if a
	 * future scanner joins this card with a higher severity, its option
	 * appears automatically.
	 */
	const severityOptions = useMemo(() => {
		const present = new Set<FindingSeverity>();

		rows.forEach((row) =>
			row.findings.forEach((finding) => present.add(finding.severity))
		);

		return [
			{ id: 'all' as SeverityFilter, label: __('All issues', 'vulopilot') },
			...Array.from(present)
				.sort((a, b) => SEVERITY_RANK[a] - SEVERITY_RANK[b])
				.map((severity) => ({
					id: severity as SeverityFilter,
					label: SEVERITY_LABELS[severity],
				})),
		];
	}, [rows]);

	/** A row's findings that are actually relevant to show right now — open always, ignored only while "Show ignored" is on — further narrowed by the severity filter. */
	const visibleFindingsFor = (row: ContentRow): RawFinding[] =>
		row.findings.filter(
			(finding) =>
				('open' === finding.status ||
					(showIgnored && 'ignored' === finding.status)) &&
				('all' === severityFilter ||
					finding.severity === severityFilter)
		);

	const visibleRows = rows.filter((row) => {
		if ('all' !== resourceFilter && row.category !== resourceFilter) {
			return false;
		}

		if (
			search &&
			!row.title.toLowerCase().includes(search.toLowerCase())
		) {
			return false;
		}

		if ('all' !== severityFilter && 0 === visibleFindingsFor(row).length) {
			return false;
		}

		return true;
	});

	/** Removes one finding from its row's own local `findings` list, once it's genuinely fixed/resolved server-side (an ignored→reopened finding is updated in place instead, see handleReopen). */
	const removeFindingLocally = (rowId: number, findingId: number) => {
		setRows((current) =>
			current.map((row) =>
				row.id === rowId
					? {
							...row,
							findings: row.findings.filter(
								(finding) => finding.id !== findingId
							),
						}
					: row
			)
		);
	};

	/**
	 * "Fix with AI" — always visible (register a source, don't modify the
	 * host, same posture FindingsTable.tsx's own handleFix takes): calls
	 * the real Pro-registered handler when active, resolving a real
	 * `POST /findings/{id}/fix` outcome (which already marks the finding
	 * 'resolved' server-side on success — see FindingFixRest.php's own
	 * docblock — so it's removed here locally too rather than re-fetched);
	 * opens the same Pro popup FindingsTable.tsx uses when it isn't.
	 */
	const handleFixFinding = (row: ContentRow, finding: RawFinding) => {
		const findingFixHandler = getFindingFixHandler();

		if ('function' !== typeof findingFixHandler) {
			setIsProPopupOpen(true);
			return;
		}

		setFixingFindingId(finding.id);

		Promise.resolve(
			findingFixHandler(finding) as Promise<FixOutcome> | undefined
		)
			.then((outcome) => {
				if (outcome?.message) {
					NoticeManager.add({
						uniqueKey: `recent-content-fix-${finding.id}`,
						type: outcome.success ? 'success' : 'error',
						position: 'float',
						message: outcome.message,
					});
				}

				if (outcome?.success) {
					removeFindingLocally(row.id, finding.id);
				}
			})
			.finally(() => setFixingFindingId(null));
	};

	/** Resolve/Ignore/Reopen — the same real `POST /findings/{id} {status}` FindingsTable.tsx's own handleResolve/handleIgnore/handleReopen call. */
	const handleFindingStatus = (
		row: ContentRow,
		finding: RawFinding,
		status: 'resolved' | 'ignored' | 'open',
		successMessage: string
	) => {
		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, `findings/${finding.id}`),
			{ status }
		).then((response) => {
			if (response) {
				NoticeManager.add({
					uniqueKey: `recent-content-finding-${status}-${finding.id}`,
					type: 'success',
					position: 'float',
					message: successMessage,
				});

				if ('open' === status) {
					// Reopened — stays in the row's real findings list
					// (it's a real open issue again), just with a real
					// updated status rather than removed.
					setRows((current) =>
						current.map((r) =>
							r.id === row.id
								? {
										...r,
										findings: r.findings.map((f) =>
											f.id === finding.id
												? { ...f, status: 'open' as const }
												: f
										),
									}
								: r
						)
					);
				} else {
					removeFindingLocally(row.id, finding.id);
				}
			} else {
				NoticeManager.add({
					uniqueKey: `recent-content-finding-${status}-failed-${finding.id}`,
					type: 'error',
					position: 'float',
					message: __(
						'Could not update this finding. Please try again.',
						'vulopilot'
					),
				});
			}
		});
	};

	/**
	 * A row's own expanded `<tr>` content (TableCard's real `expandable`
	 * row, not an in-cell dropdown) — every visible finding with its own
	 * Review/Resolve-or-Reopen/Ignore/Fix actions, same handlers the row's
	 * own findings list already used before this moved out of the
	 * "Issues" column's own cell.
	 */
	const renderFindingsDetail = (row: ContentRow, findings: RawFinding[]) => (
		<div className="recent-content-table-findings">
			{findings.map((finding) => (
				<div key={finding.id}>
					<span>
						{stripRedundantPostTitle(finding.title, row.title)}
					</span>
					<ButtonInput
						buttons={[
							{
								text: __('Review', 'vulopilot'),
								onClick: () => (window.location.href = row.editLink),
							},
							{
								text:
									'ignored' === finding.status
										? __('Reopen', 'vulopilot')
										: __('Resolve', 'vulopilot'),
								onClick: () =>
									handleFindingStatus(
										row,
										finding,
										'ignored' === finding.status ? 'open' : 'resolved',
										'ignored' === finding.status
											? __('Finding reopened.', 'vulopilot')
											: __('Finding marked as resolved.', 'vulopilot')
									),
							},
							...('ignored' !== finding.status
								? [
										{
											text: __('Ignore', 'vulopilot'),
											onClick: () =>
												handleFindingStatus(
													row,
													finding,
													'ignored',
													__('Finding ignored.', 'vulopilot')
												),
										},
										{
											text:
												fixingFindingId === finding.id
													? __('Fixing…', 'vulopilot')
													: __('Fix with AI', 'vulopilot'),
											icon: 'ai',
											disabled: fixingFindingId === finding.id,
											onClick: () => handleFixFinding(row, finding),
										},
									]
								: []),
						]}
					/>
				</div>
			))}
		</div>
	);

	const handleDelete = (row: ContentRow) => {
		// Same native window.confirm() pattern RedirectsTab.tsx/
		// AiProvidersPanel.tsx already use for one-off destructive
		// confirmations, rather than building a bespoke confirm dialog
		// for a single call site.
		if (
			!window.confirm(
				__(
					'Move this to trash? You can restore it from Trash afterward.',
					'vulopilot'
				)
			)
		) {
			return;
		}

		setDeletingId(row.id);

		const endpoint =
			'product' === row.category
				? getApiLink(appLocalizer, `products/${row.id}`, 'wc/v3')
				: getApiLink(
						appLocalizer,
						`${'landing-page' === row.category || 'other' === row.category ? 'pages' : 'posts'}/${row.id}`,
						'wp/v2'
					);

		fetch(endpoint, {
			method: 'DELETE',
			headers: { 'X-WP-Nonce': appLocalizer.nonce },
		})
			.then((response) => {
				if (!response.ok) {
					throw new Error();
				}

				setRows((current) => current.filter((r) => r.id !== row.id));
				NoticeManager.add({
					uniqueKey: `recent-content-delete-${row.id}`,
					type: 'success',
					position: 'float',
					message: __('Moved to trash.', 'vulopilot'),
				});
			})
			.catch(() => {
				NoticeManager.add({
					uniqueKey: `recent-content-delete-${row.id}`,
					type: 'error',
					position: 'float',
					message: __(
						'Could not delete this item. Please try again.',
						'vulopilot'
					),
				});
			})
			.finally(() => setDeletingId(null));
	};

	/**
	 * Every field here is already real (loaded, not re-fetched) — a real
	 * client-side export of exactly what's currently on screen (respecting
	 * the active search/severity/resource filters), same real pattern
	 * HistoryTab.tsx's own handleExport already uses, not a fabricated
	 * "full export" the backend has no route for.
	 */
	const handleExportCsv = () => {
		const header = [
			__('Title', 'vulopilot'),
			__('Type', 'vulopilot'),
			__('Status', 'vulopilot'),
			__('Words', 'vulopilot'),
			__('Open Issues', 'vulopilot'),
			__('Issue Details', 'vulopilot'),
		];

		const csvRows = visibleRows.map((row) => {
			const openFindings = row.findings.filter(
				(finding) => 'open' === finding.status
			);

			return [
				row.title,
				CATEGORY_LABELS[row.category],
				row.status,
				row.wordCount,
				openFindings.length,
				openFindings.map((finding) => finding.title).join('; '),
			];
		});

		const csv = [header, ...csvRows]
			.map((line) =>
				line
					.map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
					.join(',')
			)
			.join('\n');

		const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = 'vulopilot-recent-content.csv';
		link.click();
		URL.revokeObjectURL(url);
	};

	// The visible page of rows, each carrying its own real expanded-row
	// content (TableCard's `expandable` reads `row.expandedContent`
	// directly) — `undefined` for a row with nothing to expand, same as
	// the "Issues" column's own `findings.length` check above.
	const tableRows = visibleRows.slice(0, 8).map((row) => {
		const findings = visibleFindingsFor(row);

		return {
			...row,
			expandedContent:
				findings.length > 0
					? renderFindingsDetail(row, findings)
					: undefined,
		};
	});

	return (
		<CardComponent
			id="content-audit-section"
			className="recent-content-card"
			title={__('Recent Content', 'vulopilot')}
			action={
					<ButtonInput
					buttons={{
						text: __('View All', 'vulopilot'),
						rightIcon: 'arrow-right',
						color: 'text-purple',
						onClick: (e) => {
							e.preventDefault();
							window.location.href = `${appLocalizer.site_url}/wp-admin/edit.php`;
						},
					}}
				/>
				}
			isLoading={isLoading}>

			<div className="recent-content-toolbar">
				<TextInput
					type="search"
					name="recent-content-search"
					value={search}
					onChange={(value) => setSearch(value as string)}
					placeholder={__(
						'Search by title or source page…',
						'vulopilot'
					)}
					wrapperClass="recent-content-search"
				/>
				<SelectInput
					name="recent-content-severity-filter"
					type="single-select"
					value={severityFilter}
					onChange={(value) =>
						setSeverityFilter(value as SeverityFilter)
					}
					options={severityOptions.map((option) => ({
						label: option.label,
						value: option.id,
					}))}
					isClearable={false}
				/>
				<SelectInput
					name="recent-content-resource-filter"
					type="single-select"
					value={resourceFilter}
					onChange={(value) => setResourceFilter(value as Tab)}
					options={RESOURCE_OPTIONS.map((option) => ({
						label: option.label,
						value: option.id,
					}))}
					isClearable={false}
				/>
				<TooltipComponent
					text={SHOW_IGNORED_TOOLTIP}
					className="recent-content-show-ignored"
				>
					{/* Own onClick (not a real <label htmlFor>, since MultiCheckboxInput generates its input's id internally) so clicking the visible text toggles the switch too, same as clicking any other checkbox's label would. */}
					<span
						className="recent-content-show-ignored-label"
						onClick={() => setShowIgnored(!showIgnored)}
					>
						{SHOW_IGNORED_LABEL}
					</span>
					<MultiCheckboxInput
						look="toggle"
						modules={[]}
						options={SHOW_IGNORED_OPTION}
						value={showIgnored ? ['show-ignored'] : []}
						onChange={(value) =>
							setShowIgnored(value.includes('show-ignored'))
						}
					/>
				</TooltipComponent>
				<ButtonInput
					buttons={{
						text: __('Export CSV', 'vulopilot'),
						icon: 'download',
						onClick: handleExportCsv,
						disabled: 0 === visibleRows.length,
					}}
				/>
			</div>

			<TableCard
				className="transparent-table"
				showMenu={false}
				hideHeader={true}
				expandable
				headers={{
					title: {
						label: __('Content', 'vulopilot'),
						width: '40%',
						render: (row: ContentRow) => {
							// Same real findings/severity this row's own
							// "Issues" column below computes — duplicated
							// here (rather than lifted onto ContentRow)
							// since each TableCard column's `render` is
							// otherwise independent, same as `issues`
							// already recomputing it from `row` alone.
							const findings = visibleFindingsFor(row);
							const openFindings = row.findings.filter(
								(finding) => 'open' === finding.status
							);

							return (
								<InformationItemComponent
									title={
										row.title ||
										__('(no title)', 'vulopilot')
									}
									titleLink={row.editLink}
									avatar={{
										iconClass: CATEGORY_ICONS[row.category],
									}}
									badges={[
										{
											text: row.status,
											className: row.status,
										},
										...(findings.length > 0
											? [
													{
														text: sprintf(
															_n(
																'%d issue',
																'%d issues',
																findings.length,
																'vulopilot'
															),
															findings.length
														),
														className: `badge-${worstSeverity(openFindings)}`,
													},
												]
											: []),
									]}
									descriptions={[
										{
											value: formatWordCount(
												row.wordCount
											),
											icon: 'text-fields',
										},
										{
											value: CATEGORY_LABELS[row.category],
											icon: CATEGORY_ICONS[row.category],
										},
										{
											value: timeAgo(row.date),
											icon: 'clock',
										},
									]}
								/>
							);
						},
					},
					action: {
						label: __('Actions', 'vulopilot'),
						render: (row: ContentRow) => (
							<BadgeComponent
								badges={[
									{
										text: __('Edit', 'vulopilot'),
										icon: 'edit',
										className: 'yellow',
										onClick: () =>
											(window.location.href = row.editLink),
									},
									{
										text: __('View', 'vulopilot'),
										icon: 'eye',
										className: 'blue',
										onClick: () => {
											if (row.viewLink) {
												window.open(row.viewLink, '_blank', 'noreferrer');
											}
										},
									},
									{
										text:
											deletingId === row.id
												? __('Deleting…', 'vulopilot')
												: __('Delete', 'vulopilot'),
										icon: 'delete',
										className: 'red',
										onClick: () => handleDelete(row),
									},
								]}
							/>
						),
					},
				}}
				rows={tableRows}
				ids={tableRows.map((row) => row.id)}
				totalRows={Math.min(visibleRows.length, 8)}
				isLoading={isLoading}
				emptyMessage={
					search ||
					'all' !== severityFilter ||
					'all' !== resourceFilter
						? __('No content matches these filters.', 'vulopilot')
						: __('No content found yet.', 'vulopilot')
				}
			/>

			<PopupComponent
				open={isProPopupOpen}
				onClose={() => setIsProPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{appLocalizer.khali_dabba ? (
					// Pro is active — OneClickFix specifically isn't
					// enabled, so point at Modules rather than pitching an
					// upgrade the user already has (same branch
					// FindingsTable.tsx's own Pro popup takes).
					<ShowProPopup moduleName="one-click-fix" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</CardComponent>
	);
};

/**
 * "2,450 words"/"1 word" — real, locale-formatted (`toLocaleString()`
 * matches the mockup's own thousands-separator), singular-aware.
 */
const formatWordCount = (count: number): string =>
	1 === count
		? __('1 word', 'vulopilot')
		: `${count.toLocaleString()} ${__('words', 'vulopilot')}`;

export default RecentContentCard;
