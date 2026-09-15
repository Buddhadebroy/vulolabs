/* global appLocalizer */
import { useEffect, useMemo, useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import {
	BadgeComponent,
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	FormGroupComponent,
	FormGroupWrapperComponent,
	ListComponent,
	NoticeComponent,
	NoticeManager,
} from '@zyra/components';
import { ButtonInput, TextInput, ToggleInput } from '@zyra/inputs';
import { TableCard } from '@zyra/table';
import { useSetting } from '../../../contexts/SettingContext';
import './TitleFormatsPanel.scss';

type BadgeClass = 'green' | 'info' | 'red';

interface ContextConfig {
	key: string;
	templateKey: string;
	descriptionTemplateKey: string;
	icon: string;
	label: string;
	urlExample: string;
	vars: Record<string, string>;
	hasRealUrl: boolean;
}

interface LengthScore {
	length: number;
	max: number;
	label: string;
	cls: BadgeClass;
}

interface PreviewRow extends ContextConfig {
	resolvedTitle: string;
	titleScore: LengthScore;
	resolvedDescription: string;
	descriptionScore: LengthScore;
}

/** The 9 tokens Services\TitleFormatter::VARIABLES resolves (`%sep%` plus 8). */
const VARIABLES: Array<{ token: string; label: string }> = [
	{ token: '%site_title%', label: __('Your website title', 'vulopilot') },
	{ token: '%site_description%', label: __('Your website description', 'vulopilot') },
	{ token: '%post_title%', label: __('Post title', 'vulopilot') },
	{ token: '%page_title%', label: __('Page title', 'vulopilot') },
	{ token: '%category_title%', label: __('Category title', 'vulopilot') },
	{ token: '%tag_title%', label: __('Tag title', 'vulopilot') },
	{ token: '%search_term%', label: __('Search term', 'vulopilot') },
	{ token: '%archive_title%', label: __('Archive title', 'vulopilot') },
	{ token: '%sep%', label: __('Separator (e.g. | – -)', 'vulopilot') },
];

/**
 * Same token-replacement + leading/trailing-separator-trim logic as
 * Services\TitleFormatter::resolve() (PHP) — kept as a parallel
 * implementation rather than a shared module since the two run in
 * different languages/runtimes; if one changes, the other needs the same
 * change by hand.
 */
const resolveTemplate = (template: string, vars: Record<string, string>, separator: string): string => {
	const resolved = template.replace(/%([a-z_]+)%/g, (_match, token: string) => {
		if ('sep' === token) {
			return separator;
		}
		return vars[token] ?? '';
	});

	const sep = separator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const trimmed = resolved
		.replace(new RegExp(`\\s*${sep}\\s*$`), '')
		.replace(new RegExp(`^\\s*${sep}\\s*`), '');

	return trimmed.trim();
};

/**
 * Length-based heuristic, graded against real, already-established
 * thresholds elsewhere in this codebase rather than an invented number —
 * `TITLE_MAX_LENGTH` (60) matches SnippetPreview.tsx/Services\OnPageAnalyzer's
 * own title truncation point; `DESCRIPTION_MIN_LENGTH`/`DESCRIPTION_MAX_LENGTH`
 * (120/160) match `Services\OnPageAnalyzer::DESCRIPTION_MIN_LENGTH`/
 * `DESCRIPTION_MAX_LENGTH`, which itself reuses `WriteMetaDescriptionAction::MAX_LENGTH`.
 * Displayed as a plain "N/max" character count (not an invented 0-80 score)
 * so the number means something a site owner can act on directly.
 */
const scoreLength = (text: string, max: number, min = 0): LengthScore => {
	const length = text.trim().length;

	if (0 === length) {
		return { length, max, label: __('Empty', 'vulopilot'), cls: 'red' };
	}

	let cls: BadgeClass;
	let label: string;

	if (min > 0 && length < min) {
		cls = 'red';
		label = __('Too short', 'vulopilot');
	} else if (length <= max) {
		cls = 'green';
		label = __('Good', 'vulopilot');
	} else {
		cls = 'info';
		label = __('Too long', 'vulopilot');
	}

	return { length, max, label, cls };
};

const TITLE_MAX_LENGTH = 60;
const TITLE_MIN_LENGTH = 30;
const DESCRIPTION_MIN_LENGTH = 120;
const DESCRIPTION_MAX_LENGTH = 160;

/** Same real `urlExample` every row already carries, reformatted as a plain "domain › path › segments" breadcrumb (Google's own real search-result URL styling) instead of a raw `http://…` string — matches the search-result-snippet look the rest of this row's preview block (resolved title/desc) is already going for. */
const toBreadcrumb = (urlExample: string): string =>
	urlExample
		.replace(/^https?:\/\//, '')
		.split('/')
		.filter(Boolean)
		.join(' › ');

/**
 * Settings → Site Identity → Title Formats.
 *
 * Real backend: Services\TitleFormatter filters `pre_get_document_title`
 * with whichever `title_format_*` template matches the current frontend
 * request's context (home/post/page/category/tag/search/archive), and
 * echoes a real `<meta name="description">` on `wp_head` from the
 * matching `description_format_*` template — both gated on
 * `site_identity_enabled` — see that class's own docblock, including why
 * `post`/`page` descriptions defer to a real `post_excerpt` first when one
 * exists. This panel is a hand-built `PanelComponent` escape hatch
 * (TitleFormats.ts, same mechanism GetStarted/SiteVerification.ts already
 * uses) rather than InputRenderer, since it needs a live, client-computed
 * preview across 14 interdependent template fields at once — something
 * InputRenderer's own per-field declarative shape doesn't support, even
 * though every field here still autosaves the same way InputRenderer's
 * own fields do.
 *
 * "Enable Site Identity" autosaves immediately on change (same
 * `handleSettingChange` shape DeveloperToolsPanel.tsx's own two toggles
 * use) — a real `ToggleInput` two-button switch (Enabled/Disabled), not a
 * `SelectInput` dropdown, matching every other on/off setting in this
 * codebase. The 14 template fields + separator autosave too, per direct
 * instruction ("remove the save changes button this is autosave") —
 * `scheduleTemplateSave()` debounces 1000ms after the last keystroke
 * (same "stop typing, then save" shape BackupStoragePanel.tsx's own
 * `AUTOSAVE_DEBOUNCE_MS`/CrawlRobotsSitemapSection.tsx's own
 * `handleRobotsContentChange` already use) rather than saving every
 * keystroke, and rather than requiring an explicit "Save Changes" click.
 *
 * Built entirely from real `@zyra/components`/`@zyra/inputs` exports
 * rather than hand-rolled markup — `CardComponent`'s own real `toggle`/
 * `defaultExpanded` props (confirmed by reading the installed zyra bundle)
 * are what actually drive "Title & Description Format Templates"' expand/
 * collapse, not locally-tracked state; `ListComponent`'s real
 * `items[].tags`/`.desc` slots (both accept arbitrary ReactNode, same as
 * CrawlRobotsSitemapSection.tsx's own sitemap list already relies on)
 * carry the Live Title Preview rows' badge/length/View-button and
 * url/title/description block, and the Available Variables/SEO Tips
 * sidebar cards are `ListComponent` too (`items[].action` for
 * click-to-copy). `ContainerComponent`/`ColumnComponent grid={8|4}` is the
 * same 12-column layout primitive used throughout GEO's own tabs, in
 * place of a hand-rolled 2-column flex div. The 14 template fields +
 * separator are `FormGroupWrapperComponent`/`FormGroupComponent` (the same
 * label+field row SiteVerificationPanel.tsx's own code fields already
 * use), not a hand-rolled label/div pair, and every status pill (Good/Too
 * short/Too long/"N/max") is a real `BadgeComponent` (`color`+`text`), not
 * a raw `<span className="admin-badge">`.
 *
 * The Live Title Preview's 7 rows use fixed sample values ("Sample Post
 * Title", "sample search", …) rather than real site content — this plugin
 * has no reason to fetch a real post/page/category/tag just to preview a
 * title format, and the mockup's own preview data is equally illustrative
 * (not live site content either). Only the Homepage row is real (real
 * site title/tagline/URL), so only it gets a real "View" link; the other
 * 6 rows don't pretend to link anywhere.
 *
 * No "How it works?"/"Need Help" (Watch Guide / Book a Free Call) — those
 * would need real destination URLs (a demo video, a booking page) that
 * don't exist anywhere in this codebase; omitted rather than fabricated.
 */
const TitleFormatsPanel = () => {
	const { setting, updateSetting } = useSetting();

	const [separator, setSeparator] = useState<string>('|');
	/** Which real context row's own Edit action opened the right-side edit panel — `null` shows the default Available Variables/Preview in Google/SEO Tips sidebar instead (same "table + detail panel" structure IssueDetailPanel.tsx's own Issues table already establishes). */
	const [editingKey, setEditingKey] = useState<string | null>(null);

	const contexts = useMemo<ContextConfig[]>(() => {
		const siteTitle = appLocalizer.site_title || __('Your Site', 'vulopilot');
		const siteDescription = appLocalizer.site_description || __('A short description of your website.', 'vulopilot');
		const siteUrl = (appLocalizer.site_url || '').replace(/\/$/, '');
		const now = new Date();
		const archiveDatePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}`;
		const archiveLabel = now.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

		return [
			{
				key: 'home',
				templateKey: 'title_format_home',
				descriptionTemplateKey: 'description_format_home',
				icon: 'web-page-website',
				label: __('Homepage', 'vulopilot'),
				urlExample: `${siteUrl}/`,
				vars: { site_title: siteTitle, site_description: siteDescription },
				hasRealUrl: true,
			},
			{
				key: 'post',
				templateKey: 'title_format_post',
				descriptionTemplateKey: 'description_format_post',
				icon: 'document',
				label: __('Blog Post', 'vulopilot'),
				urlExample: `${siteUrl}/blog/sample-post`,
				vars: { site_title: siteTitle, site_description: siteDescription, post_title: __('Sample Post Title', 'vulopilot') },
				hasRealUrl: false,
			},
			{
				key: 'page',
				templateKey: 'title_format_page',
				descriptionTemplateKey: 'description_format_page',
				icon: 'document',
				label: __('Page', 'vulopilot'),
				urlExample: `${siteUrl}/sample-page`,
				vars: { site_title: siteTitle, site_description: siteDescription, page_title: __('Sample Page Title', 'vulopilot') },
				hasRealUrl: false,
			},
			{
				key: 'category',
				templateKey: 'title_format_category',
				descriptionTemplateKey: 'description_format_category',
				icon: 'module',
				label: __('Category', 'vulopilot'),
				urlExample: `${siteUrl}/category/sample`,
				vars: { site_title: siteTitle, site_description: siteDescription, category_title: __('Sample Category', 'vulopilot') },
				hasRealUrl: false,
			},
			{
				key: 'tag',
				templateKey: 'title_format_tag',
				descriptionTemplateKey: 'description_format_tag',
				icon: 'link',
				label: __('Tag', 'vulopilot'),
				urlExample: `${siteUrl}/tag/sample`,
				vars: { site_title: siteTitle, site_description: siteDescription, tag_title: __('Sample Tag', 'vulopilot') },
				hasRealUrl: false,
			},
			{
				key: 'search',
				templateKey: 'title_format_search',
				descriptionTemplateKey: 'description_format_search',
				icon: 'search',
				label: __('Search Results', 'vulopilot'),
				urlExample: `${siteUrl}/?s=sample+search`,
				vars: { site_title: siteTitle, site_description: siteDescription, search_term: __('sample search', 'vulopilot') },
				hasRealUrl: false,
			},
			{
				key: 'archive',
				templateKey: 'title_format_archive',
				descriptionTemplateKey: 'description_format_archive',
				icon: 'analytics',
				label: __('Archive', 'vulopilot'),
				urlExample: `${siteUrl}/${archiveDatePath}`,
				vars: { site_title: siteTitle, site_description: siteDescription, archive_title: archiveLabel },
				hasRealUrl: false,
			},
		];
	}, []);

	const [templateValues, setTemplateValues] = useState<Record<string, string>>({});

	// Settings.tsx's own GetForm() seeds SettingContext with this tab's real
	// values (from `modal[].key`) as a render-phase `setSetting()` call, not
	// before this component's own first mount — a `useState(() => ...)`
	// lazy initializer reading `setting` here would capture whatever was in
	// context on that first, not-yet-seeded pass and never update again
	// (lazy initializers only run once). Hydrating once via this effect,
	// gated on `title_format_home` actually being present, avoids depending
	// on exactly which render pass this component's mount happens to land
	// on — and `hydratedRef` keeps it from firing again and clobbering the
	// user's own in-progress edits once "Title Format Templates" is open.
	const hydratedRef = useRef(false);

	useEffect(() => {
		if (hydratedRef.current || undefined === setting.title_format_home) {
			return;
		}

		hydratedRef.current = true;
		setSeparator((setting.title_separator as string) || '|');

		const initial: Record<string, string> = {};
		contexts.forEach((ctx) => {
			initial[ctx.templateKey] = (setting[ctx.templateKey] as string) ?? '';
			initial[ctx.descriptionTemplateKey] = (setting[ctx.descriptionTemplateKey] as string) ?? '';
		});
		setTemplateValues(initial);
	}, [setting, contexts]);

	const enabled = (setting.site_identity_enabled as string) || 'enabled';

	const handleSettingChange = (key: string, value: string) => {
		updateSetting(key, value);
		sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'settings'), {
			setting: { [key]: value },
		});
	};

	// "Stop typing, then save" debounce — same shape BackupStoragePanel.tsx's
	// own `AUTOSAVE_DEBOUNCE_MS`/CrawlRobotsSitemapSection.tsx's own
	// `handleRobotsContentChange` already use, rather than saving every
	// keystroke or requiring an explicit "Save Changes" click.
	const AUTOSAVE_DEBOUNCE_MS = 1000;
	const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const persistTemplates = (nextTemplateValues: Record<string, string>, nextSeparator: string) => {
		const payload: Record<string, string> = { title_separator: nextSeparator, ...nextTemplateValues };

		sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'settings'), { setting: payload }).then(
			(response) => {
				Object.entries(payload).forEach(([key, value]) => updateSetting(key, value));

				if (!response) {
					NoticeManager.add({
						uniqueKey: 'vulopilot-title-formats-save',
						type: 'error',
						position: 'float',
						message: __('Could not save title and description formats. Please try again.', 'vulopilot'),
					});
				}
			}
		);
	};

	const scheduleSave = (nextTemplateValues: Record<string, string>, nextSeparator: string) => {
		if (saveTimerRef.current) {
			clearTimeout(saveTimerRef.current);
		}
		saveTimerRef.current = setTimeout(
			() => persistTemplates(nextTemplateValues, nextSeparator),
			AUTOSAVE_DEBOUNCE_MS
		);
	};

	const handleTemplateChange = (key: string, value: string) => {
		setTemplateValues((prev) => {
			const next = { ...prev, [key]: value };
			scheduleSave(next, separator);
			return next;
		});
	};

	const handleSeparatorChange = (value: string) => {
		setSeparator(value);
		scheduleSave(templateValues, value);
	};

	/** Appends a real `%token%` to whichever field's own pill row was clicked — the edit panel's own "click a variable to insert it" affordance, in place of the old sidebar's plain click-to-copy-to-clipboard behavior (still real for the non-editing sidebar below). */
	const insertToken = (key: string, token: string) => {
		const current = templateValues[key] ?? '';
		handleTemplateChange(key, current ? `${current} ${token}` : token);
	};

	const previewRows = useMemo<PreviewRow[]>(
		() =>
			contexts.map((ctx) => {
				const resolvedTitle = resolveTemplate(templateValues[ctx.templateKey] ?? '', ctx.vars, separator || '|');
				const resolvedDescription = resolveTemplate(
					templateValues[ctx.descriptionTemplateKey] ?? '',
					ctx.vars,
					separator || '|'
				);
				return {
					...ctx,
					resolvedTitle,
					titleScore: scoreLength(resolvedTitle, TITLE_MAX_LENGTH, TITLE_MIN_LENGTH),
					resolvedDescription,
					descriptionScore: scoreLength(resolvedDescription, DESCRIPTION_MAX_LENGTH, DESCRIPTION_MIN_LENGTH),
				};
			}),
		[contexts, templateValues, separator]
	);

	const handleValidate = () => {
		const counts = previewRows.reduce(
			(acc, row) => {
				acc[row.titleScore.cls] += 1;
				acc[row.descriptionScore.cls] += 1;
				return acc;
			},
			{ green: 0, info: 0, red: 0 } as Record<BadgeClass, number>
		);

		const needsAttention = counts.red + counts.info;
		const totalChecked = previewRows.length * 2;

		NoticeManager.add({
			uniqueKey: 'vulopilot-title-formats-validate',
			type: counts.red > 0 ? 'error' : counts.info > 0 ? 'info' : 'success',
			position: 'float',
			message:
				needsAttention > 0
					? sprintf(
							/* translators: 1: number of titles/descriptions that could use improvement, 2: total number of titles and descriptions previewed. */
							__('%1$d of %2$d titles/descriptions could use improvement — check the highlighted rows below.', 'vulopilot'),
							needsAttention,
							totalChecked
						)
					: __('All title and description formats look good.', 'vulopilot'),
		});
	};

	const handleCopyVariable = (token: string) => {
		if (!navigator.clipboard) {
			return;
		}

		navigator.clipboard
			.writeText(token)
			.then(() => {
				NoticeManager.add({
					uniqueKey: 'vulopilot-title-formats-copy',
					type: 'success',
					position: 'float',
					message: sprintf(
						/* translators: %s is the variable token, e.g. %post_title%. */
						__('Copied %s to clipboard.', 'vulopilot'),
						token
					),
				});
			})
			.catch(() => {
				NoticeManager.add({
					uniqueKey: 'vulopilot-title-formats-copy',
					type: 'error',
					position: 'float',
					message: __('Could not copy to clipboard.', 'vulopilot'),
				});
			});
	};

	const variableListItems = VARIABLES.map((item) => ({
		id: item.token,
		title: item.token,
		desc: item.label,
		className: 'site-identity-variable-item',
		action: () => handleCopyVariable(item.token),
	}));

	const seoTipsItems = [
		__('Keep titles between 30–60 characters for optimal SEO.', 'vulopilot'),
		__('Keep descriptions between 120–160 characters — Google truncates longer ones.', 'vulopilot'),
		__('Include your target keyword near the beginning.', 'vulopilot'),
		__('Make titles and descriptions descriptive and compelling for users.', 'vulopilot'),
		__('Use a consistent separator across your site.', 'vulopilot'),
	].map((tip, index) => ({ id: String(index), title: tip }));

	const editingRow = previewRows.find((row) => row.key === editingKey) ?? null;

	/**
	 * One real `%token%` field + its own "click to insert" pill row + a real
	 * length `BadgeComponent` — reused for both Title format and Description
	 * format below, the two fields the edit panel's own docblock ("image 5
	 * like variables") describes.
	 */
	const renderTemplateField = (
		label: string,
		key: string,
		score: LengthScore
	) => (
		<FormGroupComponent label={label} htmlFor={`${key}-edit-input`}>
			<TextInput
				id={`${key}-edit-input`}
				value={templateValues[key] ?? ''}
				onChange={(value) => handleTemplateChange(key, String(value))}
			/>
			<div className="site-identity-edit-variable-pills">
				{VARIABLES.map((item) => (
					<BadgeComponent
						key={item.token}
						color="purple"
						text={sprintf(
							/* translators: %s: a real template variable's own short label, e.g. "Post title". */
							__('+ %s', 'vulopilot'),
							item.label
						)}
						onClick={() => insertToken(key, item.token)}
					/>
				))}
			</div>
			<BadgeComponent color={score.cls} text={`${score.length}/${score.max}`} />
		</FormGroupComponent>
	);

	return (
		<div className="site-identity-title-formats">
			<CardComponent
				title={__('Enable Site Identity', 'vulopilot')}
				desc={__('Use the configured title and description formats across your site.', 'vulopilot')}
				action={
					<>
						<ToggleInput
							value={enabled}
							modules={[]}
							options={[
								{ label: __('Enabled', 'vulopilot'), value: 'enabled' },
								{ label: __('Disabled', 'vulopilot'), value: 'disabled' },
							]}
							onChange={(value) => handleSettingChange('site_identity_enabled', value as string)}
						/>
						<ButtonInput
							buttons={{
								text: __('Validate Titles & Descriptions', 'vulopilot'),
								color: 'border-purple',
								icon: 'check',
								onClick: handleValidate,
							}}
						/>
					</>
				}
			/>

			<ContainerComponent>
				<ColumnComponent grid={8}>
					<CardComponent
						title={__('Title & Description Format Templates', 'vulopilot')}
						titleIcon="setting"
						desc={__(
							'Customize title and description formats using dynamic variables like %site_title%, %post_title%, %site_description%, etc.',
							'vulopilot'
						)}
					>
						<FormGroupWrapperComponent>
							<FormGroupComponent label={__('Separator', 'vulopilot')} htmlFor="title-separator-input">
								<TextInput
									id="title-separator-input"
									value={separator}
									onChange={(value) => handleSeparatorChange(String(value))}
									placeholder="|"
								/>
							</FormGroupComponent>
						</FormGroupWrapperComponent>

						{/* One real row per context — real Google-snippet-style
						preview (breadcrumb/title/desc, same values the old
						separate "Live Title Preview" card computed) + a real
						content-type badge + this row's own real raw template
						string, with a real "Edit" action opening the right-side
						panel below instead of every field being hand-edited
						inline in one big 16-field grid. */}
						<TableCard
							showMenu={false}
							hideHeader={true}
							variant="transparent"
							headers={{
								preview: {
									label: __('Format', 'vulopilot'),
									width: '80%',
									render: (row: PreviewRow) => (
										<div className="site-identity-row-preview">
											<BadgeComponent color="indigo" text={row.label} />
											<div className="site-identity-row-breadcrumb">
												{toBreadcrumb(row.urlExample)}
											</div>
											<div className="site-identity-row-title">
												{row.resolvedTitle || __('(Empty — add a title format)', 'vulopilot')}
											</div>
											<div className="site-identity-row-desc">
												{row.resolvedDescription || __('(Empty — add a description format)', 'vulopilot')}
											</div>
											<div className="site-identity-row-raw">
												{templateValues[row.templateKey] || ''}
											</div>
											<div className="site-identity-row-tags">
												<BadgeComponent color={row.titleScore.cls} text={row.titleScore.label} />
												<BadgeComponent color="indigo" text={`${row.titleScore.length}/${row.titleScore.max}`} />
												<BadgeComponent color={row.descriptionScore.cls} text={row.descriptionScore.label} />
												<BadgeComponent color="indigo" text={`${row.descriptionScore.length}/${row.descriptionScore.max}`} />
												{row.hasRealUrl && (
													<ButtonInput
														buttons={{
															text: __('View', 'vulopilot'),
															color: 'border-purple',
															onClick: () => window.open(appLocalizer.site_url, '_blank', 'noopener'),
														}}
													/>
												)}
											</div>
										</div>
									),
								},
								action: {
									label: __('Action', 'vulopilot'),
									type: 'action',
									actions: [
										{
											label: __('Edit', 'vulopilot'),
											type: 'button',
											icon: 'edit',
											color: 'text-purple',
											onClick: (row) =>
												setEditingKey((row as unknown as PreviewRow).key),
										},
									],
								},
							}}
							rows={previewRows}
							ids={previewRows.map((row) => row.key)}
							totalRows={previewRows.length}
							isLoading={false}
							activeRowId={editingKey ?? undefined}
						/>
					</CardComponent>
				</ColumnComponent>

				<ColumnComponent grid={4}>
					{editingRow ? (
						<CardComponent
							title={sprintf(
								/* translators: %s: the real content type being edited, e.g. "Homepage". */
								__('%s Format', 'vulopilot'),
								editingRow.label
							)}
							titleIcon={editingRow.icon}
							action={
								<i
									className="adminfont-close"
									role="button"
									tabIndex={0}
									onClick={() => setEditingKey(null)}
									onKeyDown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											setEditingKey(null);
										}
									}}
								/>
							}
						>
							<FormGroupWrapperComponent>
								{renderTemplateField(
									__('Title format', 'vulopilot'),
									editingRow.templateKey,
									editingRow.titleScore
								)}
								{renderTemplateField(
									__('Description format', 'vulopilot'),
									editingRow.descriptionTemplateKey,
									editingRow.descriptionScore
								)}
							</FormGroupWrapperComponent>
						</CardComponent>
					) : (
						<>
							<CardComponent
								title={__('Available Variables', 'vulopilot')}
								desc={__('Click to copy and use in your title formats.', 'vulopilot')}
							>
								<ListComponent className="site-identity-variables-list" items={variableListItems} />
							</CardComponent>

							<NoticeComponent
								displayPosition="inline-notice"
								type="info"
								title={__('Preview in Google', 'vulopilot')}
								message={__(
									'These previews show an estimate of how your titles may appear in Google search results. Actual display can vary by device and search context.',
									'vulopilot'
								)}
							/>

							<CardComponent title={__('SEO Tips', 'vulopilot')}>
								<ListComponent className="site-identity-tips-list" items={seoTipsItems} />
							</CardComponent>
						</>
					)}
				</ColumnComponent>
			</ContainerComponent>
		</div>
	);
};

export default TitleFormatsPanel;
