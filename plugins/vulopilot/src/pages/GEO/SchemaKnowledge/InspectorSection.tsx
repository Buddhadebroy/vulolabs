/* global appLocalizer */
import { __, sprintf } from '@wordpress/i18n';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
	NoticeComponent,
} from '@zyra/components';
import { ButtonInput, SelectInput } from '@zyra/inputs';
import { getApiLink, getApiResponse, scrollToId } from '@zyra/core';
import { useEffect, useState } from 'react';
import { useSchemaInspector } from './useSchemaInspector';

interface InspectablePage {
	id: number;
	title: string;
	type: string;
	type_label: string;
	url: string;
}

interface DevTool {
	key: string;
	icon: string;
	title: string;
	desc: string;
	onClick: () => void;
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

/** The real path portion of a real, already-known-good site URL — falls back to the full URL on anything unparseable rather than throwing. */
const pathOf = (url: string): string => {
	try {
		return new URL(url).pathname;
	} catch {
		return url;
	}
};

/**
 * "Inspector" section of the merged "Schema & Knowledge" tab — a real
 * single-page JSON-LD checker (`POST /schema/inspect`, SchemaPageInspector,
 * real outbound HTTP + extraction, no AI). The page to inspect is picked
 * from a real dropdown of this site's own recent posts/pages/products
 * (`GET /schema/inspectable-pages`) rather than typed in as a raw URL —
 * selecting one runs the real inspection immediately, no separate "Inspect"
 * button. Detected types, problems, and the JSON-LD viewer are all read
 * directly off the real decoded structured data on the inspected page; the
 * Schema Validator tile is a real link-out to Google's own public Rich
 * Results Test (zero backend needed); Conflict Detection flags real cases
 * of more than one JSON-LD block sharing the same @type on one page.
 */
const InspectorSection = () => {
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
			.then((response) => setPages(response ?? []))
			.finally(() => setIsLoadingPages(false));
	}, []);

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

	const scrollTo = (id: string) =>
		document
			.getElementById(id)
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });

	/**
	 * Every tile is a real, always-clickable action — none of them are
	 * inert descriptions. Before any page has been inspected, a tile with
	 * nothing of its own to show yet (JSON-LD Viewer/Conflict Detection)
	 * falls back to scrolling up to the real page picker rather than doing
	 * nothing; Schema Validator still has a real, useful default target
	 * (this site's own homepage) even with nothing inspected yet.
	 */
	const devTools: DevTool[] = [
		{
			key: 'inspector',
			icon: 'search',
			title: __('Schema Inspector', 'vulopilot'),
			desc: __(
				'See all schema detected on one specific page and where it comes from.',
				'vulopilot'
			),
			onClick: () => scrollTo('schema-inspector-picker'),
		},
		{
			key: 'jsonld',
			icon: 'editor-code',
			title: __('JSON-LD Viewer', 'vulopilot'),
			desc: __(
				'View, copy and export the raw JSON-LD structured data from any page.',
				'vulopilot'
			),
			onClick: result
				? () => scrollTo('schema-inspector-jsonld')
				: () => scrollTo('schema-inspector-picker'),
		},
		{
			key: 'validator',
			icon: 'security',
			title: __('Schema Validator', 'vulopilot'),
			desc: __(
				"Validate this site's structured data against Google's Rich Results Test.",
				'vulopilot'
			),
			onClick: () =>
				window.open(
					`https://search.google.com/test/rich-results?url=${encodeURIComponent(result ? result.url : appLocalizer.site_url)}`,
					'_blank',
					'noreferrer'
				),
		},
		{
			key: 'conflict',
			icon: 'analytics',
			title: __('Conflict Detection', 'vulopilot'),
			desc: __(
				'Detect duplicate or conflicting schema output by more than one plugin or theme.',
				'vulopilot'
			),
			onClick: result
				? () => scrollTo('schema-inspector-conflicts')
				: () => scrollTo('schema-inspector-picker'),
		},
	];

	return (
		<ColumnComponent>
			<CardComponent
				id="schema-inspector-picker"
				title={__('Inspect a specific page', 'vulopilot')}
				titleIcon="search"
				desc={__(
					'See exactly what structured information search engines receive from any page or product.',
					'vulopilot'
				)}
			>
				<SelectInput
					type="single-select"
					name="schema_inspect_page"
					value={selectedUrl}
					onChange={(newValue) => handleSelectPage(newValue as string)}
					placeholder={
						isLoadingPages
							? __('Loading…', 'vulopilot')
							: __('Select a page or product…', 'vulopilot')
					}
					options={pages.map((page) => ({
						value: page.url,
						label: `${page.title} (${page.type_label})`,
					}))}
					isClearable={false}
					disabled={isLoadingPages || isInspecting}
				/>
				{selectedUrl && (
					<p className="desc schema-inspector-selected-path">
						{pathOf(selectedUrl)}
					</p>
				)}

				{error && (
					<NoticeComponent
						uniqueKey="vulopilot-schema-inspect-error"
						type="error"
						displayPosition="inline-notice"
						message={error}
					/>
				)}

				{result && (
					<div className="schema-inspector-result">
						<ContainerComponent>
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
						</ContainerComponent>

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

						<div id="schema-inspector-conflicts">
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
														'%1$d separate "%2$s" blocks were found on this page — search engines may only use one.',
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
						</div>

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
									onClick: () =>
										window.open(result.url, '_blank', 'noreferrer'),
								}}
							/>
							<ButtonInput
								buttons={{
									text: __('View JSON-LD', 'vulopilot'),
									color: 'text-purple',
									onClick: () =>
										document
											.getElementById('schema-inspector-jsonld')
											?.scrollIntoView({
												behavior: 'smooth',
												block: 'start',
											}),
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
					</div>
				)}
			</CardComponent>

			{result && (
				<CardComponent
					id="schema-inspector-jsonld"
					title={__('JSON-LD Viewer', 'vulopilot')}
					titleIcon="editor-code"
					action={
						<div className="schema-inspector-jsonld-actions">
							<ButtonInput
								buttons={{
									text: __('Copy', 'vulopilot'),
									onClick: handleCopy,
								}}
							/>
							<ButtonInput
								buttons={{
									text: __('Export', 'vulopilot'),
									onClick: handleExport,
								}}
							/>
						</div>
					}
				>
					{result.blocks.map((block) => (
						<pre key={block.index} className="schema-inspector-jsonld-block">
							{prettyPrint(block.raw)}
						</pre>
					))}
				</CardComponent>
			)}

			<CardComponent
				title={__('Developer Tools', 'vulopilot')}
				titleIcon="editor-code"
			>
				<div className="schema-dev-tools-grid">
					{devTools.map((tool) => (
						<div
							key={tool.key}
							className="schema-dev-tool-tile is-clickable"
							role="button"
							tabIndex={0}
							onClick={tool.onClick}
							onKeyDown={(e) => {
								if ('Enter' === e.key || ' ' === e.key) {
									e.preventDefault();
									tool.onClick();
								}
							}}
						>
							<div className="kg-glance-icon">
								<i className={`adminfont-${tool.icon}`} />
							</div>
							<div>
								<div className="kg-check-title">{tool.title}</div>
								<div className="kg-check-desc">{tool.desc}</div>
							</div>
							<i className="adminfont-arrow-right schema-dev-tool-chevron" />
						</div>
					))}
				</div>
				{!result && (
					<ModuleGuardComponent
						icon="info"
						title={__('Pick a page above to see full results here', 'vulopilot')}
						desc={__(
							'Every tool above already works — Schema Validator opens for this site’s homepage until you inspect a specific page, and the others jump you back to the page picker.',
							'vulopilot'
						)}
					/>
				)}
			</CardComponent>
		</ColumnComponent>
	);
};

export default InspectorSection;
