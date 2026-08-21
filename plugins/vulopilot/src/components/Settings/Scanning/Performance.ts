import { __ } from '@wordpress/i18n';

/**
 * "Performance" Overview's PerformanceScoreCard.tsx real Mobile/Desktop
 * speed split — same declarative `{ key, type: 'text', label,
 * settingDescription }` shape InstantIndexing.ts's own `indexnow_api_key`
 * field already uses. Auto-discovered by templateService.ts's
 * `require.context` over every `.ts` file under `src/components/Settings/`
 * — no manual registration needed. Read by
 * classes/Services/PageSpeedInsightsFetcher.php, which does nothing at all
 * while this key is empty (no fabricated Mobile/Desktop split without it).
 */
export default {
	id: 'performance',
	priority: 3.5,
	headerTitle: __('Performance', 'vulopilot'),
	settingTitle: __('Performance', 'vulopilot'),
	headerDescription: __(
		'Connect Google PageSpeed Insights for a real Mobile/Desktop speed score.',
		'vulopilot'
	),
	headerIcon: 'analytics',
	submitUrl: 'settings',
	modal: [
		{
			key: 'psi_api_key',
			type: 'text',
			size: 10,
			label: __('Google PageSpeed Insights API key', 'vulopilot'),
			settingDescription: __(
				'Optional. When set, "Performance" shows a real Mobile/Desktop speed score from Google PageSpeed Insights instead of one unified score. Get a free key from Google Cloud Console (PageSpeed Insights API).',
				'vulopilot'
			),
		},
	],
};
