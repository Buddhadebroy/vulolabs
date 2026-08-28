/* global appLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	CardComponent,
	ChartComponent,
	InformationItemComponent,
	ModuleGuardComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { TableCard } from '@zyra/table';
import { ratingColor } from './seoRating';
import { nonceHeaders } from './seoIssuesShared';
import './WhatShouldIFixFirst.scss';

interface PageNeedingAttentionRow {
	post_id: number;
	title: string;
	edit_link: string;
	permalink: string;
	score: number;
	issues: number;
	main_problem: string;
	change: number;
}

interface PagesNeedingAttentionResponse {
	data: PageNeedingAttentionRow[];
	total: number;
}

const DEFAULT_PER_PAGE = 10;

/** Same "no real number, no arrow" honesty `deltaLabel()` (SeoTab.tsx) already established for the sitewide score's own delta — a page with no findings 7 days ago and none now genuinely has 0 change, which is a real, meaningful "steady" state, not missing data, so it still renders (just without an arrow). */
const ChangeCell = ({ change }: { change: number }) => {
	if (0 === change) {
		return <span className="fix-first-change is-steady">{__('No change', 'vulopilot')}</span>;
	}

	const improved = change > 0;

	return (
		<span className={`fix-first-change ${improved ? 'is-good' : 'is-attention'}`}>
			<i className={`adminfont-arrow-${improved ? 'up' : 'down'}`} />
			{Math.abs(change)}
		</span>
	);
};

interface PagesNeedingAttentionTableProps {
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onAnalyze: (postId: number) => void;
	/** SeoTab.tsx's own `analyzingPostId` — which row's panel (if any) is currently open, so this row's own action button can read "Viewing" instead of "Analyze". */
	activePostId?: number | null;
}

/**
 * "Pages that need attention" — a new, additive table (direct instruction:
 * sits above the existing filter-tabs/severity cards/Site-wide Issues/
 * Pages & Posts section below, which this doesn't touch or duplicate data
 * from). `GET /seo/pages-needing-attention` (Seo.php) — real per-page score/
 * Main Problem/Change, worst score first, one call for every real published
 * page/post with at least one currently-open SEO finding. Paginated
 * client-side (same `paged`/`perPage` slice-and-report-back pattern
 * SlowPagesTab.tsx's own `TableCard` usage already establishes), since the
 * endpoint itself returns every matching row unpaginated.
 *
 * `onAnalyze` opens the exact same `PageAnalysisPanel` sidebar
 * `SeoIssuesByPageTable.tsx`'s own "Analyze" action does — both tables share
 * one `analyzingPostId` state in `SeoTab.tsx`, so only one panel is ever open
 * at a time regardless of which table it was opened from.
 */
const PagesNeedingAttentionTable = ({ onAnalyze, activePostId }: PagesNeedingAttentionTableProps) => {
	const [rows, setRows] = useState<PageNeedingAttentionRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [hasError, setHasError] = useState(false);
	const [paged, setPaged] = useState(1);
	const [perPage, setPerPage] = useState(DEFAULT_PER_PAGE);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		setHasError(false);

		getApiResponse<PagesNeedingAttentionResponse>(
			getApiLink(appLocalizer, 'seo/pages-needing-attention'),
			nonceHeaders
		)
			.then((response) => {
				if (!cancelled) {
					setRows(response?.data ?? []);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setHasError(true);
				}
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	const pageRows = rows.slice((paged - 1) * perPage, paged * perPage);

	if (hasError) {
		return (
			<CardComponent title={__('Pages that need attention', 'vulopilot')}>
				<ModuleGuardComponent
					icon="error"
					title={__('Could not load these pages', 'vulopilot')}
					desc={__(
						'Something went wrong fetching this data. Please try again.',
						'vulopilot'
					)}
				/>
				<ButtonInput
					buttons={{
						text: __('Retry', 'vulopilot'),
						icon: 'update',
						onClick: () => {
							setPaged(1);
							setIsLoading(true);
							setHasError(false);
							getApiResponse<PagesNeedingAttentionResponse>(
								getApiLink(appLocalizer, 'seo/pages-needing-attention'),
								nonceHeaders
							)
								.then((response) => setRows(response?.data ?? []))
								.catch(() => setHasError(true))
								.finally(() => setIsLoading(false));
						},
					}}
				/>
			</CardComponent>
		);
	}

	return (
		<CardComponent
			title={__('Pages that need attention', 'vulopilot')}
			desc="Lorem ipsum dolor sit amet consectetur adipisicing elit. Modi dolore sequi totam pariatur quaerat possimus ipsum doloremque eveniet iste corrupti? Distinctio harum error accusantium sint unde fugiat ratione nostrum porro."
			isLoading={isLoading}
		>
			{!isLoading && 0 === rows.length ? (
				<ModuleGuardComponent
					icon="check"
					title={__('Nothing here right now', 'vulopilot')}
					desc={__(
						'No published page or post currently has an open SEO issue — nice work.',
						'vulopilot'
					)}
				/>
			) : (
				<TableCard
					showMenu={false}
					hideHeader
					className="transparent-table"
					activeRowId={activePostId ?? undefined}
					headers={{
						title: {
							label: __('Page', 'vulopilot'),
							width: '55%',
							render: (row: PageNeedingAttentionRow) => (
								<InformationItemComponent
									title={row.title || __('(no title)', 'vulopilot')}
									titleLink={row.edit_link}
									badges={[
										{
											text: sprintf(
												/* translators: %d: number of open issues on this page. */
												_n(
													'%d Issue',
													'%d Issues',
													row.issues,
													'vulopilot'
												),
												row.issues
											),
											className: 'badge-info',
										},
									]}
									descriptions={[{ value: row.main_problem }]}
								/>
							),
						},
						score: {
							label: __('SEO Score', 'vulopilot'),
							render: (row: PageNeedingAttentionRow) => (
								<ChartComponent
									type="ring"
									height={40}
									color={ratingColor(row.score)}
									dataKey="score"
									data={[{ score: row.score }]}
									centerLabel={row.score}
								/>
							),
						},
						change: {
							label: __('Change', 'vulopilot'),
							render: (row: PageNeedingAttentionRow) => (
								<ChangeCell change={row.change} />
							),
						},
						action: {
							label: __('Action', 'vulopilot'),
							// `type: 'more-action'` no longer exists (zyra's
							// `TableRowActions` now covers that same "single
							// labelled toggle button" case via a
							// `type: 'button'` action whose own label/icon
							// are functions of `row` — see that type's own
							// docblock) — this is that same "More Details"/
							// "Showing" toggle shape, just relabeled
							// "Analyze"/"Viewing".
							type: 'action',
							actions: [
								{
									type: 'button',
									label: (row) =>
										(row as unknown as PageNeedingAttentionRow)
											.post_id === activePostId
											? __('Viewing', 'vulopilot')
											: __('Analyze', 'vulopilot'),
									icon: (row) =>
										(row as unknown as PageNeedingAttentionRow)
											.post_id === activePostId
											? 'eye'
											: 'pagination-next-arrow',
									onClick: (row) =>
										onAnalyze(
											(row as unknown as PageNeedingAttentionRow)
												.post_id
										),
								},
							],
						},
					}}
					rows={pageRows}
					ids={pageRows.map((row) => row.post_id)}
					totalRows={rows.length}
					isLoading={isLoading}
					onQueryUpdate={(query: { paged?: number | string; per_page?: number | string }) => {
						setPaged(Number(query.paged) || 1);
						setPerPage(Number(query.per_page) || DEFAULT_PER_PAGE);
					}}
				/>
			)}
		</CardComponent>
	);
};

export default PagesNeedingAttentionTable;
