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
	/**
	 * Real zyra `ModuleGridComponent` slot (`module2.settingsLink && <a
	 * href={module2.settingsLink}><IconComponent name="setting" /></a>`,
	 * rendered in `.module-footer .buttons`, left of the enable/disable
	 * toggle — confirmed via the compiled `@multivendorx/zyra` bundle,
	 * unused by every card until now) — a plain hash link to this module's
	 * own corresponding destination, same `?page=vulopilot#&tab=…` shape
	 * GettingStartedCard.tsx already uses, so clicking it is a same-page
	 * hash change (no reload) whether this card is on the standalone
	 * Modules page or the Settings → Modules tab. Usually a Settings tab
	 * (`?page=vulopilot#&tab=settings&subtab=<id>`) but not always — a
	 * handful of cards point at that module's own real standalone
	 * top-level menu page instead (`?page=vulopilot#&tab=<id>`, no
	 * `settings&subtab=`), per direct instruction — see every entry below
	 * for its own real destination.
	 */
	settingsLink?: string;
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
 * Started as exactly the 13 modules from the user's own mockup
 * (ModulesPanel.jsx), same names/descriptions/free-pro copy verbatim —
 * Reports (advanced-reports), MCP Server, WooCommerce AI/Intelligence
 * (woo-commerce-ai/woo-commerce-intelligence, still cardless below), and
 * the standalone "One-Click AI Fixes" Pro card that previously existed
 * here were all deliberately dropped to match the mockup's own 13-card,
 * 5-category list exactly, per that earlier explicit request. A 14th
 * card, Commerce (the real `commerce` module — see its own docblock
 * below), was added on top of that fixed list per a later, separate
 * direct instruction ("add module in this page so use can active and
 * deactive it") — the two WooCommerce modules it sits alongside on the
 * Commerce tab (woo-commerce-ai/woo-commerce-intelligence) stay cardless.
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
 *
 * Every card sets `settingsLink` (see `ModuleCatalogEntry`'s own docblock
 * above) — a real gear icon, left of the enable/disable toggle in zyra's
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
 * `'commerce'`) rather than a Settings subtab — per a later, separate
 * direct instruction giving the exact destination for every card on this
 * page ("geo -> scanning ai visibility tab", … "commerce -> commerce
 * menu"); `performance-monitoring` in particular has no real Settings tab
 * to link to at all (no `Performance.ts` exists — same "inert toggle, no
 * real `modules/` folder" caveat as its own docblock above), so its own
 * top-level Performance page is the only real destination for it either
 * way.
 */
const MODULES_CATALOG: { category: boolean; tab: string; modules: ModuleCatalogItem[] } = {
	category: true,
	// Not read by `ModuleGridComponent` (zyra) itself — only
	// `searchIndex.ts` used to read this as a real per-module search-result
	// link's own `tab`, before that now hardcodes the one real, correct
	// Settings → Modules destination directly (`tab=settings&subtab=modules`)
	// regardless of this field, since every real module now lives at that
	// one same place — kept only for whatever future reader expects this
	// shape to carry its own real destination tab.
	tab: 'settings',
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
            settingsLink: '?page=vulopilot#&tab=settings&subtab=ai-visibility',
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
             * A real, separate backend module id — `plugins/vulopilot-pro/
             * modules/AeoInsights/Module.php`, per direct instruction ("aeo
             * module id is aeo-insights, geo module id is geo-insights").
             * This card's own `id` used to be 'geo-insights' (the SAME id
             * as the GEO Radar card above), deliberately reused at the time
             * since no `AeoInsights` folder existed and a real-but-wrong id
             * ('aeo-insights') had already caused a confirmed bug once
             * (toggling that card sent an id Modules::load_active_modules()
             * never resolved to any real module, so the "activation"
             * silently reverted on the very next page load). That workaround
             * had its own real, confirmed bug, only found later: Popup.tsx's
             * own `MODULE_CATALOG_BY_ID` is a `Map` keyed by `module.id` —
             * two entries sharing 'geo-insights' meant the *second* one
             * (this AEO card) silently won that key, so every
             * `moduleName="geo-insights"` locked-feature popup anywhere in
             * the app — including GEO's own cards — showed "Activate AEO
             * Autopilot" instead of the correct module name. A real,
             * separate `AeoInsights` module (auto-discovered by Free's own
             * folder-scan loader — see that module's own Module.php
             * docblock for why it needs no extra registration, and how it
             * avoids duplicating GeoInsights' own AI-scoring pipeline)
             * fixes both bugs at once.
             */
            id: 'aeo-insights',
            icon: 'answer',
            settingsLink: '?page=vulopilot#&tab=settings&subtab=ai-visibility',
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
            // Points at Business Information, not AI Visibility — the
            // Business/Services/Locations fields that actually feed this
            // module's own entity extraction moved there per direct
            // instruction (GetStarted/BusinessInformation.ts).
            settingsLink: '?page=vulopilot#&tab=settings&subtab=business-information',
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
            settingsLink: '?page=vulopilot#&tab=settings&subtab=ai-visibility',
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
            // Was '...&subtab=brand-intelligence' — that settings tab is
            // deleted (its real fields merged into Business Information)
            // per direct instruction; same real fields, new home.
            settingsLink: '?page=vulopilot#&tab=settings&subtab=business-information',
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
            settingsLink: '?page=vulopilot#&tab=settings&subtab=seo-content',
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
                __('Keyword cannibalization detection', 'vulopilot'),
                __('Site-wide structured data validation', 'vulopilot')
            ]
        },
        {
            id: 'content-intelligence',
            icon: 'document',
            // Points at the real standalone Content menu page (`tab:
            // 'content'`, routes.ts), not a Settings subtab — per direct
            // instruction ("content copilot -> content menu"). This
            // module's own scan-behavior settings still live under
            // Settings → Scanning → SEO & Content (SeoContent.ts), same as
            // before; only where this card's gear icon points changed.
            settingsLink: '?page=vulopilot#&tab=content',
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
            settingsLink: '?page=vulopilot#&tab=settings&subtab=seo-content',
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
        {
            /**
             * Must be the real backend module id — Keywords' folder name
             * kebab-cased. SEO & Visibility → Keywords' whole real
             * rank-tracking dashboard moved to Pro wholesale per direct
             * instruction ("make this section pro and shift the code to
             * pro and in free add pro tag when click popup") —
             * `freeFeatures` is empty since there's no free tier of this
             * module's own content left to list, same shape 'commerce'/
             * 'automations' above already have for the same reason.
             */
            id: 'keywords',
            icon: 'search',
            // Points at the real SEO & Visibility → Keywords subtab
            // (routes.ts's own 'seo-visibility' tab), not a Settings
            // subtab — same "point at the real tab this card unlocks"
            // posture 'commerce' above already uses.
            settingsLink: '?page=vulopilot#&tab=seo-visibility&subtab=keywords',
            name: __('Keywords Copilot — Rank Tracking', 'vulopilot'),
            desc: __('Real, synced Google Search Console rank tracking — positions, impressions, clicks, and keyword groups, tracked over time.', 'vulopilot'),
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
            /**
             * No real `modules/` folder backs this id either — same
             * inert-toggle caveat as 'redirect-manager' above (core
             * Performance services, not a module).
             */
            id: 'performance-monitoring',
            icon: 'bar-chart',
            // No real Settings tab exists for this one (see this card's own
            // docblock above — core, always-on Performance services, not a
            // module) — points at the real standalone Performance menu
            // page instead (`tab: 'performance'`, routes.ts) per direct
            // instruction ("Speed Radar -> performance menu").
            settingsLink: '?page=vulopilot#&tab=performance',
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
            settingsLink: '?page=vulopilot#&tab=settings&subtab=accessibility',
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
            settingsLink: '?page=vulopilot#&tab=settings&subtab=security-scanning',
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
		{ type: 'separator', id: 'automation-ai', label: __('Automations & AI', 'vulopilot') },
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
            // 'ai-providers' tab merged into 'integrations' per direct
            // instruction — see Settings/Integrations.ts's own docblock.
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
            /**
             * Must be the real backend module id — Automation's folder name
             * kebab-cased (no 'Engine' suffix in the real folder name). The
             * mockup's own id ('automation-engine') matches no real module.
             */
            id: 'automations',
            icon: 'automation',
            // Points at the real standalone Automations menu page (`tab:
            // 'automations'`, routes.ts), not the Settings → Automation →
            // Advanced subtab — per direct instruction ("automation ->
            // automation tab").
            settingsLink: '?page=vulopilot#&tab=automations',
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
        },

		// Commerce Section
		{ type: 'separator', id: 'commerce', label: __('Commerce', 'vulopilot') },
		{
            /**
             * Must be the real backend module id — Commerce's folder name
             * kebab-cased. Added a real card here per direct instruction
             * ("add module in this page so use can active and deactive
             * it") — this module used to be cardless (license alone
             * activated it, same treatment 'woo-commerce-ai'/
             * 'woo-commerce-intelligence' still get below) until this
             * change; see VuloPilotPro::CARDLESS_MODULE_IDS, which no
             * longer lists 'commerce' now that it has its own toggle here.
             * `freeFeatures` is empty since the entire Commerce tab body
             * moved to Pro (pages/Commerce/Commerce.tsx's own `CommercePanel`
             * docblock) — there's no free tier of this module's own content
             * to list, same shape
             * 'automations' above already has for the same reason.
             */
            id: 'commerce',
            icon: 'cart',
            // Points at the real standalone Commerce menu page (`tab:
            // 'commerce'`, routes.ts), not the Settings → Scanning →
            // WooCommerce subtab — per direct instruction ("commerce ->
            // commerce menu").
            settingsLink: '?page=vulopilot#&tab=commerce',
            name: __('Commerce Copilot — WooCommerce Intelligence', 'vulopilot'),
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
