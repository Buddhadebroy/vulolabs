import { __ } from '@wordpress/i18n';

/** One real, toggleable module card — see this file's own docblock below for the id/category conventions every entry follows. */
export interface ModuleCatalogEntry {
	id: string;
	name: string;
	desc: string;
	proModule: boolean;
	category: string;
	miniModule?: boolean;
	freeFeatures?: string[];
	proFeatures?: string[];
	/**
	 * A real `adminfont-*` glyph (zyra's `packages/theme/src/fonts.scss`)
	 * for this module — NOT read by zyra's own ModuleGridComponent (its
	 * real card icon is hardcoded to `adminfont-${module.id}`, confirmed
	 * via its shipped source; none of these ids happen to be real glyph
	 * names, so every card on the actual Settings → Modules page renders
	 * with a blank icon today — a real, live bug, but in zyra itself, out
	 * of reach from this repo without a zyra-side fix). This field exists
	 * so at least Popup.tsx's own locked-feature popup (../Popup/Popup.tsx,
	 * which reads this catalog directly rather than going through
	 * ModuleGridComponent) can show a real icon instead of the same blank
	 * one.
	 */
	icon?: string;
}

/** A category-pill-bar heading, not a real module — `type: 'separator'` is how ModuleGridComponent (zyra) tells the two apart in one flat array. */
export interface ModuleCatalogSeparator {
	type: 'separator';
	id: string;
	label: string;
}

export type ModuleCatalogItem = ModuleCatalogEntry | ModuleCatalogSeparator;

export const isModuleCatalogEntry = (
	item: ModuleCatalogItem
): item is ModuleCatalogEntry => !('type' in item);

/**
 * Exactly the 13 modules from the user's own mockup (ModulesPanel.jsx),
 * same names/descriptions/free-pro copy verbatim — WooCommerce
 * (woo-commerce-ai/woo-commerce-intelligence), Reports (advanced-reports),
 * MCP Server, and the standalone "One-Click AI Fixes" Pro card that
 * previously existed here are all deliberately dropped to match the
 * mockup's own 13-card, 5-category list exactly, per explicit request.
 *
 * Every `id` is still a real backend module id wherever one exists (see
 * Modules.php::camel_to_kebab()) — the mockup's own ids (`geo`, `aeo`,
 * `ai-crawler`, `brand-visibility`, `seo-intelligence`, `accessibility-
 * scanner`, `ai-fixes`, `automation-engine`) don't match any real module,
 * so they're swapped for the real ones the same way every other card in
 * this file was already fixed this session. Two exceptions, called out on
 * their own cards below: 'redirect-manager' and 'performance-monitoring'
 * don't correspond to any real `modules/` folder (they're core, always-on
 * `Services/*.php` classes) — toggling those two is inert, same as before
 * this session touched this file, kept only because the mockup includes
 * them by name.
 */
const MODULES_CATALOG: { category: boolean; tab: string; modules: ModuleCatalogItem[] } = {
	category: true,
	tab: 'modules',
	modules: [
		// AI Visibility Section
		{ type: 'separator', id: 'ai-visibility', label: __('AI Visibility', 'vulopilot') },
		{
            /**
             * Must be the real backend module id — GeoInsights' folder name
             * kebab-cased. The free Geo module (id 'geo', auto-active on
             * install) has no separate card — same "always-on background
             * behavior" treatment every other free/Pro split module pair
             * gets in this file when the two don't share an id.
             */
            id: 'geo-insights',
            icon: 'global-community',
            name: __('GEO Radar — AI Understanding', 'vulopilot'),
            desc: __('Scans structure, entities, and machine-readability so AI models can understand your pages.', 'vulopilot'),
            proModule: true,
            category: 'ai-visibility',
            freeFeatures: [
                __('Structure & machine-readability audit', 'vulopilot'),
                __('Entity & purpose-clarity checks', 'vulopilot'),
                __('Live GEO score (0–100)', 'vulopilot'),
                __('Manual re-scan on demand', 'vulopilot')
            ],
            proFeatures: [
                __('Historical GEO trend charts', 'vulopilot'),
                __('Scheduled automated scans', 'vulopilot'),
                __('AI-powered bulk fixes', 'vulopilot'),
                __('Competitor GEO benchmarking', 'vulopilot')
            ]
        },
        {
            /**
             * Same real backend id as the GEO card above — AEO's own Pro
             * features (llms.txt generation, etc.) are also registered by
             * GeoInsights\Module; there's no separate "AEO" Pro module
             * folder. This card's own `id` used to be the non-existent
             * 'aeo-insights' (no `AeoInsights` folder anywhere, and every
             * other real `moduleName="geo-insights"` call site in the app —
             * including AeoTab.tsx itself — already used the correct id) —
             * a real, confirmed bug: toggling this card sent an id
             * Modules::load_active_modules() would never resolve to any
             * real module, so the "activation" silently reverted on the
             * very next page load with no error shown. Fixed to the real
             * id. Known, accepted side effect of the fix: zyra's
             * ModuleGridComponent keys its card list by `module.id`, so two
             * cards intentionally sharing 'geo-insights' now triggers a
             * harmless React "duplicate key" dev-console warning — toggling
             * either card still correctly activates/deactivates the one
             * real module both represent.
             */
            id: 'geo-insights',
            icon: 'answer',
            name: __('AEO Autopilot — Answer Engine Optimization', 'vulopilot'),
            desc: __('Detects FAQs, direct-answer structure, and question coverage — then helps you get cited by ChatGPT, Perplexity, Gemini, and Copilot.', 'vulopilot'),
            proModule: true,
            category: 'ai-visibility',
            freeFeatures: [
                __('FAQ & direct-answer detection', 'vulopilot'),
                __('Question-coverage scanning', 'vulopilot'),
                __('Answer-position checks (first 200 words)', 'vulopilot'),
                __('Retrieval-chunk thinness checks', 'vulopilot')
            ],
            proFeatures: [
                __('llms.txt generation', 'vulopilot'),
                __('Citation-probability scoring', 'vulopilot'),
                __('AI-ready snippet builder', 'vulopilot'),
                __('Multi-engine answer testing (ChatGPT, Perplexity, Gemini, Copilot)', 'vulopilot')
            ]
        },
        {
            id: 'knowledge-graph',
            icon: 'intelligence',
            name: __('Knowledge Graph — Entity Intelligence', 'vulopilot'),
            desc: __('Reads real people, organizations, products, services, and categories from your site and turns them into structured entities.', 'vulopilot'),
            proModule: true,
            category: 'ai-visibility',
            miniModule: true,
            freeFeatures: [
                __('Entity extraction: people, orgs, products, services', 'vulopilot'),
                __('Location & category detection', 'vulopilot'),
                __('Source-verified entity list (never fabricated)', 'vulopilot')
            ],
            proFeatures: [
                __('Entity relationship mapping', 'vulopilot'),
                __('AI-powered graph enrichment', 'vulopilot'),
                __('Schema.org graph export', 'vulopilot')
            ]
        },
        {
            /**
             * Must be the real backend module id — AiCrawlerAnalytics'
             * folder name kebab-cased. The mockup's own id ('ai-crawler')
             * matches no real module.
             */
            id: 'ai-crawler-analytics',
            icon: 'analytics',
            name: __('Bot Watch — AI Crawler Intelligence', 'vulopilot'),
            desc: __('Tracks which AI bots — GPTBot, ClaudeBot, PerplexityBot, and others — are visiting your site, and what they\'re reading.', 'vulopilot'),
            proModule: true,
            category: 'ai-visibility',
            miniModule: true,
            freeFeatures: [
                __('7-day crawler visit log', 'vulopilot'),
                __('Top pages crawled by AI bots', 'vulopilot'),
                __('Per-bot visit counts', 'vulopilot')
            ],
            proFeatures: [
                __('Historical trends & anomaly alerts', 'vulopilot'),
                __('Extended log retention (12 months)', 'vulopilot'),
                __('Crawl-budget insights', 'vulopilot')
            ]
        },

		// Brand Visibility Section
		{ type: 'separator', id: 'brand-visibility', label: __('Brand Visibility', 'vulopilot') },
		{
            /**
             * Must be the real backend module id — the free and Pro
             * BrandIntelligence modules intentionally share this exact id
             * (Modules::get_all_modules()'s own collision handling lets two
             * sources register the same id and co-activate together from
             * one toggle). The mockup's own id ('brand-visibility') matches
             * no real module.
             */
            id: 'brand-intelligence',
            icon: 'announcement',
            name: __('Brand Radar — Off-Site Visibility', 'vulopilot'),
            desc: __('Organization & author schema, About-page completeness, and off-site mentions across the web.', 'vulopilot'),
            proModule: true,
            category: 'brand-visibility',
            miniModule: true,
            freeFeatures: [
                __('Organization & author schema checks', 'vulopilot'),
                __('About-page completeness', 'vulopilot'),
                __('NAP / contact consistency', 'vulopilot')
            ],
            proFeatures: [
                __('Off-site mention monitoring', 'vulopilot'),
                __('Share-of-voice vs. competitors', 'vulopilot'),
                __('Competitor comparison via connected Ahrefs account', 'vulopilot')
            ]
        },

		// SEO & Content Section
		{ type: 'separator', id: 'seo-content', label: __('SEO & Content', 'vulopilot') },
		{
            /**
             * Must be the real backend module id — AdvancedSeo's folder
             * name kebab-cased. The free Seo module (id 'seo', auto-active
             * on install) has no dedicated card — same always-on-background
             * treatment as Geo above. The mockup's own id ('seo-intelligence')
             * matches no real module.
             */
            id: 'advanced-seo',
            icon: 'search',
            name: __('SEO Copilot — Technical SEO', 'vulopilot'),
            desc: __('Titles, meta, canonical, schema, internal links, sitemap, and robots.txt checks.', 'vulopilot'),
            proModule: true,
            category: 'seo-content',
            miniModule: true,
            freeFeatures: [
                __('Title & meta description checks', 'vulopilot'),
                __('Canonical & schema validation', 'vulopilot'),
                __('Internal link & sitemap audit', 'vulopilot'),
                __('robots.txt checks', 'vulopilot')
            ],
            proFeatures: [
                __('Keyword rank tracking', 'vulopilot'),
                __('Keyword cannibalization detection', 'vulopilot'),
                __('Google Search Console integration', 'vulopilot')
            ]
        },
        {
            id: 'content-intelligence',
            icon: 'document',
            name: __('Content Copilot — Readability & Freshness', 'vulopilot'),
            desc: __('Readability, thin/duplicate content, and freshness flags — plus AI-assisted rewriting.', 'vulopilot'),
            proModule: true,
            category: 'seo-content',
            miniModule: true,
            freeFeatures: [
                __('Readability scoring', 'vulopilot'),
                __('Thin & duplicate content detection', 'vulopilot'),
                __('Content freshness flags', 'vulopilot')
            ],
            proFeatures: [
                __('AI rewrite & expansion', 'vulopilot'),
                __('Topic clustering', 'vulopilot'),
                __('Content gap analysis vs. competitors', 'vulopilot')
            ]
        },
        {
            /**
             * No real `modules/` folder backs this id — Services\RedirectManager.php
             * is a core, always-on class, not part of the module system, so
             * this toggle is inert (unchanged from how this card behaved
             * before this session touched this file). Kept only because the
             * mockup includes it by name; a real fix would mean either
             * wrapping RedirectManager in a real Module.php (its own,
             * separate change) or dropping this card entirely.
             */
            id: 'redirect-manager',
            icon: 'link',
            name: __('Redirect Autopilot — 301s & 404 Log', 'vulopilot'),
            desc: __('301 redirects and 404 tracking, with automatic redirects on slug change.', 'vulopilot'),
            proModule: false,
            category: 'seo-content',
            miniModule: true,
            freeFeatures: [
                __('Unlimited 301 redirects', 'vulopilot'),
                __('404 log with hit counts', 'vulopilot'),
                __('Automatic redirect on slug change', 'vulopilot')
            ]
        },

		// Site Health Section
		{ type: 'separator', id: 'site-health', label: __('Site Health', 'vulopilot') },
		{
            /**
             * No real `modules/` folder backs this id either — same
             * inert-toggle caveat as 'redirect-manager' above (core
             * Performance services, not a module).
             */
            id: 'performance-monitoring',
            icon: 'bar-chart',
            name: __('Speed Radar — Core Web Vitals', 'vulopilot'),
            desc: __('Core Web Vitals, database health, and autoload size checks.', 'vulopilot'),
            proModule: true,
            category: 'site-health',
            miniModule: true,
            freeFeatures: [
                __('Core Web Vitals snapshot', 'vulopilot'),
                __('Database health checks', 'vulopilot'),
                __('Autoload size checks', 'vulopilot')
            ],
            proFeatures: [
                __('Historical performance trends', 'vulopilot'),
                __('Scheduled audits', 'vulopilot'),
                __('AI-generated optimization suggestions', 'vulopilot')
            ]
        },
        {
            /**
             * Must be the real backend module id — AccessibilityAudits'
             * folder name kebab-cased. The mockup's own id
             * ('accessibility-scanner') matches no real module.
             */
            id: 'accessibility-audits',
            icon: 'eye',
            name: __('Accessibility Guard — WCAG Compliance', 'vulopilot'),
            desc: __('WCAG checks — alt text, headings, ARIA, and form labels.', 'vulopilot'),
            proModule: true,
            category: 'site-health',
            miniModule: true,
            freeFeatures: [
                __('Alt text & heading structure checks', 'vulopilot'),
                __('ARIA attribute checks', 'vulopilot'),
                __('Form label checks', 'vulopilot')
            ],
            proFeatures: [
                __('Bulk accessibility fixes', 'vulopilot'),
                __('Scheduled audits', 'vulopilot'),
                __('Historical compliance reports', 'vulopilot')
            ]
        },
        {
            id: 'security-monitoring',
            icon: 'security',
            name: __('Security Watchtower — Site Protection', 'vulopilot'),
            desc: __('Weak passwords, basic vulnerabilities, core file integrity, and update checks.', 'vulopilot'),
            proModule: true,
            category: 'site-health',
            miniModule: true,
            freeFeatures: [
                __('Weak password detection', 'vulopilot'),
                __('Core file integrity checks', 'vulopilot'),
                __('Plugin/theme update checks', 'vulopilot')
            ],
            proFeatures: [
                __('Scheduled security scans', 'vulopilot'),
                __('Live CVE vulnerability feed', 'vulopilot'),
                __('Plugin/theme integrity monitoring', 'vulopilot'),
                __('Alerts & incident reports', 'vulopilot')
            ]
        },

		// Automation & AI Section
		{ type: 'separator', id: 'automation-ai', label: __('Automation & AI', 'vulopilot') },
		{
            /**
             * Real, genuinely free module id (modules/AiCopilot/Module.php)
             * — the master gate every AI surface in the plugin checks
             * (Copilot.php's chat endpoint, ContentAssistant.php, every
             * AI-branded card — see useAiCopilotEnabled()). `proModule:
             * false` since it has to be free-toggleable (it gates AI Chat,
             * itself a free bring-your-own-key feature). The mockup shows
             * one combined "AI Copilot" card with both a free and a Pro
             * feature list, so — unlike this file's earlier draft this
             * session, which split this into two cards to keep the real
             * Pro 'one-click-fix' module independently reachable — the Pro
             * tier's copy is folded back in here as informational text
             * only; toggling this card does not itself activate
             * 'one-click-fix' (that module has no card of its own now).
             */
            id: 'ai-copilot',
            icon: 'ai',
            name: __('AI Copilot', 'vulopilot'),
            desc: __('Explainable AI recommendations for any finding across every module.', 'vulopilot'),
            proModule: false,
            category: 'automation-ai',
            miniModule: true,
            freeFeatures: [
                __('Manual AI suggestions (bring your own API key)', 'vulopilot'),
                __('Explainable, side-by-side fix previews', 'vulopilot')
            ],
            proFeatures: [
                __('One-click AI fixes', 'vulopilot'),
                __('Bulk AI fixes across any module', 'vulopilot'),
                __('Auto-apply with approval queue', 'vulopilot')
            ]
        },
        {
            /**
             * Must be the real backend module id — Automation's folder name
             * kebab-cased (no 'Engine' suffix in the real folder name). The
             * mockup's own id ('automation-engine') matches no real module.
             */
            id: 'automation',
            icon: 'automation',
            name: __('Workflow Autopilot — Automation Engine', 'vulopilot'),
            desc: __('Triggers, conditions, schedules, and workflows that react to scan findings automatically.', 'vulopilot'),
            proModule: true,
            category: 'automation-ai',
            miniModule: true,
            freeFeatures: [],
            proFeatures: [
                __('Custom triggers & conditions', 'vulopilot'),
                __('Scheduled workflows', 'vulopilot'),
                __('Auto-react to scan findings', 'vulopilot')
            ]
        }
	],
};

export default MODULES_CATALOG;
