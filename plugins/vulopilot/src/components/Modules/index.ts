import { __ } from '@wordpress/i18n';

export default {
	category: true,
	tab: 'modules',
	modules: [
		// AI Visibility Section
		{ type: 'separator', id: 'ai-visibility', label: __('AI Visibility', 'vulopilot') },
		{
            id: 'geo-ai-understanding',
            name: __('GEO — AI Understanding', 'vulopilot'),
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
            id: 'aeo-answer-engine',
            name: __('AEO — Answer Engine Optimization', 'vulopilot'),
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
            name: __('Knowledge Graph', 'vulopilot'),
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
            id: 'ai-crawler-intelligence',
            name: __('AI Crawler Intelligence', 'vulopilot'),
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
            id: 'brand-visibility-module',
            name: __('Brand Visibility', 'vulopilot'),
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
            id: 'seo-intelligence',
            name: __('SEO Intelligence', 'vulopilot'),
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
            name: __('Content Intelligence', 'vulopilot'),
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
            id: 'redirect-manager',
            name: __('Redirect Manager & 404 Log', 'vulopilot'),
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
            id: 'performance-monitoring',
            name: __('Performance Monitoring', 'vulopilot'),
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
            id: 'accessibility-scanner',
            name: __('Accessibility Scanner', 'vulopilot'),
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
            name: __('Security Monitoring', 'vulopilot'),
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

		// WooCommerce Section
		{ type: 'separator', id: 'woocommerce', label: __('WooCommerce', 'vulopilot') },
		{
            id: 'woocommerce-intelligence',
            name: __('WooCommerce Intelligence', 'vulopilot'),
            desc: __('Store health, product SEO, images, attributes, and inventory checks.', 'vulopilot'),
            proModule: true,
            category: 'woocommerce',
            miniModule: true,
            freeFeatures: [
                __('Store health checks', 'vulopilot'),
                __('Product SEO & image/attribute checks', 'vulopilot'),
                __('Inventory checks', 'vulopilot')
            ],
            proFeatures: [
                __('Inventory forecasting', 'vulopilot'),
                __('Revenue insights', 'vulopilot'),
                __('Store trend analysis', 'vulopilot'),
                __('AI-generated product content', 'vulopilot')
            ]
        },

		// Automation & AI Section
		{ type: 'separator', id: 'automation-ai', label: __('Automation & AI', 'vulopilot') },
		{
            id: 'one-click-fix',
            name: __('AI Fixes', 'vulopilot'),
            desc: __('Explainable AI recommendations for any finding across every module.', 'vulopilot'),
            proModule: true,
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
            id: 'automation-engine',
            name: __('Automation Engine', 'vulopilot'),
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

		// Reports Section
		{ type: 'separator', id: 'reports', label: __('Reports', 'vulopilot') },
		{
            id: 'reports-module',
            name: __('Reports', 'vulopilot'),
            desc: __('Health, SEO, Security, and Accessibility reports for your site.', 'vulopilot'),
            proModule: true,
            category: 'reports',
            miniModule: true,
            freeFeatures: [
                __('Health, SEO, Security & Accessibility reports', 'vulopilot'),
                __('On-demand PDF export', 'vulopilot')
            ],
            proFeatures: [
                __('Scheduled report delivery', 'vulopilot'),
                __('CSV export', 'vulopilot'),
                __('White-label, client-ready branding', 'vulopilot')
            ]
        }
	],
};