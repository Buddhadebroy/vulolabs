/**
 * Single source of truth for the "All SEO Issues" table's "Fix with AI"
 * deep link (`SeoIssuesByPageTable.tsx`) and the block-editor "VuloPilot
 * SEO" sidebar's own handling of it (`post-editor/index.tsx`). The table
 * builds `post.php?post={id}&action=edit&vulopilot_seo_issue={scannerId}`;
 * the editor reads that query param and looks it up here to decide which
 * tab to open and which field/checklist row to scroll to and highlight.
 *
 * Deliberately has no entry for scanner ids with no real editor-sidebar
 * equivalent (duplicate-content, orphan-pages, broken-links, sitemap,
 * sitemap-validation, robots-txt, ai-crawler-blocked-pages, multiple-h1,
 * meta-description-duplication, focus-keyword-audit) — the editor still
 * opens the sidebar for these (see post-editor/index.tsx), it just doesn't
 * pretend to highlight something that isn't there.
 */

export type SeoIssueEditorTab = 'general' | 'advanced' | 'social' | 'schema';

export interface SeoIssueEditorTarget {
	tab: SeoIssueEditorTab;
	/** OnPageAnalyzer check id (General tab) or field key (Advanced/Social) — absent for Schema, which has no sub-target. */
	target?: string;
}

export const SEO_ISSUE_EDITOR_TARGETS: Record<string, SeoIssueEditorTarget> = {
	seo: { tab: 'general', target: 'title_length' },
	'meta-description': { tab: 'general', target: 'description_length' },
	'thin-content': { tab: 'general', target: 'content_length' },
	'heading-structure': { tab: 'general', target: 'has_subheadings' },
	'seo-images': { tab: 'general', target: 'image_alt' },
	images: { tab: 'general', target: 'image_alt' },
	'internal-linking': { tab: 'general', target: 'has_links' },
	'canonical-url': { tab: 'advanced', target: 'canonical_url' },
	'open-graph': { tab: 'social', target: 'social_title' },
	'twitter-card': { tab: 'social', target: 'social_title' },
	schema: { tab: 'schema' },
	'structured-data': { tab: 'schema' },
	'sitewide-structured-data': { tab: 'schema' },
};

export const getEditorTargetForScanner = (
	scannerId: string
): SeoIssueEditorTarget | null => SEO_ISSUE_EDITOR_TARGETS[scannerId] ?? null;

/** Query-string param name the table and the editor both agree on. */
export const SEO_ISSUE_QUERY_PARAM = 'vulopilot_seo_issue';
