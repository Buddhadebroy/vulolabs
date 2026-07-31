import { __ } from '@wordpress/i18n';

export default {
	id: 'geo',
	priority: 3,
	headerTitle: __('GEO', 'vulopilot'),
	headerIcon: 'globe',
	submitUrl: 'settings',
	modal: [
		{
			key: 'semantic_html',
			type: 'section',
			title: __('Structure & semantic HTML', 'vulopilot'),
			desc: __(
				"Controls the GEO page's 'Structure' findings group.",
				'vulopilot'
			),
		},
		{
			key: 'flag_missing_semantic',
			type: 'checkbox',
			look: 'toggle',
			label: __('Flag missing semantic HTML', 'vulopilot'),
			desc: __(
				"Pages relying on generic <div>s instead of <article>, <section>, or heading hierarchy.",
				'vulopilot'
			),
			options: [
				{ key: 'flag_missing_semantic', label: '', value: 'flag_missing_semantic' },
			],
		},
		{
			key: 'entity-section',
			type: 'section',
			title: __('Entity coverage', 'vulopilot'),
			desc: __("Controls the GEO page's 'Entities' findings group.", 'vulopilot')
		},
		{
			key: 'flag_weak_entity',
			type: 'checkbox',
			look: 'toggle',
			label: __('Flag weak entity coverage', 'vulopilot'),
			desc: __(
				"Pages that don't clearly identify their primary entity (product, service, or organization).",
				'vulopilot'
			),
			options: [
				{ key: 'flag_weak_entity', label: '', value: 'flag_weak_entity' },
			],
		},
		{
			key: 'minimum_entity_mentions',
			type: 'number',
			label: __('Minimum entity mentions', 'vulopilot'),
			desc: __(
				"Pages with fewer mentions of their primary entity than this are flagged as low-clarity.",
				'vulopilot'
			),
		},
		{
			key: 'freshness-section',
			type: 'section',
			title: __('Freshness', 'vulopilot'),
		},
		{
			key: 'stale_content_months',
			type: 'number',
			label: __('Flag content older than (months)', 'vulopilot'),
			desc: __(
				"Pages not updated within this window score lower on the GEO AI score's Content Freshness (Pro).",
				'vulopilot'
			),
		},
	],
};
