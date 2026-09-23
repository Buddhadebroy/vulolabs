/* global appLocalizer */
import { useRef } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	FormGroupComponent,
	FormGroupWrapperComponent,
	NoticeComponent,
	NoticeManager,
	SectionComponent,
} from '@zyra/components';
import { MultiCheckboxInput, SelectInput, TextInput } from '@zyra/inputs';
import { useSetting } from '../../../contexts/SettingContext';
import SitemapHowItWorksCard from './SitemapHowItWorksCard';

/**
 * Settings → SEO → Sitemap.
 *
 * Hand-built `PanelComponent` (Sitemap.ts's own escape hatch, same
 * mechanism SeoTitlesPanel.tsx uses - see that file's own docblock),
 * replacing the former plain declarative `modal` (InputRenderer) - same
 * real `sitemap_*`/`html_sitemap_*` keys and same `id: 'sitemap'`
 * throughout, unchanged backend (Controllers\RobotsSitemap/
 * Services\SitemapGenerator/Services\HtmlSitemapRenderer), only how the
 * fields are rendered/saved changed: real per-field autosave via
 * `useSetting()` + `handleSettingChange()`/`scheduleSave()` (same
 * immediate-vs-debounced split SeoTitlesPanel.tsx's own
 * `handleSettingChange`/`scheduleSave` use - a checkbox/select autosaves
 * immediately, a free-text field debounces 1000ms after the last
 * keystroke) instead of InputRenderer's own per-field autosave.
 *
 * Every checkbox field here (`sitemap_enabled`, `sitemap_include_images`,
 * `sitemap_include_featured_images`, `html_sitemap_enabled`,
 * `html_sitemap_show_dates`, plus the two real multi-selects
 * `sitemap_xml_post_types`/`sitemap_xml_taxonomies`) was a real
 * `type: 'checkbox'` field before this rewrite, so its already-saved
 * value is a real array (empty, or containing the field's own key for a
 * single toggle) - `isChecked()`/`toArray()` below read and write that
 * exact same wire shape, not a plain string, so an existing site's saved
 * settings still mean the same thing after this rewrite.
 *
 * "Enable sitemap" gates everything below it (post types/taxonomies,
 * advanced settings, the whole HTML Sitemap section) via plain
 * conditional rendering now, same real gate the former declarative
 * `dependent: { key: 'sitemap_enabled', ... }` array enforced - every
 * HTML-Sitemap-specific field is additionally still gated on
 * `html_sitemap_enabled` too (an AND of both, same as before).
 *
 * 2-column layout (`ContainerComponent`/`ColumnComponent grid={8|4}`,
 * `SitemapHowItWorksCard` in the sidebar) - previously a `'sitemap' ===
 * currentTab` special case inside Settings.tsx's own `GetForm()`; moved
 * in here now that this tab has its own `PanelComponent` (checked before
 * that special case, so the two could never both apply at once).
 */
const SitemapPanel = () => {
	const { setting, updateSetting } = useSetting();

	const toArray = (value: unknown): string[] => (Array.isArray(value) ? (value as string[]) : []);
	const isChecked = (key: string): boolean => toArray(setting[key]).includes(key);

	const handleSettingChange = (key: string, value: unknown) => {
		updateSetting(key, value);
		sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'settings'), {
			setting: { [key]: value },
		});
	};

	// "Stop typing, then save" debounce - same shape SeoTitlesPanel.tsx's
	// own `AUTOSAVE_DEBOUNCE_MS`/`scheduleSave()` use, rather than saving
	// every keystroke or requiring an explicit "Save Changes" click.
	const AUTOSAVE_DEBOUNCE_MS = 1000;
	const saveTimerRef = useRef<Record<string, ReturnType<typeof setTimeout> | null>>({});

	const scheduleSave = (key: string, value: unknown) => {
		updateSetting(key, value);

		if (saveTimerRef.current[key]) {
			clearTimeout(saveTimerRef.current[key] as ReturnType<typeof setTimeout>);
		}

		saveTimerRef.current[key] = setTimeout(() => {
			sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'settings'), {
				setting: { [key]: value },
			}).then((response) => {
				if (!response) {
					NoticeManager.add({
						uniqueKey: 'vulopilot-sitemap-save',
						type: 'error',
						position: 'float',
						message: __('Could not save sitemap settings. Please try again.', 'vulopilot'),
					});
				}
			});
		}, AUTOSAVE_DEBOUNCE_MS);
	};

	const sitemapEnabled = isChecked('sitemap_enabled');
	const htmlSitemapEnabled = isChecked('html_sitemap_enabled');
	const sitemapIncludeImages = isChecked('sitemap_include_images');

	/**
	 * The 4 real post types every site has, plus - per direct instruction -
	 * any real custom post type this site actually has registered
	 * (`appLocalizer.sitemap_custom_post_types`,
	 * FrontendScripts::get_sitemap_custom_post_types()), so a site running
	 * a theme/plugin that registers its own post type (e.g. "Portfolio
	 * Items") can include it in the sitemap from this same list instead of
	 * it being impossible to check on from the UI. Empty array on a site
	 * with no custom post types, same as before.
	 */
	const POST_TYPE_OPTIONS = [
		{ key: 'post', label: __('Posts', 'vulopilot'), value: 'post' },
		{ key: 'page', label: __('Pages', 'vulopilot'), value: 'page' },
		{ key: 'attachment', label: __('Media', 'vulopilot'), value: 'attachment' },
		{ key: 'product', label: __('Products', 'vulopilot'), value: 'product' },
		...(appLocalizer.sitemap_custom_post_types ?? []).map((postType) => ({
			key: postType.value,
			label: postType.label,
			value: postType.value,
		})),
	];

	const TAXONOMY_OPTIONS = [
		{ key: 'category', label: __('Categories', 'vulopilot'), value: 'category' },
		{ key: 'post_tag', label: __('Tags', 'vulopilot'), value: 'post_tag' },
		{ key: 'product_cat', label: __('Product Categories', 'vulopilot'), value: 'product_cat' },
		{ key: 'product_tag', label: __('Product Tags', 'vulopilot'), value: 'product_tag' },
	];

	const DISPLAY_FORMAT_OPTIONS = [
		{ label: __('List', 'vulopilot'), value: 'list' },
		{ label: __('Grid', 'vulopilot'), value: 'grid' },
	];

	const SORT_BY_OPTIONS = [
		{ label: __('Published Date', 'vulopilot'), value: 'published_date' },
		{ label: __('Modified Date', 'vulopilot'), value: 'modified_date' },
		{ label: __('Title', 'vulopilot'), value: 'title' },
	];

	const ITEM_TITLES_OPTIONS = [
		{ label: __('Post/Term Titles', 'vulopilot'), value: 'post_title' },
		{ label: __('SEO Titles', 'vulopilot'), value: 'seo_title' },
	];

	/** Single-option `look="toggle"` switch - same shape
	 * DeveloperToolsPanel.tsx's own "Anonymous usage data"/
	 * EnableAutomationModuleAction.tsx's module toggle use. Wrapped in
	 * `FormGroupComponent` rather than relying on `MultiCheckboxInput`'s
	 * own `option.label`, which the toggle look swallows visually (same
	 * real reason those two callers wrap it too). */
	const renderToggle = (key: string, label: string, desc?: string) => (
		<FormGroupComponent row label={label} desc={desc}>
			<MultiCheckboxInput
				look="toggle"
				modules={[]}
				options={[{ key, value: key, label: '' }]}
				value={isChecked(key) ? [key] : []}
				onChange={(value) => handleSettingChange(key, value)}
				toggleStatusLabel={{
					on: __('Enabled', 'vulopilot'),
					off: __('Disabled', 'vulopilot'),
				}}
			/>
		</FormGroupComponent>
	);

	return (
		<div className="site-identity-title-formats">
			<SectionComponent
				icon="editor-list"
				title={__('XML Sitemap', 'vulopilot')}
				desc={__('A machine-readable file listing your site pages, for search engines. Turn this on and VuloPilot notifies search engines automatically whenever it changes.',
					'vulopilot'
				)}
				rightContent={
					<MultiCheckboxInput
						look="toggle"
						modules={[]}
						options={[{ key: 'sitemap_enabled', value: 'sitemap_enabled', label: '' }]}
						value={sitemapEnabled ? ['sitemap_enabled'] : []}
						onChange={(value) => handleSettingChange('sitemap_enabled', value)}
						toggleStatusLabel={{
							on: __('Enabled', 'vulopilot'),
							off: __('Disabled', 'vulopilot'),
						}}
					/>
				}
			/>

			{sitemapEnabled && (
				<>
					<ContainerComponent>
						<ColumnComponent grid={8}>
							<CardComponent
								title={__('What is included', 'vulopilot')}
								titleIcon="category"
								desc={__(
									'Choose which content and terms appear in your XML sitemap and the [vulopilot_html_sitemap] shortcode below.',
									'vulopilot'
								)}
							>
								<FormGroupWrapperComponent>
									<FormGroupComponent row label={__('Post types in sitemap', 'vulopilot')}>
										<MultiCheckboxInput
											modules={[]}
											selectDeselect
											options={POST_TYPE_OPTIONS}
											value={toArray(setting.sitemap_xml_post_types)}
											onChange={(value) => handleSettingChange('sitemap_xml_post_types', value)}
										/>
									</FormGroupComponent>
									<FormGroupComponent row label={__('Taxonomies in sitemap', 'vulopilot')}>
										<MultiCheckboxInput
											modules={[]}
											selectDeselect
											options={TAXONOMY_OPTIONS}
											value={toArray(setting.sitemap_xml_taxonomies)}
											onChange={(value) => handleSettingChange('sitemap_xml_taxonomies', value)}
										/>
									</FormGroupComponent>
								</FormGroupWrapperComponent>
							</CardComponent>

							<CardComponent
								title={__('Advanced settings', 'vulopilot')}
								titleIcon="editor-list"
								desc={__(
									'Fine-tune size, exclusions, and images for large or complex sites.',
									'vulopilot'
								)}
							>
								<FormGroupWrapperComponent>
									<FormGroupComponent
										row
										label={__('Links per sitemap', 'vulopilot')}
										desc={__('Max number of links on each sitemap page.', 'vulopilot')}
									>
										<TextInput
											type="number"
											size={10}
											value={(setting.sitemap_links_per_page as number) ?? ''}
											onChange={(value) => scheduleSave('sitemap_links_per_page', value)}
										/>
									</FormGroupComponent>
									<FormGroupComponent
										row
										label={__('Exclude posts', 'vulopilot')}
										desc={__(
											'Post IDs to exclude from the sitemap, separated by commas. Applies across all included post types.',
											'vulopilot'
										)}
									>
										<TextInput
											size={10}
											value={(setting.sitemap_exclude_posts as string) ?? ''}
											onChange={(value) => scheduleSave('sitemap_exclude_posts', String(value))}
										/>
									</FormGroupComponent>
									<FormGroupComponent
										row
										label={__('Exclude terms', 'vulopilot')}
										desc={__(
											'Term IDs to exclude, separated by commas. Applies across all included taxonomies.',
											'vulopilot'
										)}
									>
										<TextInput
											size={10}
											value={(setting.sitemap_exclude_terms as string) ?? ''}
											onChange={(value) => scheduleSave('sitemap_exclude_terms', String(value))}
										/>
									</FormGroupComponent>
									{renderToggle(
										'sitemap_include_images',
										__('Images in sitemaps', 'vulopilot'),
										__(
											"Include references to images from the post content in sitemaps - this helps search engines index the important images on your pages.",
											'vulopilot'
										)
									)}
									{sitemapIncludeImages &&
										renderToggle(
											'sitemap_include_featured_images',
											__('Include featured images', 'vulopilot'),
											__(
												"Include the featured image too, even if it doesn't appear directly in the post content.",
												'vulopilot'
											)
										)}
								</FormGroupWrapperComponent>
							</CardComponent>

							<CardComponent
								title={__('HTML Sitemap', 'vulopilot')}
								titleIcon="web-page-website"
								desc={__(
									'A human-readable page listing every included post, page, and taxonomy term.',
									'vulopilot'
								)}
							>
								<FormGroupWrapperComponent>
									{renderToggle(
										'html_sitemap_enabled',
										__('Enable HTML sitemap', 'vulopilot'),
										__(
											'A human-readable page listing every included post, page, and taxonomy term.',
											'vulopilot'
										)
									)}

									{htmlSitemapEnabled && (
										<>
										<NoticeComponent
												displayPosition="inline-notice"
												type="info"
												message={__(
													'Use this shortcode to display the HTML sitemap anywhere on your site: <code>[vulopilot_html_sitemap] </code>',
													'vulopilot'
												)}
											/>
											<FormGroupComponent
												row
												label={__('Display format', 'vulopilot')}
												desc={__('How you want to display the HTML sitemap.', 'vulopilot')}
											>
												<SelectInput
													size={10}
													options={DISPLAY_FORMAT_OPTIONS}
													value={(setting.html_sitemap_display_format as string) ?? 'list'}
													isClearable={false}
													onChange={(value) =>
														handleSettingChange('html_sitemap_display_format', value)
													}
												/>
											</FormGroupComponent>
											<FormGroupComponent
												row
												label={__('Sort by', 'vulopilot')}
												desc={__('How to sort the items in the HTML sitemap.', 'vulopilot')}
											>
												<SelectInput
													size={15}
													options={SORT_BY_OPTIONS}
													value={(setting.html_sitemap_sort_by as string) ?? 'published_date'}
													isClearable={false}
													onChange={(value) => handleSettingChange('html_sitemap_sort_by', value)}
												/>
											</FormGroupComponent>
											{renderToggle(
												'html_sitemap_show_dates',
												__('Show dates', 'vulopilot'),
												__('Show published dates for each post & page.', 'vulopilot')
											)}
											<FormGroupComponent
												row
												label={__('Item titles', 'vulopilot')}
												desc={__(
													'Show the post/term titles, or the SEO titles, in the HTML sitemap.',
													'vulopilot'
												)}
											>
												<SelectInput
													size={15}
													options={ITEM_TITLES_OPTIONS}
													value={(setting.html_sitemap_item_titles as string) ?? 'post_title'}
													isClearable={false}
													onChange={(value) =>
														handleSettingChange('html_sitemap_item_titles', value)
													}
												/>
											</FormGroupComponent>
										</>
									)}
								</FormGroupWrapperComponent>
							</CardComponent>
						</ColumnComponent>

						<ColumnComponent grid={4}>
							<SitemapHowItWorksCard />
						</ColumnComponent>
					</ContainerComponent>
				</>
			)}
		</div>
	);
};

export default SitemapPanel;
