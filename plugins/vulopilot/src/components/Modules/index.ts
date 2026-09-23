import { __ } from '@wordpress/i18n';

/** One real, toggleable module card - see this file's own docblock below for the id/category conventions every entry follows. */
export interface ModuleCatalogEntry {
	id: string;
	name: string;
	desc: string;
	proModule: boolean;
	category: string;
	miniModule?: boolean;
	freeFeatures?: string[];
	proFeatures?: string[];
	icon?: string;
	settingsLink?: string;
}

/** A category-pill-bar heading, not a real module - `type: 'separator'` is how ModuleGridComponent (zyra) tells the two apart in one flat array. */
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
 * Started as exactly the 13 modules from the user's own mockup
 * (ModulesPanel.jsx), same names/descriptions/free-pro copy verbatim -
 * Reports (advanced-reports), MCP Server, WooCommerce AI/Intelligence
 * (woo-commerce-ai/woo-commerce-intelligence, still cardless below), and
 * the standalone "One-Click AI Fixes" Pro card that previously existed
 * here were all deliberately dropped to match the mockup's own 13-card,
 * 5-category list exactly, per that earlier explicit request. A 14th
 * card, Commerce (the real `commerce` module - see its own docblock
 * below), was added on top of that fixed list per a later, separate
 * direct instruction ("add module in this page so use can active and
 * deactive it") - the two WooCommerce modules it sits alongside on the
 * Commerce tab (woo-commerce-ai/woo-commerce-intelligence) stay cardless.
 *
 * Every `id` is still a real backend module id wherever one exists (see
 * Modules.php::camel_to_kebab()) - the mockup's own ids (`geo`, `aeo`,
 * `ai-crawler`, `brand-visibility`, `seo-intelligence`, `accessibility-
 * scanner`, `ai-fixes`, `automation-engine`) don't match any real module,
 * so they're swapped for the real ones the same way every other card in
 * this file was already fixed this session. Two exceptions, called out on
 * their own cards below: 'redirect-manager' and 'performance-monitoring'
 * don't correspond to any real `modules/` folder (they're core, always-on
 * `Services/*.php` classes) - toggling those two is inert, same as before
 * this session touched this file, kept only because the mockup includes
 * them by name.
 *
 * Every card sets `settingsLink` (see `ModuleCatalogEntry`'s own docblock
 * above) - a real gear icon, left of the enable/disable toggle in zyra's
 * own `ModuleGridComponent` footer. Most point at that module's own real
 * Settings tab (geo-insights/aeo-insights/ai-crawler-analytics share the
 * one Scanning → AI Visibility tab that actually holds their scan toggles,
 * same way redirect-manager shares SEO & Content's own "Redirects & 404s"
 * section rather than having a dedicated tab of its own; knowledge-graph
 * instead points at Get Started → Business Information, where its own
 * Business/Services/Locations fields moved per direct instruction).
 * content-intelligence/performance-monitoring/automations/commerce instead
 * point at that module's own real standalone top-level menu page
 * (routes.ts's own `tab: 'content'`/`'performance'`/`'automations'`/
 * `'commerce'`) rather than a Settings subtab - per a later, separate
 * direct instruction giving the exact destination for every card on this
 * page ("geo -> scanning ai visibility tab", … "commerce -> commerce
 * menu"); `performance-monitoring` in particular has no real Settings tab
 * to link to at all (no `Performance.ts` exists - same "inert toggle, no
 * real `modules/` folder" caveat as its own docblock above), so its own
 * top-level Performance page is the only real destination for it either
 * way.
 */
const MODULES_CATALOG: { category: boolean; tab: string; modules: ModuleCatalogItem[] } = {
	category: true,
	tab: 'settings',
	modules: [
		// AI Visibility Section
		{ type: 'separator', id: 'ai-visibility', label: __('AI Visibility', 'vulopilot') },
		{
            id: 'geo-analysis',
            icon: 'geo',
            settingsLink: '?page=vulopilot#&tab=settings&subtab=ai-visibility',
            name: __('GEO Analysis', 'vulopilot'),
            desc: __('Scans structure, entities, and machine-readability so AI models can understand your pages.', 'vulopilot'),
            proModule: false,
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
            id: 'answer-engine-optimization',
            icon: 'aeo',
            settingsLink: '?page=vulopilot#&tab=settings&subtab=ai-visibility',
            name: __('Answer Engine Optimization', 'vulopilot'),
            desc: __('Detects FAQs, direct-answer structure, and question coverage - then helps you get cited by ChatGPT, Perplexity, Gemini, and Copilot.', 'vulopilot'),
            proModule: false,
            category: 'ai-visibility',
            freeFeatures: [
                __('FAQ & direct-answer detection', 'vulopilot'),
                __('Question-coverage scanning', 'vulopilot'),
                __('Answer-position checks (first 200 words)', 'vulopilot'),
                __('Retrieval-chunk thinness checks', 'vulopilot'),
                __('llms.txt generation', 'vulopilot')
            ],
            proFeatures: [
                __('Citation-probability scoring', 'vulopilot'),
                __('AI-ready snippet builder', 'vulopilot'),
                __('Multi-engine answer testing (ChatGPT, Perplexity, Gemini, Copilot)', 'vulopilot')
            ]
        },
        {
            id: 'knowledge-graph',
            icon: 'knowledge-graph',
            settingsLink: '?page=vulopilot#&tab=settings&subtab=business-information',
            name: __('Knowledge Graph', 'vulopilot'),
            desc: __('Reads real people, organizations, products, services, and categories from your site and turns them into structured entities.', 'vulopilot'),
            proModule: false,
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
            id: 'ai-crawler-tracking',
            icon: 'url',
            settingsLink: '?page=vulopilot#&tab=settings&subtab=ai-visibility',
            name: __('AI Crawler Tracking', 'vulopilot'),
            desc: __('Tracks which AI bots - GPTBot, ClaudeBot, PerplexityBot, and others - are visiting your site, and what they\'re reading.', 'vulopilot'),
            proModule: false,
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
            id: 'brand-visibility',
            icon: 'brand-visibility',
            settingsLink: '?page=vulopilot#&tab=settings&subtab=business-information',
            name: __('Brand Visibility', 'vulopilot'),
            desc: __('Organization & author schema, About-page completeness, and off-site mentions across the web.', 'vulopilot'),
            proModule: false,
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
            id: 'technical-seo',
            icon: 'seo',
            settingsLink: '?page=vulopilot#&tab=settings&subtab=seo-content',
            name: __('Technical SEO', 'vulopilot'),
            desc: __('Titles, meta, canonical, schema, internal links, sitemap, and robots.txt checks.', 'vulopilot'),
            proModule: false,
            category: 'seo-content',
            miniModule: true,
            freeFeatures: [
                __('Title & meta description checks', 'vulopilot'),
                __('Canonical & schema validation', 'vulopilot'),
                __('Internal link & sitemap audit', 'vulopilot'),
                __('robots.txt checks', 'vulopilot')
            ],
            proFeatures: [
                __('Keyword cannibalization detection', 'vulopilot'),
                __('Site-wide structured data validation', 'vulopilot')
            ]
        },
        {
            id: 'content-optimization',
            icon: 'document',
            settingsLink: '?page=vulopilot#&tab=content',
            name: __('Content Optimization', 'vulopilot'),
            desc: __('Readability, thin/duplicate content, and freshness flags - plus AI-assisted rewriting.', 'vulopilot'),
            proModule: false,
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
            id: 'redirect-manager',
            icon: 'redirect-url',
            settingsLink: '?page=vulopilot#&tab=settings&subtab=seo-content',
            name: __('Redirect Manager', 'vulopilot'),
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
        {
            id: 'keyword-rank-tracking',
            icon: 'keyword',
            settingsLink: '?page=vulopilot#&tab=seo-visibility&subtab=keywords',
            name: __('Keyword Rank Tracking', 'vulopilot'),
            desc: __('Real, synced Google Search Console rank tracking - positions, impressions, clicks, and keyword groups, tracked over time.', 'vulopilot'),
            proModule: true,
            category: 'seo-content',
            miniModule: true,
            freeFeatures: [],
            proFeatures: [
                __('Synced Search Console rank tracking', 'vulopilot'),
                __('Keyword position history & trends', 'vulopilot'),
                __('Top opportunities & keyword groups', 'vulopilot')
            ]
        },

		// Site Health Section
		{ type: 'separator', id: 'site-health', label: __('Site Health', 'vulopilot') },
		{
            id: 'performance-monitoring',
            icon: 'speed',
            settingsLink: '?page=vulopilot#&tab=performance',
            name: __('Core Web Vitals', 'vulopilot'),
            desc: __('Core Web Vitals, database health, and autoload size checks.', 'vulopilot'),
            proModule: false,
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
             * Must be the real backend module id - AccessibilityAudits'
             * folder name kebab-cased. The mockup's own id
             * ('accessibility-scanner') matches no real module.
             */
            id: 'accessibility-checks',
            icon: 'accessibility',
            settingsLink: '?page=vulopilot#&tab=settings&subtab=accessibility',
            name: __('Accessibility Checks', 'vulopilot'),
            desc: __('WCAG checks - alt text, headings, ARIA, and form labels.', 'vulopilot'),
            proModule: false,
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
            id: 'website-security',
            icon: 'security',
            settingsLink: '?page=vulopilot#&tab=settings&subtab=security-scanning',
            name: __('Website Security', 'vulopilot'),
            desc: __('Weak passwords, basic vulnerabilities, core file integrity, and update checks.', 'vulopilot'),
            proModule: false,
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
		{ type: 'separator', id: 'automation-ai', label: __('Automations & AI', 'vulopilot') },
		{
            id: 'ai-copilot',
            icon: 'ai',
            settingsLink: '?page=vulopilot#&tab=settings&subtab=integrations',
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
            id: 'workflow-automation',
            icon: 'automation',
            settingsLink: '?page=vulopilot#&tab=automations',
            name: __('Workflow Automation', 'vulopilot'),
            desc: __('Triggers, conditions, schedules, and workflows that react to scan findings automatically.', 'vulopilot'),
            proModule: false,
            category: 'automation-ai',
            miniModule: true,
            freeFeatures: [],
            proFeatures: [
                __('Custom triggers & conditions', 'vulopilot'),
                __('Scheduled workflows', 'vulopilot'),
                __('Auto-react to scan findings', 'vulopilot')
            ]
        },

		// Commerce Section
		{ type: 'separator', id: 'woocommerce-analytics', label: __('Commerce', 'vulopilot') },
		{
            id: 'woocommerce-analytics',
            icon: 'cart',
            settingsLink: '?page=vulopilot#&tab=commerce',
            name: __('WooCommerce Analytics', 'vulopilot'),
            desc: __('Store health, product/checkout/order insights, revenue reports, and AI-powered sales optimization for WooCommerce.', 'vulopilot'),
            proModule: true,
            category: 'commerce',
            miniModule: true,
            freeFeatures: [],
            proFeatures: [
                __('Store health & category breakdowns', 'vulopilot'),
                __('Revenue reports & sales trends', 'vulopilot'),
                __('AI-powered cross-sell/upsell suggestions', 'vulopilot')
            ]
        }
	],
};

export default MODULES_CATALOG;
