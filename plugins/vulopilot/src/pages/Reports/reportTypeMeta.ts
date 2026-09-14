/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';

/**
 * Per-`report_type` id display metadata (icon + short category badge text/
 * color) for the Recent Reports/Report History tables — the same
 * "hand-authored UI copy keyed by a real, registry-backed id" pattern
 * ReportTypeCards.tsx's own `REPORT_CARD_TYPES` already uses; a row's real
 * name still comes from the server's own `report_type` label
 * (`GET /reports/types`, `ReportTypeInterface::get_label()`), this only
 * supplies the shorter category tag + glyph the mockup shows next to it.
 * `health`/`custom` are Pro-only ids (vulopilot-pro's AdvancedReports
 * module registers them); they still get real metadata here so a report
 * generated while that module was active still displays correctly if it's
 * since been deactivated. Unlisted/future ids fall back to `DEFAULT_META`
 * rather than being hidden.
 */
export interface ReportTypeMeta {
	shortLabel: string;
	/** One-line "what's in this report" copy — the mockup's own grey subtitle under each report's name. Hand-authored per type, same as `shortLabel`. */
	desc: string;
	icon: string;
	badgeColor: string;
}

export const REPORT_TYPE_META: Record<string, ReportTypeMeta> = {
	health: {
		shortLabel: __('Full Website', 'vulopilot'),
		desc: __('Complete overview of your website', 'vulopilot'),
		icon: 'global-community',
		badgeColor: 'indigo',
	},
	scan_summary: {
		shortLabel: __('Summary', 'vulopilot'),
		desc: __('Overall scan summary across every module', 'vulopilot'),
		icon: 'report',
		badgeColor: 'indigo',
	},
	seo: {
		shortLabel: __('SEO', 'vulopilot'),
		desc: __('Detailed SEO analysis and insights', 'vulopilot'),
		icon: 'search-discovery',
		badgeColor: 'pink',
	},
	accessibility: {
		shortLabel: __('Accessibility', 'vulopilot'),
		desc: __('Accessibility issues and recommendations', 'vulopilot'),
		icon: 'person',
		badgeColor: 'green',
	},
	performance: {
		shortLabel: __('Performance', 'vulopilot'),
		desc: __('Speed, Core Web Vitals and performance', 'vulopilot'),
		icon: 'analytics',
		badgeColor: 'yellow',
	},
	security: {
		shortLabel: __('Security', 'vulopilot'),
		desc: __('Security checks and vulnerabilities', 'vulopilot'),
		icon: 'security',
		badgeColor: 'red',
	},
	content_intelligence: {
		shortLabel: __('Content', 'vulopilot'),
		desc: __('Content analysis and opportunities', 'vulopilot'),
		icon: 'document',
		badgeColor: 'purple',
	},
	woocommerce: {
		shortLabel: __('Commerce', 'vulopilot'),
		desc: __('Store sales, orders and product performance', 'vulopilot'),
		icon: 'cart',
		badgeColor: 'blue',
	},
	ai_usage: {
		shortLabel: __('AI Usage', 'vulopilot'),
		desc: __('AI credit usage across every feature', 'vulopilot'),
		icon: 'ai',
		badgeColor: 'purple',
	},
	ai_visibility: {
		shortLabel: __('AI Visibility', 'vulopilot'),
		desc: __('How AI crawlers and assistants see your site', 'vulopilot'),
		icon: 'eye',
		badgeColor: 'teal',
	},
	automations: {
		shortLabel: __('Automations', 'vulopilot'),
		desc: __('Automation runs and their outcomes', 'vulopilot'),
		icon: 'automation',
		badgeColor: 'orange',
	},
	brand_intelligence: {
		shortLabel: __('Brand', 'vulopilot'),
		desc: __('Brand mentions and sentiment across the web', 'vulopilot'),
		icon: 'star',
		badgeColor: 'indigo',
	},
	updates: {
		shortLabel: __('Updates', 'vulopilot'),
		desc: __('Plugin, theme and core update history', 'vulopilot'),
		icon: 'refresh-bold',
		badgeColor: 'blue',
	},
	custom: {
		shortLabel: __('Custom', 'vulopilot'),
		desc: __('A custom selection of report sections', 'vulopilot'),
		icon: 'document',
		badgeColor: 'indigo',
	},
};

const DEFAULT_META: ReportTypeMeta = {
	shortLabel: '',
	desc: __('Automatically generated report', 'vulopilot'),
	icon: 'document',
	badgeColor: 'indigo',
};

/** `shortLabel` falls back to a titleized version of the raw id (e.g. `foo_bar` → `Foo Bar`) rather than an empty badge for a report type not yet listed above. */
export const getReportTypeMeta = (reportType: string): ReportTypeMeta => {
	const meta = REPORT_TYPE_META[reportType];

	if (meta) {
		return meta;
	}

	return {
		...DEFAULT_META,
		shortLabel: reportType
			.split('_')
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(' '),
	};
};

/**
 * `GET /reports/types` id→label map (`ReportTypeInterface::get_label()`,
 * e.g. `seo` → "SEO Report") — the mockup's own report row "Name" text is
 * this real, server-authored label, not the `shortLabel` above (which only
 * backs the shorter category badge). Shared by RecentReportsCard.tsx and
 * ReportHistoryTable.tsx rather than each independently fetching it.
 */
export const useReportTypeLabels = (): Record<string, string> => {
	const [labels, setLabels] = useState<Record<string, string>>({});

	useEffect(() => {
		getApiResponse<{ id: string; label: string }[]>(
			getApiLink(appLocalizer, 'reports/types'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		).then((response) => {
			if (!response) {
				return;
			}
			setLabels(
				Object.fromEntries(
					response.map((type) => [type.id, type.label])
				)
			);
		});
	}, []);

	return labels;
};
