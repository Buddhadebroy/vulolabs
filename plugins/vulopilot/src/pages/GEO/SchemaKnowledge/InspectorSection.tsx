/* global appLocalizer */
import { __, sprintf } from '@wordpress/i18n';
import {
	CardComponent,
	ColumnComponent,
	ModuleGuardComponent,
	NoticeComponent,
} from '@zyra/components';
import { ButtonInput, ToggleInput } from '@zyra/inputs';
import { TableCard } from '@zyra/table';
import { getApiLink, getApiResponse, scrollToId } from '@zyra/core';
import { useEffect, useState } from 'react';
import { useSchemaInspector } from './useSchemaInspector';
import type { SchemaCoverageSnapshot, SchemaPageFilter } from './useSchemaCoverage';
import { RobotsTxtEditor } from '../CrawlRobotsSitemapSection';

/**
 * Real per-`type` color + icon - the exact same 3 real post types
 * `GET /schema/inspectable-pages` ever actually queries (Schema.php's own
 * `list_inspectable_pages()`: `post_type => ['post', 'page', 'product']`).
 * `''`/`'document'` is the honest fallback for any other real post type
 * that query's own `TYPE_LABELS[$post_type] ?? ucfirst($post_type)` guard
 * could in principle return, even though none of the 3 it actually
 * queries ever hits that branch today.
 */
const TYPE_COLOR: Record<string, string> = {
	post: 'blue',
	page: 'indigo',
	product: 'green',
	homepage: 'orange',
};
const TYPE_ICON: Record<string, string> = {
	post: 'document',
	page: 'document',
	product: 'product',
	homepage: 'home',
};

interface InspectablePage {
	id: number;
	title: string;
	type: string;
	type_label: string;
	url: string;
}

const downloadJson = (filename: string, content: string) => {
	const blob = new Blob([content], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
};

const prettyPrint = (raw: string): string => {
	try {
		return JSON.stringify(JSON.parse(raw), null, 2);
	} catch {
		return raw;
	}
};

/** The real path portion of a real, already-known-good site URL - falls back to the full URL on anything unparseable rather than throwing. */
const pathOf = (url: string): string => {
	try {
		return new URL(url).pathname;
	} catch {
		return url;
	}
};

/**
 * "Inspector" section of the merged "Schema & Knowledge" tab - a real
 * single-page JSON-LD checker (`POST /schema/inspect`, SchemaPageInspector,
 * real outbound HTTP + extraction, no AI). The page to inspect is picked
 * from a real dropdown of this site's own recent posts/pages/products
 * (`GET /schema/inspectable-pages`) rather than typed in as a raw URL -
 * selecting one runs the real inspection immediately, no separate "Inspect"
 * button.
 *
 * One card, not three - this used to be "Inspect a specific page" + a
 * separate "JSON-LD Viewer" card + a separate "Developer Tools" card
 * holding a 4-tile grid, per direct instruction to merge them into
 * something "compact yet meaningful" instead. Two of those four tiles
 * (Schema Inspector, JSON-LD Viewer) were already just scroll-jumps to
 * content that's now simply the next thing down in this same card - not a
 * real second action, just navigation to itself. A third (Conflict
 * Detection) jumped to the Conflicts section below, likewise now just
 * "scroll down a bit" once everything lives in one place. Only Schema
 * Validator (a real link-out to Google's own public Rich Results Test) was
 * a genuinely distinct action, so that's the one thing kept as its own
 * button - real and useful even before a page is picked (defaults to this
 * site's own homepage), and automatically re-targets to the actually-
 * inspected page's own URL once one is selected.
 */
interface InspectorSectionProps {
	/** Latest schema coverage sample - tells which inspectable pages have structured data and which don't. */
	snapshot: SchemaCoverageSnapshot | null;
	pageFilter: SchemaPageFilter;
	onPageFilterChange: (filter: SchemaPageFilter) => void;
}

const normalizeUrl = (url: string): string => url.replace(/\/+$/, '');

const InspectorSection = ({
	snapshot,
	pageFilter,
	onPageFilterChange,
}: InspectorSectionProps) => {
	const [pages, setPages] = useState<InspectablePage[]>([]);
	const [isLoadingPages, setIsLoadingPages] = useState(true);
	const [selectedUrl, setSelectedUrl] = useState('');
	const { result, isInspecting, error, inspect } = useSchemaInspector();
	const [copyNotice, setCopyNotice] = useState<string | null>(null);

	useEffect(() => {
		getApiResponse<InspectablePage[]>(
			getApiLink(appLocalizer, 'schema/inspectable-pages'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				const list = response ?? [];
				setPages(list);

				// Opens the first real row by default rather than leaving
				// the result panel on its "Select a page" placeholder -
				// same real `inspect()` call a manual row click already
				// triggers, just fired once for the list's own first entry
				// as soon as it's known.
				if (list.length > 0) {
					handleSelectPage(list[0].url);
				}
			})
			.finally(() => setIsLoadingPages(false));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	// Pages the last coverage sample found schema on (or not) - keyed by
	// URL; a page outside that sample matches only the "All" filter.
	const schemaByUrl = new Map(
		(snapshot?.pages ?? []).map((page) => [
			normalizeUrl(page.url),
			page.types.length > 0,
		])
	);
	const visiblePages = pages.filter((page) => {
		if ('all' === pageFilter) {
			return true;
		}
		const hasSchema = schemaByUrl.get(normalizeUrl(page.url));
		return 'valid' === pageFilter ? true === hasSchema : false === hasSchema;
	});
	const validCount = [...schemaByUrl.values()].filter(Boolean).length;
	const filterOptions = [
		{
			key: 'all',
			value: 'all',
			label: sprintf(__('All (%d)', 'vulopilot'), pages.length),
		},
		{
			key: 'valid',
			value: 'valid',
			label: sprintf(__('With schema (%d)', 'vulopilot'), validCount),
		},
		{
			key: 'attention',
			value: 'attention',
			label: sprintf(
				__('Need attention (%d)', 'vulopilot'),
				schemaByUrl.size - validCount
			),
		},
	];

	const handleSelectPage = (url: string) => {
		setSelectedUrl(url);
		inspect(url);
	};

	const handleCopy = () => {
		if (!result) {
			return;
		}
		const combined = result.blocks
			.map((block) => prettyPrint(block.raw))
			.join('\n\n');
		navigator.clipboard
			.writeText(combined)
			.then(() =>
				setCopyNotice(__('JSON-LD copied to clipboard.', 'vulopilot'))
			)
			.catch(() =>
				setCopyNotice(__('Could not copy to clipboard.', 'vulopilot'))
			);
	};

	const handleExport = () => {
		if (!result) {
			return;
		}
		downloadJson(
			'schema-inspection.json',
			JSON.stringify(result.blocks, null, 2)
		);
	};

	const openRichResultsTest = () =>
		window.open(
			`https://search.google.com/test/rich-results?url=${encodeURIComponent(result ? result.url : appLocalizer.site_url)}`,
			'_blank',
			'noreferrer'
		);

	return (
		<>
			<ColumnComponent grid={8}>
				<CardComponent
					id="schema-knowledge-inspector"
					title={__('Inspect a specific page', 'vulopilot')}
					titleIcon="search"
					desc={__(
						'See exactly what structured information search engines receive from any page or product.',
						'vulopilot'
					)}
				>
					{snapshot?.pages && (
						<ToggleInput
							options={filterOptions}
							value={pageFilter}
							onChange={(value) =>
								onPageFilterChange(value as SchemaPageFilter)
							}
							modules={[]}
							variant="pill"
						/>
					)}
					<TableCard
						showMenu={false}
						hideHeader={true}
						variant="transparent"
						// Highlights the row whose inspection result is showing
						// in the side panel - same real `activeRowId`/action-
						// toggle pairing IssuesSection.tsx's own table+detail-
						// panel split already uses.
						activeRowId={selectedUrl}
						onRowClick={(row: Record<string, unknown>) =>
							handleSelectPage((row as unknown as InspectablePage).url)
						}
						headers={{
							page: {
								key: 'title',
								type: 'info',
								label: __('Page', 'vulopilot'),
								width: '70%',
								iconKey: 'typeIcon',
								badgesKey: 'typeBadges',
								// Real URL path under the title - the one
								// honest per-row detail already available
								// here (`InspectablePage` carries no
								// excerpt/summary field to show instead),
								// same real "info column gets a description
								// line" shape most other tables in this
								// plugin already use.
								descriptionKey: 'pageDesc',
							},
							action: {
								label: __('Action', 'vulopilot'),
								type: 'action',
								actions: [
									{
										type: 'button',
										label: (row) =>
											(row as unknown as InspectablePage).url ===
											selectedUrl
												? __('Inspecting', 'vulopilot')
												: __('Inspect', 'vulopilot'),
										color: (row) =>
											(row as unknown as InspectablePage).url ===
											selectedUrl
												? 'text-green'
												: 'text-purple',
										icon: (row) =>
											(row as unknown as InspectablePage).url ===
											selectedUrl
												? 'eye'
												: 'pagination-next-arrow',
										onClick: (row) =>
											handleSelectPage(
												(row as unknown as InspectablePage).url
											),
									},
								],
							},
						}}
						rows={visiblePages.map((page) => ({
							...page,
							id: page.url,
							// Real page/post/product type this row's own real
							// `type_label` already carries - shown as a plain,
							// uncolored badge next to the title (same real
							// `color: ''` convention useFindingsTable.tsx's own
							// compact-layout category tag already uses),
							// colored per real type (post/page/product)
							// instead of one flat color.
							typeBadges: [
								{
									text: page.type_label,
									color: TYPE_COLOR[page.type] ?? '',
								},
							],
							typeIcon: TYPE_ICON[page.type] ?? 'document',
							// Real URL path - the info column's own
							// description line under the title.
							pageDesc: pathOf(page.url),
						}))}
						ids={visiblePages.map((page) => page.url)}
						totalRows={visiblePages.length}
						isLoading={isLoadingPages}
						emptyMessage={__(
							'No inspectable pages/products found on this site yet.',
							'vulopilot'
						)}
					/>
				</CardComponent>
			</ColumnComponent>

			<ColumnComponent grid={4}>
				{!selectedUrl ? (
					<CardComponent
						title={__('Inspection result', 'vulopilot')}
						titleIcon="search"
						desc={__(
							'More detail on the page you select from the table.',
							'vulopilot'
						)}
					>
						<ModuleGuardComponent
							icon="search"
							title={__('Select a page', 'vulopilot')}
							desc={__(
								'Choose a row from the table to inspect its real structured data here.',
								'vulopilot'
							)}
						/>
					</CardComponent>
				) : (
					<CardComponent
						title={pathOf(selectedUrl)}
						titleIcon="search"
						desc={__(
							'What search engines actually receive from this page.',
							'vulopilot'
						)}
						isLoading={isInspecting}
					>
						{error && (
							<NoticeComponent
								uniqueKey="vulopilot-schema-inspect-error"
								type="error"
								displayPosition="inline-notice"
								message={error}
							/>
						)}

						{!result && !isInspecting && (
							<div className="schema-inspector-validator-hint">
								<span className="desc">
									{__(
										'Or check this site’s homepage right now, without picking a page:',
										'vulopilot'
									)}
								</span>
								<ButtonInput
									position="left"
									buttons={{
										text: __(
											'Validate homepage with Google ',
											'vulopilot'
										),
										icon: 'external',
										color: 'text-purple',
										onClick: openRichResultsTest,
									}}
								/>
							</div>
						)}

						{result && (
							<div className="schema-inspector-result">
							<ColumnComponent grid={6}>
								<div className="schema-inspector-result-heading">
									{__('Detected schema', 'vulopilot')}
								</div>
								{0 === result.types.length ? (
									<div className="desc">
										{__(
											'No structured data (JSON-LD) was found on this page.',
											'vulopilot'
										)}
									</div>
								) : (
									<ul className="schema-inspector-check-list">
										{result.types.map((type) => (
											<li key={type}>
												<i className="adminfont-check schema-inspector-check-icon--good" />
												<span>{type}</span>
											</li>
										))}
									</ul>
								)}
							</ColumnComponent>

							<ColumnComponent grid={6}>
								<div className="schema-inspector-result-heading">
									{sprintf(
										/* translators: %d is how many real problems were found in this page's structured data. */
										__('Problems found (%d)', 'vulopilot'),
										result.problems.length
									)}
								</div>
								{0 === result.problems.length ? (
									<div className="desc">
										{__(
											'No missing-field problems detected in this page’s structured data.',
											'vulopilot'
										)}
									</div>
								) : (
									<ul className="schema-inspector-check-list">
										{result.problems.map((problem, index) => (
											<li key={index}>
												<i className="adminfont-alarm schema-inspector-check-icon--warn" />
												<span>{problem.message}</span>
											</li>
										))}
									</ul>
								)}
							</ColumnComponent>

						{result.problems.length > 0 && (
							<button
								type="button"
								className="schema-view-pages-link schema-inspector-view-problems"
								onClick={() => scrollToId('schema-knowledge-issues')}
							>
								{__('View problems', 'vulopilot')}
								<i className="adminfont-arrow-right" />
							</button>
						)}

						<div className="schema-inspector-result-heading">
							{sprintf(
								/* translators: %d is how many real duplicate/conflicting schema blocks were found on this page. */
								__('Conflicts detected (%d)', 'vulopilot'),
								result.conflicts.length
							)}
						</div>
						{0 === result.conflicts.length ? (
							<div className="desc">
								{__(
									'No duplicate or conflicting schema output detected on this page.',
									'vulopilot'
								)}
							</div>
						) : (
							<ul className="schema-inspector-check-list">
								{result.conflicts.map((conflict) => (
									<li key={conflict.type}>
										<i className="adminfont-error schema-inspector-check-icon--bad" />
										<span>
											{sprintf(
												/* translators: 1: schema.org @type, e.g. "Product", 2: number of JSON-LD blocks on this page sharing that type. */
												__(
													'%1$d separate "%2$s" blocks were found on this page - search engines may only use one.',
													'vulopilot'
												),
												conflict.block_indexes.length,
												conflict.type
											)}
										</span>
									</li>
								))}
							</ul>
						)}

						{result.preview && (
							<>
								<div className="schema-inspector-result-heading">
									{__('Quick preview', 'vulopilot')}
								</div>
								<div className="schema-inspector-preview">
									<div className="schema-inspector-preview-title">
										{result.preview.title ||
											__(
												'Not found in this page’s structured data',
												'vulopilot'
											)}
									</div>
									<div className="desc">{result.url}</div>
									{null !== result.preview.rating && (
										<div className="desc">
											{sprintf(
												/* translators: 1: star rating out of 5, 2: number of ratings. */
												__('Rating: %1$s (%2$d)', 'vulopilot'),
												result.preview.rating,
												result.preview.rating_count ?? 0
											)}
										</div>
									)}
									<div className="desc">
										{sprintf(
											/* translators: %s is either the real detected availability value, or a "not found" note. */
											__('Availability: %s', 'vulopilot'),
											result.preview.availability ||
												__(
													'Not found in this page’s structured data',
													'vulopilot'
												)
										)}
									</div>
									{result.preview.description && (
										<div className="desc">
											{result.preview.description}
										</div>
									)}
								</div>
							</>
						)}

						<div className="schema-inspector-actions">
							<ButtonInput
								buttons={{
									text: __('Open page', 'vulopilot'),
									icon: 'external',
									onClick: () =>
										window.open(result.url, '_blank', 'noreferrer'),
								}}
							/>
							<ButtonInput
								buttons={{
									text: __('Validate with Google', 'vulopilot'),
									icon: 'external',
									color: 'text-purple',
									onClick: openRichResultsTest,
								}}
							/>
						</div>

						{copyNotice && (
							<NoticeComponent
								uniqueKey="vulopilot-schema-inspect-copy"
								type="success"
								displayPosition="inline-notice"
								message={copyNotice}
							/>
						)}

						<div className="schema-inspector-result-heading">
							{__('JSON-LD', 'vulopilot')}
						</div>
						<div className="schema-inspector-jsonld-actions">
							<ButtonInput
								buttons={{
									text: __('Copy', 'vulopilot'),
									icon: 'copy',
									onClick: handleCopy,
								}}
							/>
							<ButtonInput
								buttons={{
									text: __('Export', 'vulopilot'),
									icon: 'export',
									onClick: handleExport,
								}}
							/>
						</div>
						{result.blocks.map((block) => (
							<div key={block.index} className="schema-inspector-jsonld-block">
								<RobotsTxtEditor
									value={prettyPrint(block.raw)}
									readOnly
								/>
							</div>
						))}
					</div>
				)}
					</CardComponent>
				)}
			</ColumnComponent>
		</>
	);
};

export default InspectorSection;
