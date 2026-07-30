import { __ } from '@wordpress/i18n';

/**
 * New Scanning → Entity Extraction tab (KNOWLEDGE-GRAPH-MODULE.md).
 * People/Organizations/Products/Categories are all read automatically from
 * existing WordPress/WooCommerce data — no setting needed. Services/
 * Locations have no existing data source to derive them from
 * automatically (confirmed absent everywhere in this codebase), so the
 * site owner curates both as real, explicit lists here, same
 * "Free owns the setting, deterministic once provided" posture
 * `geo_competitor_urls` already uses. The Knowledge Graph Health alert
 * threshold follows Scanning → GEO/Brand Intelligence's own
 * `geo_drop_threshold`/`brand_drop_threshold` placement convention: the
 * toggle lives in Notifications, the threshold lives here.
 */
export default {
	id: 'entity-extraction',
	// Sorts after Crawler Analytics (2.75), before GEO (3).
	priority: 2.85,
	headerTitle: __('Entity Extraction', 'vulopilot'),
	headerIcon: 'share-alt2',
	submitUrl: 'settings',
	modal: [
		{
			key: 'entity-section-services',
			type: 'section',
			title: __('Services', 'vulopilot'),
			desc: __(
				'One published page per line — a URL or a numeric page ID. Pages that don\'t resolve are skipped.',
				'vulopilot'
			),
		},
		{
			key: 'entity_service_pages',
			type: 'textarea',
			label: __('Service pages', 'vulopilot'),
			desc: __(
				'e.g. https://example.com/consulting/ or just the page ID.',
				'vulopilot'
			),
		},
		{
			key: 'entity-section-locations',
			type: 'section',
			title: __('Locations', 'vulopilot'),
			desc: __(
				'One location per line, as "Name | Address".',
				'vulopilot'
			),
		},
		{
			key: 'entity_business_locations',
			type: 'textarea',
			label: __('Business locations', 'vulopilot'),
			desc: __(
				'e.g. Downtown Store | 123 Main St, Springfield.',
				'vulopilot'
			),
		},
		{
			key: 'entity-section-alerts',
			type: 'section',
			title: __('Alerts', 'vulopilot'),
		},
		{
			key: 'kg_health_drop_threshold',
			type: 'number',
			label: __(
				'Knowledge Graph Health drop alert threshold (points)',
				'vulopilot'
			),
			desc: __(
				'Used by the "Email me when Knowledge Graph Health drops" notification in the Notifications tab.',
				'vulopilot'
			),
		},
	],
};
