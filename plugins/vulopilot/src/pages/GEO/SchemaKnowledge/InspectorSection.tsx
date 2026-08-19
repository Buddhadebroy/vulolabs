import { __, sprintf } from '@wordpress/i18n';
import {
	CardComponent,
	ColumnComponent,
	ModuleGuardComponent,
	BadgeComponent,
	NoticeComponent,
} from '@zyra/components';
import { ButtonInput, TextInput } from '@zyra/inputs';
import { useState } from 'react';
import { useSchemaInspector } from './useSchemaInspector';

const DEV_TOOLS: { key: string; icon: string; title: string; desc: string }[] = [
	{
		key: 'inspector',
		icon: 'search',
		title: __('Schema Inspector', 'vulopilot'),
		desc: __(
			'See all schema detected on one specific page and where it comes from.',
			'vulopilot'
		),
	},
	{
		key: 'jsonld',
		icon: 'editor-code',
		title: __('JSON-LD Viewer', 'vulopilot'),
		desc: __(
			'View, copy and export the raw JSON-LD structured data from any page.',
			'vulopilot'
		),
	},
	{
		key: 'validator',
		icon: 'security',
		title: __('Schema Validator', 'vulopilot'),
		desc: __(
			"Validate this site's structured data against Google's Rich Results Test.",
			'vulopilot'
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
	},
];

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

/**
 * "Inspector" section of the merged "Schema & Knowledge" tab — a real
 * single-page JSON-LD checker (`POST /schema/inspect`,
 * SchemaPageInspector, real outbound HTTP + extraction, no AI), replacing
 * the standalone Schema tab's own "Not built yet" placeholders for this
 * exact area. Detected types, problems, and the JSON-LD viewer are all
 * read directly off the real decoded structured data on the inspected
 * page; the Schema Validator tile is a real link-out to Google's own
 * public Rich Results Test (zero backend needed); Conflict Detection
 * flags real cases of more than one JSON-LD block sharing the same @type
 * on one page.
 */
const InspectorSection = () => {
	const [url, setUrl] = useState('');
	const { result, isInspecting, error, inspect } = useSchemaInspector();
	const [copyNotice, setCopyNotice] = useState<string | null>(null);

	const handleInspect = () => inspect(url);

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

	return (
		<ColumnComponent>
			<CardComponent
				title={__('Inspect a specific page', 'vulopilot')}
				titleIcon="search"
				desc={__(
					'Paste any real URL on this site to see exactly what structured data it outputs — a real HTTP request to that page, made only when you ask.',
					'vulopilot'
				)}
			>
				<div className="schema-inspector-input-row">
					<TextInput
						name="schema_inspect_url"
						placeholder={__(
							'https://example.com/product/t-shirt-with-logo/',
							'vulopilot'
						)}
						value={url}
						onChange={(newValue) => setUrl(newValue as string)}
					/>
					<ButtonInput
						buttons={{
							text: isInspecting
								? __('Inspecting…', 'vulopilot')
								: __('Inspect', 'vulopilot'),
							onClick: handleInspect,
							disabled: isInspecting || '' === url.trim(),
						}}
					/>
				</div>

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
							<div className="schema-inspector-badge-row">
								{result.types.map((type) => (
									<BadgeComponent key={type} color="blue" text={type} />
								))}
							</div>
						)}

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
							<ul className="schema-inspector-problem-list">
								{result.problems.map((problem, index) => (
									<li key={index}>
										<BadgeComponent color="yellow" text={__('Important', 'vulopilot')} />
										<span>{problem.message}</span>
									</li>
								))}
							</ul>
						)}

						{result.conflicts.length > 0 && (
							<>
								<div className="schema-inspector-result-heading">
									{__('Conflicts detected', 'vulopilot')}
								</div>
								<ul className="schema-inspector-problem-list">
									{result.conflicts.map((conflict) => (
										<li key={conflict.type}>
											<BadgeComponent color="red" text={__('Conflict', 'vulopilot')} />
											<span>
												{sprintf(
													/* translators: 1: schema.org @type, e.g. "Product", 2: how many JSON-LD blocks on this page share that type. */
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
							</>
						)}

						{result.preview && (
							<>
								<div className="schema-inspector-result-heading">
									{__('Quick Preview', 'vulopilot')}
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

						<div className="schema-inspector-result-heading">
							{__('Actions', 'vulopilot')}
						</div>
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
							<ButtonInput
								buttons={{
									text: __('Schema Validator', 'vulopilot'),
									color: 'text-purple',
									onClick: () =>
										window.open(
											`https://search.google.com/test/rich-results?url=${encodeURIComponent(result.url)}`,
											'_blank',
											'noreferrer'
										),
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
					{DEV_TOOLS.map((tool) => (
						<div key={tool.key} className="schema-dev-tool-tile">
							<div className="kg-glance-icon">
								<i className={`adminfont-${tool.icon}`} />
							</div>
							<div>
								<div className="kg-check-title">{tool.title}</div>
								<div className="kg-check-desc">{tool.desc}</div>
							</div>
						</div>
					))}
				</div>
				{!result && (
					<ModuleGuardComponent
						icon="info"
						title={__('Inspect a page above to try these tools', 'vulopilot')}
						desc={__(
							'Every tool here runs against whatever real page you inspect — nothing is simulated.',
							'vulopilot'
						)}
					/>
				)}
			</CardComponent>
		</ColumnComponent>
	);
};

export default InspectorSection;
