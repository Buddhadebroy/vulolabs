/* global appLocalizer */
import React, { useEffect, useState, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	CardComponent,
	ListComponent,
	ModuleGuardComponent,
	NoticeManager,
	PopupComponent,
	ClipboardComponent,
	BadgeComponent
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import ShowProPopup from '../../components/Popup/Popup';
import { formatWpDate } from '../../services/formatWpDate';
import { getSeverityClass } from '../../services/getSeverityClass';
import {
	CATEGORY_ICONS,
	CATEGORY_LABELS,
	formatAffected,
	FindingGroup,
} from './issuesTypes';
import './IssueDetailPanel.scss';

interface FixOutcome {
	success: boolean;
	message: string;
	succeeded?: number;
	total?: number;
	noFixAvailable?: number;
}

/**
 * Mirrors vulopilot-pro/modules/OneClickFix/src/index.tsx's own exported
 * `BULK_FIX_MAX_ITEMS` (that module can't be imported directly — a
 * separate plugin's own webpack bundle, see getFindingBulkFixHandler's own
 * docblock for why filters are how the two talk) — a group can have
 * hundreds of open findings (e.g. "File Changes"), well past what one
 * `POST /findings/bulk-fix` request accepts (BulkFixRest::MAX_BULK_ITEMS),
 * so handleFix() below batches its own calls to the registered handler
 * rather than sending every id at once and getting a flat 400.
 */
const BULK_FIX_BATCH_SIZE = 50;

interface FindingRow {
	id: number;
	title: string;
	object_type: string | null;
	object_ref: string | null;
	created_at: string;
	/**
	 * When this row was last reconfirmed by a scan — same value as
	 * `created_at` for a finding that's only ever been detected once;
	 * moves forward for a scanner in ScanPersistenceListener's own
	 * DEDUPE_ON_RESCAN list (e.g. `core-file-integrity`) each time a
	 * still-open problem is seen again, rather than piling up a duplicate
	 * row per scan run. Optional only because a row fetched before this
	 * column existed won't have it — falls back to `created_at` below.
	 */
	last_seen_at?: string;
	page?: string;
}

/**
 * How many individual findings to actually list under "Affected accounts"/
 * "Affected pages"/etc. — the group's own real `count` (shown right above
 * this list) is always the true total; this only bounds how many rows the
 * panel renders so a group with hundreds of open findings doesn't dump an
 * unbounded list into a fixed-width side panel. A "+N more" line covers
 * the remainder.
 */
const MAX_AFFECTED_ITEMS_SHOWN = 20;

/**
 * Section label per real `object_type` — same noun set formatAffected()
 * already uses for the bare count line, just as a section heading instead
 * of "N {noun}". Falls back to "Affected items" for any object_type this
 * map doesn't know about, same fallback formatAffected() uses.
 */
const AFFECTED_ITEMS_LABEL: Record<string, string> = {
	user: __('Affected accounts', 'vulopilot'),
	post: __('Affected pages', 'vulopilot'),
	attachment: __('Affected images', 'vulopilot'),
	product: __('Affected products', 'vulopilot'),
	url: __('Affected endpoints', 'vulopilot'),
	plugin: __('Affected plugins', 'vulopilot'),
	theme: __('Affected themes', 'vulopilot'),
	table: __('Affected tables', 'vulopilot'),
	file: __('Affected files', 'vulopilot'),
	site: __('Affected checks', 'vulopilot'),
};

/**
 * Same registration FindingsTable.tsx's own bulk "Fix selected" reads —
 * see that file's own getFindingBulkFixHandler docblock for why it's read
 * fresh on every click rather than cached.
 */
const getFindingBulkFixHandler = () =>
	applyFilters('vulopilot_finding_bulk_fix_handler', null);

const SEVERITY_LABEL: Record<string, string> = {
	critical: __('Critical Priority', 'vulopilot'),
	high: __('High Priority', 'vulopilot'),
	medium: __('Medium Priority', 'vulopilot'),
	low: __('Low Priority', 'vulopilot'),
	info: __('Low Priority', 'vulopilot'),
};

interface IssueDetailPanelProps {
	group: FindingGroup | null;
	onActionComplete: () => void;
	onClose: () => void;
}

/**
 * The Issues table's right-side detail panel — mockup shows "Why it
 * matters"/"What VuloPilot recommends"/"How to fix" sections, but no
 * scanner anywhere writes that copy (ScannerInterface only ever produces
 * title/severity/category/description — see FindingRepository::get_finding_groups()'s
 * own docblock), so this only ever shows real fields: the group's real
 * severity/category/count/detected-date (a top stat-tile row, same real
 * "Priority/Category/Affected/Detected" shape that mockup's own header
 * used), one real representative finding's own title/description/page
 * ("Example finding" — clearly framed as one instance, not a fabricated
 * summary of the whole group), and real bulk actions (Fix/Resolve all/
 * Ignore all) scoped to every open finding in the group, not just the one
 * example shown. While Pro is inactive, the footer swaps those 3 real
 * (but locked/disabled) actions for 2 real, clickable upgrade actions
 * ("Upgrade to Pro"/"Unlock fix details" — both just open the existing
 * `ShowProPopup` lightbox, same real destination the section overlays
 * below already open) — per direct instruction, matching that mockup's
 * own real footer functionality instead of showing 3 dead buttons.
 *
 * Performance findings are one exception to "no scanner writes that copy"
 * above: every `classes/Scanners/Basic/*Scanner.php` under the
 * `performance` category now writes a real, scanner-specific
 * `recommended_fix` step list into `Finding::get_meta()` (e.g. CdnScanner's
 * own "sign up for a CDN"/"confirm assets resolve through it"/… steps) —
 * genuine, accurate remediation guidance, not fabricated data. When a
 * performance finding's sample carries that list, this panel swaps
 * "Example finding" for "Recommended fix" (a numbered step list, per
 * direct instruction matching a reference design) instead of the generic
 * title/description/page example.
 *
 * `WordPressHealthScanner`/`ServerHealthScanner` (categories `wordpress`/
 * `server`) are the other exception — both wrap `WP_Site_Health`, whose own
 * test descriptions are genuinely built from separate HTML paragraphs (a
 * "why this matters" explanation, then a "what was actually found" detail)
 * before WordPress core hands them back as one flattened string; those two
 * scanners now recover that real split (`split_into_paragraphs()`, never
 * fabricated) into `meta.why_it_matters`/`meta.what_happened`. When
 * present, `why_it_matters` renders as its own always-visible section (not
 * Pro-gated — general educational content, not per-site data) and
 * `what_happened` takes over the swappable section in place of "Example
 * finding", the same way `recommended_fix` does for Performance. Every
 * other category (20 of 22) still shows "Example finding" as before, since
 * no other scanner writes either of these fields.
 *
 * The header's own `desc` deliberately shows the sample's `title` (short)
 * rather than its `description` (long) — the latter is already shown once,
 * in full, by whichever of the three sections above ends up rendering; an
 * earlier version of this panel showed the same long description in both
 * places. "Affected items" below has the same care taken: `group.sample`
 * is normally also the first row that list's own fetch would return (both
 * read the same scanner_id ordered by id desc), so `otherAffectedItems`
 * filters that one row out — this list only ever shows open findings
 * genuinely NOT already covered by "Recommended fix"/"What happened"/
 * "Example finding" above.
 */
const IssueDetailPanel: React.FC<IssueDetailPanelProps> = ({
	group,
	onActionComplete,
	onClose,
}) => {
	const [isBusy, setIsBusy] = useState(false);
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);
	/**
	 * Separate from `isProPopupOpen` above (that one is scoped to the
	 * "Fix with AI" button specifically, and can branch to a
	 * `moduleName="one-click-fix"` popup even while Pro itself is active) —
	 * this one only ever opens from the "Example finding"/"Affected items"
	 * blur below, which only ever gates on the Pro plugin being active at
	 * all (`appLocalizer.khali_dabba`), so it always shows the generic
	 * upgrade pitch, never a per-module one.
	 */
	const [isDetailProPopupOpen, setIsDetailProPopupOpen] = useState(false);
	const [affectedItems, setAffectedItems] = useState<FindingRow[] | null>(
		null
	);
	const [isLoadingAffected, setIsLoadingAffected] = useState(false);

	/**
	 * The group response only ever carries a `count` + one sample — this
	 * fetches the real, current individual findings in the group (the same
	 * `GET /findings` row list fetchGroupIds() below also reads, just kept
	 * as full rows here instead of only `.id`) so "Affected" can show which
	 * specific accounts/pages/etc. were actually detected, not just a bare
	 * number. Capped to MAX_AFFECTED_ITEMS_SHOWN for display — the group's
	 * own real `count` (shown above this list) stays the true total either
	 * way, and bulk actions below still act on every open finding via their
	 * own uncapped fetchGroupIds() call.
	 *
	 * Skipped entirely (no request at all) while Pro is inactive — this
	 * same list is one of the sections `renderProGatedSection` below
	 * replaces with dummy content, per direct instruction ("the actual
	 * content is show only when pro active"): real per-site data shouldn't
	 * even be fetched into the browser for a section that's locked, not
	 * just left unrendered.
	 */
	useEffect(() => {
		if (!group || !appLocalizer.khali_dabba) {
			setAffectedItems(null);
			return;
		}

		setIsLoadingAffected(true);
		setAffectedItems(null);

		getApiResponse<{ data?: FindingRow[] } | FindingRow[]>(
			getApiLink(
				appLocalizer,
				`findings?scanner_id=${encodeURIComponent(group.scanner_id)}&status=open&per_page=${MAX_AFFECTED_ITEMS_SHOWN}&orderby=id&order=desc`
			),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				const list = Array.isArray(response)
					? response
					: (response?.data ?? []);

				setAffectedItems(list);
			})
			.finally(() => setIsLoadingAffected(false));
	}, [group?.scanner_id]);

	if (!group) {
		return (
			<CardComponent
				title={__('Issue details', 'vulopilot')}
				titleIcon="ai"
				desc={__('More detail on the issue you select from the table.', 'vulopilot')}
			>
				<ModuleGuardComponent
					icon="ai"
					title={__('Select an issue', 'vulopilot')}
					desc={__(
						'Choose a row from the table to see more detail here.',
						'vulopilot'
					)}
				/>
			</CardComponent>
		);
	}

	/**
	 * "Example finding", "Affected items"/"Affected endpoints", and the
	 * Fix with AI/Resolve all/Ignore all action row below are all real,
	 * per-site detail/actions — a Pro feature, per direct instruction.
	 * Deliberately just `khali_dabba` (the Pro plugin active at all) and
	 * not a specific module id — this same panel is shared by
	 * Security/Performance/GEO/Content/AI Assistant's own issue tables, no
	 * single module id would even apply to all of them. `handleFix` below
	 * still keeps its own, separate `one-click-fix`-module check
	 * (`isProPopupOpen`) as defense-in-depth for the one edge case this
	 * gate can't see — Pro active overall but that one cardless module
	 * specifically toggled off — though the overlay below already blocks
	 * every click while Pro itself is inactive, before that handler is
	 * ever reached.
	 */
	const isProActive = !!appLocalizer.khali_dabba;

	/**
	 * `group.sample.meta` is the raw `wp_json_encode()`-d `Finding::get_meta()`
	 * column (AbstractRepository::find_all() is a plain `SELECT *`, no
	 * server-side decode — see issuesTypes.ts's own `FindingSample.meta`
	 * docblock) — parsed once here rather than trusting its shape, since a
	 * finding scanned before a given scanner started writing this data (or
	 * any scanner category that never will) simply won't have it.
	 */
	const sampleMeta: Record<string, unknown> | null = (() => {
		if (!group.sample?.meta) {
			return null;
		}

		try {
			const parsed = JSON.parse(group.sample.meta);

			return parsed && 'object' === typeof parsed ? parsed : null;
		} catch {
			return null;
		}
	})();

	/**
	 * Real, scanner-specific remediation steps — see this file's own top
	 * docblock. An empty array means "fall back to Example finding" below,
	 * never a fabricated step list.
	 */
	const recommendedFixSteps: string[] = Array.isArray(
		sampleMeta?.recommended_fix
	)
		? (sampleMeta?.recommended_fix as unknown[]).filter(
				(step: unknown): step is string => 'string' === typeof step
			)
		: [];

	const showRecommendedFix =
		'performance' === group.category && recommendedFixSteps.length > 0;

	/**
	 * `why_it_matters`/`what_happened` — WordPressHealthScanner.php/
	 * ServerHealthScanner.php's own real split of `WP_Site_Health`'s
	 * already-separate description paragraphs (see those files' own
	 * `split_into_paragraphs()` docblock) — never fabricated, and only ever
	 * present for those two scanner categories' findings. `whyItMatters`
	 * renders unconditionally when present (general educational content,
	 * not per-site data — no reason to Pro-gate it); `whatHappened` takes
	 * over the swappable Pro-gated section below in place of "Example
	 * finding" when present, same as `showRecommendedFix` does for
	 * Performance.
	 */
	const whyItMatters =
		'string' === typeof sampleMeta?.why_it_matters
			? sampleMeta.why_it_matters
			: '';
	const whatHappened =
		'string' === typeof sampleMeta?.what_happened
			? sampleMeta.what_happened
			: '';
	const showWhatHappened = !showRecommendedFix && '' !== whatHappened;

	/**
	 * `group.sample` is always the same finding "Recommended fix"/"What
	 * happened"/"Example finding" above already shows in full — and since
	 * it's also the group's own most-recently-detected finding, it's
	 * normally the very first row `affectedItems` itself fetches (same
	 * `orderby=id&order=desc` as `group.sample`, see this file's own
	 * `useEffect` above). Left in, "Affected items" would repeat that exact
	 * same title/page/date a second time right below content that already
	 * covered it. Filtered out here so this list only ever shows OTHER open
	 * findings in the group — real data either way, just not shown twice.
	 */
	const otherAffectedItems = (affectedItems ?? []).filter(
		(row) => row.id !== group.sample?.id
	);

	/**
	 * Same "never render the real thing while locked, not even faded"
	 * idiom useContentGate.tsx's own Pro/module checks already use (its
	 * own docblock explains why: a locked section shouldn't leak its real
	 * data at all) — per direct instruction, corrected here from an
	 * earlier pass that blurred the real content in place instead. Every
	 * caller passes its own `dummyContent` (a generic preview of that
	 * section's shape, same convention useContentGate.tsx's own
	 * `DEFAULT_DUMMY_CONTENT` sets), never `realContent` itself. The
	 * "Affected items" list's own real data isn't even fetched while
	 * locked (see that effect's own docblock above) — this only covers
	 * what's rendered, not what's requested.
	 */
	const renderProGatedSection = (
		realContent: ReactNode,
		dummyContent: ReactNode,
		// "Affected items" and the action row right below it sit back to
		// back with no other field between them — two "Pro" tags stacked
		// that close together read as a duplicate, not two separate locked
		// things, per direct instruction. The action row's own call passes
		// `false` here (still fully blurred/gated, just without its own
		// tag) since "Affected items" right above it already carries one.
		showTag: boolean = true
	): ReactNode => {
		if (isProActive) {
			return realContent;
		}

		return (
			<div className="issue-detail-pro-gate">
				{showTag && (
					<div className="issue-detail-pro-gate-tag">
						<span className="admin-tag pro-tag">
							<i className="adminfont-pro-tag" />
							{__('Pro', 'vulopilot')}
						</span>
					</div>
				)}
				<div className="issue-detail-pro-gate-dummy" aria-hidden="true">
					{dummyContent}
				</div>
				<div
					className="issue-detail-pro-gate-overlay"
					role="button"
					tabIndex={0}
					aria-label={__('Upgrade to Pro', 'vulopilot')}
					onClick={() => setIsDetailProPopupOpen(true)}
					onKeyDown={(e) => {
						if ('Enter' === e.key || ' ' === e.key) {
							e.preventDefault();
							setIsDetailProPopupOpen(true);
						}
					}}
				/>
			</div>
		);
	};

	/**
	 * The group response only ever carries a `count` + one sample row, not
	 * every individual finding id — this fetches the real, current id list
	 * for the group's scanner_id right before a bulk action runs, so
	 * Fix/Resolve/Ignore act on every open finding in the group (not just
	 * the one example shown), using the same real `GET /findings` endpoint
	 * every other findings list already reads.
	 */
	const fetchGroupIds = (scannerId: string): Promise<number[]> =>
		getApiResponse<{ data?: { id: number }[] } | { id: number }[]>(
			getApiLink(
				appLocalizer,
				`findings?scanner_id=${encodeURIComponent(scannerId)}&status=open&per_page=100`
			),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		).then((response) => {
			const list = Array.isArray(response)
				? response
				: (response?.data ?? []);

			return list.map((row) => row.id);
		});

	const handleBulkStatus = (
		status: 'resolved' | 'ignored',
		successMessage: string
	) => {
		setIsBusy(true);
		fetchGroupIds(group.scanner_id)
			.then((ids) => {
				if (!ids.length) {
					return;
				}

				return sendApiResponse(
					appLocalizer,
					getApiLink(appLocalizer, 'findings/bulk'),
					{ ids, status }
				).then((response) => {
					NoticeManager.add({
						uniqueKey: `issue-group-${status}-${group.scanner_id}`,
						type: response ? 'success' : 'error',
						position: 'float',
						message: response
							? successMessage
							: __(
									'Could not update these findings. Please try again.',
									'vulopilot'
								),
					});

					if (response) {
						onActionComplete();
					}
				});
			})
			.finally(() => setIsBusy(false));
	};

	/**
	 * Runs the registered bulk-fix handler once per BULK_FIX_BATCH_SIZE
	 * chunk of ids (sequentially — these can be real AI propose+approve
	 * calls, not something to fire dozens of at once) and aggregates the
	 * real succeeded/total/noFixAvailable counts across every batch into
	 * one final outcome, rather than reporting only the last batch's own
	 * numbers.
	 */
	const runBulkFixInBatches = (
		// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
		bulkFixHandler: (batchIds: number[]) => Promise<FixOutcome> | undefined,
		ids: number[]
	): Promise<FixOutcome> => {
		const batches: number[][] = [];

		for (let i = 0; i < ids.length; i += BULK_FIX_BATCH_SIZE) {
			batches.push(ids.slice(i, i + BULK_FIX_BATCH_SIZE));
		}

		return batches
			.reduce(
				(chain, batch) =>
					chain.then((totals) =>
						Promise.resolve(bulkFixHandler(batch)).then((outcome) => ({
							succeeded: totals.succeeded + (outcome?.succeeded ?? 0),
							total: totals.total + (outcome?.total ?? batch.length),
							noFixAvailable:
								totals.noFixAvailable + (outcome?.noFixAvailable ?? 0),
							lastMessage: outcome?.message ?? totals.lastMessage,
						}))
					),
				Promise.resolve({
					succeeded: 0,
					total: 0,
					noFixAvailable: 0,
					lastMessage: '',
				})
			)
			.then(({ succeeded, total, noFixAvailable, lastMessage }) => {
				const failed = total - succeeded;

				// Single batch: the handler's own message already says
				// exactly the right thing (including the "no automatic
				// fix exists yet" honest case) — reuse it as-is rather
				// than re-deriving a coarser version here.
				if (batches.length <= 1) {
					return { success: 0 === failed, message: lastMessage };
				}

				let message: string;

				if (0 === failed) {
					message = sprintf(
						/* translators: %d is how many findings were fixed. */
						__('Fixed %d findings.', 'vulopilot'),
						succeeded
					);
				} else if (noFixAvailable === failed) {
					message =
						succeeded > 0
							? sprintf(
									/* translators: 1: number fixed, 2: how many had no automatic fix available at all. */
									__(
										'Fixed %1$d findings — no automatic fix exists yet for the other %2$d.',
										'vulopilot'
									),
									succeeded,
									noFixAvailable
								)
							: __(
									'No automatic fix exists yet for these findings.',
									'vulopilot'
								);
				} else {
					message = sprintf(
						/* translators: 1: number fixed, 2: total findings attempted. */
						__(
							'Fixed %1$d of %2$d findings — some had no fix available or failed.',
							'vulopilot'
						),
						succeeded,
						total
					);
				}

				return { success: 0 === failed, message };
			});
	};

	const handleFix = () => {
		const bulkFixHandler = getFindingBulkFixHandler();

		if ('function' !== typeof bulkFixHandler) {
			setIsProPopupOpen(true);
			return;
		}

		setIsBusy(true);
		fetchGroupIds(group.scanner_id)
			.then((ids) => {
				if (!ids.length) {
					return;
				}

				return runBulkFixInBatches(bulkFixHandler, ids).then((outcome) => {
					if (outcome?.message) {
						NoticeManager.add({
							uniqueKey: `issue-group-fix-${group.scanner_id}`,
							type: outcome.success ? 'success' : 'error',
							position: 'float',
							message: outcome.message,
						});
					}

					onActionComplete();
				});
			})
			.finally(() => setIsBusy(false));
	};

	return (
		<>
			<CardComponent
				className="issue-detail-panel"
				title={group.label}
				titleIcon="error"
				desc={group.sample?.title}
				action={
					<i
						className="adminfont-close"
						role="button"
						tabIndex={0}
						aria-label={__('Close', 'vulopilot')}
						onClick={onClose}
						onKeyDown={(e) => {
							if ('Enter' === e.key || ' ' === e.key) {
								e.preventDefault();
								onClose();
							}
						}}
					/>
				}
			>
				<div className="issue-detail-badges-row">
					<BadgeComponent
						color={getSeverityClass(group.severity)}
						text={SEVERITY_LABEL[group.severity]}
					/>
					<BadgeComponent
						color="blue"
						text={CATEGORY_LABELS[group.category] ?? group.category}
					/>
				</div>

				<div className="issue-detail-stats-grid">
					<div className="issue-detail-stat-tile">
						<i className="adminfont-global-community issue-detail-stat-icon" />
						<span className="issue-detail-stat-label">
							{__('Affected', 'vulopilot')}
						</span>
						<span className="issue-detail-stat-value">
							{formatAffected(group.count, group.object_type)}
						</span>
					</div>
					<div className="issue-detail-stat-tile">
						<i className="adminfont-calendar issue-detail-stat-icon" />
						<span className="issue-detail-stat-label">
							{__('Detected', 'vulopilot')}
						</span>
						<span className="issue-detail-stat-value">
							{group.sample
								? formatWpDate(
										group.sample.last_seen_at ?? group.sample.created_at
									)
								: '—'}
						</span>
					</div>
					<div className="issue-detail-stat-tile">
						<i className="adminfont-location issue-detail-stat-icon" />
						<span className="issue-detail-stat-label">
							{__('Scope', 'vulopilot')}
						</span>
						<span className="issue-detail-stat-value">
							{group.sample?.page || __('Site-wide', 'vulopilot')}
						</span>
					</div>
				</div>

				{whyItMatters && (
					<div className="issue-detail-why-it-matters">
						<div className="issue-detail-why-it-matters-icon">
							<i className="adminfont-info" />
						</div>
						<div>
							<div className="issue-detail-why-it-matters-title">
								{__('Why it matters', 'vulopilot')}
							</div>
							<div className="desc">{whyItMatters}</div>
						</div>
					</div>
				)}

				{group.sample && (
					<div className="issue-detail-section">
						<div className="issue-detail-section-header">
							{!isProActive && (
								<i className="adminfont-lock issue-detail-section-lock" />
							)}
							<span className="issue-detail-section-title">
								{showRecommendedFix
									? __('Recommended fix', 'vulopilot')
									: showWhatHappened
										? __('What happened?', 'vulopilot')
										: __('Example finding', 'vulopilot')}
							</span>
							{!isProActive && (
								<span className="admin-tag pro-tag">
									<i className="adminfont-pro-tag" />
									{__('Pro', 'vulopilot')}
								</span>
							)}
						</div>
						{showRecommendedFix
							? renderProGatedSection(
									<ol className="issue-detail-fix-steps">
										{recommendedFixSteps.map((step, index) => (
											<li key={index} className="issue-detail-fix-step">
												<span className="issue-detail-fix-step-number">
													{index + 1}
												</span>
												<span className="issue-detail-fix-step-text">
													{step}
												</span>
											</li>
										))}
									</ol>,
									<span className="desc">
										{__(
											'Step-by-step guidance for fixing this specific issue appears here once Pro is active.',
											'vulopilot'
										)}
									</span>,
									false
								)
							: showWhatHappened
								? renderProGatedSection(
										<>
											<div className="desc">{whatHappened}</div>
											<div className="issue-detail-example-where">
												<ClipboardComponent
													text={
														group.sample.page || __('Site-wide', 'vulopilot')
													}
													variant="code"
													copyButtonLabel={__('Copy', 'vulopilot')}
													copiedLabel={__('Copied!', 'vulopilot')}
												/>
											</div>
										</>,
										<span className="desc">
											{__(
												'What this specific check actually found appears here once Pro is active.',
												'vulopilot'
											)}
										</span>,
										false
									)
								: renderProGatedSection(
									<>
										<div className="issue-detail-example-title">
											{group.sample.title}
										</div>
										<div className="desc">{group.sample.description}</div>
										<div className="issue-detail-example-where">
											<ClipboardComponent
												text={
													group.sample.page || __('Site-wide', 'vulopilot')
												}
												variant="code"
												copyButtonLabel={__('Copy', 'vulopilot')}
												copiedLabel={__('Copied!', 'vulopilot')}
											/>
										</div>
									</>,
									<span className="desc">
										{__(
											'A real, representative finding from this group — its title, description, and where it was found — appears here once Pro is active.',
											'vulopilot'
										)}
									</span>,
									false
								)}
					</div>
				)}

				<div className="issue-detail-section">
					<div className="issue-detail-section-header">
						{!isProActive && (
							<i className="adminfont-lock issue-detail-section-lock" />
						)}
						<span className="issue-detail-section-title">
							{AFFECTED_ITEMS_LABEL[group.object_type ?? ''] ??
								__('Affected items', 'vulopilot')}
						</span>
						{!isProActive && (
							<span className="admin-tag pro-tag">
								<i className="adminfont-pro-tag" />
								{__('Pro', 'vulopilot')}
							</span>
						)}
					</div>
					{renderProGatedSection(
						<>
							<ListComponent
								className="mini-card report"
								loading={isLoadingAffected}
								items={otherAffectedItems.map((row) => ({
									id: row.id,
									icon: CATEGORY_ICONS[group.category] ?? 'ai',
									title: row.title,
									desc: sprintf(
										/* translators: 1: affected page/location, 2: formatted detection date */
										__('%1$s • Detected %2$s', 'vulopilot'),
										row.page || __('Site-wide', 'vulopilot'),
										formatWpDate(row.last_seen_at ?? row.created_at)
									),
								}))}
							/>
							{!isLoadingAffected &&
								affectedItems &&
								0 === affectedItems.length && (
									<span className="desc">
										{__(
											'No individual findings could be loaded for this group right now.',
											'vulopilot'
										)}
									</span>
								)}
							{!isLoadingAffected &&
								affectedItems &&
								affectedItems.length > 0 &&
								0 === otherAffectedItems.length && (
									<span className="desc">
										{__(
											'This group\'s only other open finding is already shown above.',
											'vulopilot'
										)}
									</span>
								)}
							{!isLoadingAffected &&
								affectedItems &&
								group.count > affectedItems.length && (
									<span className="small desc">
										{sprintf(
											/* translators: %d: how many further open findings exist beyond the list shown above */
											__(
												'+%d more not shown here — use Resolve all/Ignore all below, or open the Issues table to see every one.',
												'vulopilot'
											),
											group.count - affectedItems.length
										)}
									</span>
								)}
						</>,
						<span className="desc">
							{__(
								'The specific accounts/pages/etc. this group affects appear here once Pro is active.',
								'vulopilot'
							)}
						</span>,
						false
					)}
				</div>

				{!isProActive && (
					<div className="issue-detail-upgrade-banner">
						<i className="adminfont-info" />
						<span>
							{showRecommendedFix
								? __(
										'Detailed recommendations, setup guidance, and AI fixes are included in Pro.',
										'vulopilot'
									)
								: __(
										'Detailed examples, the full affected list, and AI-assisted fixes are included in Pro.',
										'vulopilot'
									)}
						</span>
					</div>
				)}

				{isProActive ? (
					<ButtonInput
						position="full-width"
						buttons={[
							{
								text: __('Fix with AI', 'vulopilot'),
								icon: 'ai',
								color: 'orange-bg',
								onClick: handleFix,
								disabled: isBusy,
							},
							{
								text: __('Resolve all', 'vulopilot'),
								color: 'border-purple',
								onClick: () =>
									handleBulkStatus(
										'resolved',
										__(
											'All findings in this group marked resolved.',
											'vulopilot'
										)
									),
								disabled: isBusy,
							},
							{
								text: __('Ignore all', 'vulopilot'),
								color: 'border-red',
								onClick: () =>
									handleBulkStatus(
										'ignored',
										__(
											'All findings in this group ignored.',
											'vulopilot'
										)
									),
								disabled: isBusy,
							},
						]}
					/>
				) : (
					<ButtonInput
						position="full-width"
						buttons={[
							{
								text: __('Upgrade to Pro', 'vulopilot'),
								icon: 'pro-tag',
								color: 'orange-bg',
								onClick: () => setIsDetailProPopupOpen(true),
							},
							{
								text: __('Unlock fix details', 'vulopilot'),
								icon: 'lock',
								color: 'border-purple',
								onClick: () => setIsProPopupOpen(true),
							},
						]}
					/>
				)}
			</CardComponent>
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
			<PopupComponent
				open={isDetailProPopupOpen}
				onClose={() => setIsDetailProPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				<ShowProPopup />
			</PopupComponent>
		</>
	);
};

export default IssueDetailPanel;
