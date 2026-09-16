import { __ } from '@wordpress/i18n';

/**
 * Settings → Site Identity → Business Information.
 *
 * Moved here from Settings → Scanning → AI Visibility per direct
 * instruction — the "Business"/"Services"/"Locations" cards (and the
 * Knowledge Graph Health drop-threshold notice that followed them) used
 * to live at the bottom of that tab (AiVisibility.ts), appended after
 * Competitor URLs/llms.txt/Crawler Traffic. Same real settings, same
 * keys, just relocated: no Utill.php default or backend consumer
 * (Services\EntityExtractor, BusinessProfileCard.tsx/
 * KnowledgeGraphSection.tsx's own `ENTITY_SETTINGS_URL`) needed to change
 * shape, since these were already flat top-level keys, not nested under
 * an expandable-panel row the way several Scanning → SEO & Content fields
 * were in earlier relocations.
 *
 * `entity_business_type`: free-text, owner-provided — shown as-is on the
 * Business Profile card, never written into any real Organization/
 * LocalBusiness JSON-LD anywhere in this codebase (Services\EntityExtractor's
 * own docblock). `entity_service_pages`/`entity_business_locations`:
 * newline-separated owner-curated lists (page URL/ID; "Name | Address"),
 * since this codebase has no existing Service/LocalBusiness concept to
 * derive these from automatically.
 */
export default {
	id: 'business-information',
	priority: 2,
	headerTitle: __('Business Information', 'vulopilot'),
	headerDescription: __(
		'Tell VuloPilot about your business so it can build a more complete Knowledge Graph and Business Profile.',
		'vulopilot'
	),
	groupBySections: true,
	hideSettingHeader: true,
	headerIcon: 'category',
	submitUrl: 'settings',
	modal: [
		{
			key: 'entity-section-business',
			type: 'section',
			icon: 'category',
			title: __('Business', 'vulopilot'),
			desc: __(
				'What kind of business this is — shown on the Business Profile card, not written into any structured data.',
				'vulopilot'
			),
		},
		{
			key: 'entity_business_type',
			type: 'text',
			label: __('Business type', 'vulopilot'),
			settingDescription: __(
				'e.g. Software Company, Online Store, Consulting Agency.',
				'vulopilot'
			),
		},
		{
			key: 'entity_service_pages',
			type: 'textarea',
			label: __('Service pages', 'vulopilot'),
			settingDescription: __(
				'e.g. https://example.com/consulting/ or just the page ID.',
				'vulopilot'
			),
		},
		{
			key: 'entity_business_locations',
			type: 'textarea',
			label: __('Business locations', 'vulopilot'),
			settingDescription: __(
				'e.g. Downtown Store | 123 Main St, Springfield.',
				'vulopilot'
			),
		},
		{
			// Not a real, independently-writable field here — the actual
			// enable/threshold live in the real, single nested
			// `visibility_alerts.kg` setting (Utill::VULOPILOT_SETTINGS_DEFAULTS),
			// edited on its own dedicated Notifications tab instead. Same
			// "real `type: 'notice'` pointing elsewhere rather than a
			// second control duplicating the same setting" reasoning
			// AiVisibility.ts's own `aeo-drop-threshold-note` documents.
			key: 'kg-health-drop-threshold-note',
			type: 'notice',
			noticeType: 'info',
			label: '',
			message: __(
				'Knowledge Graph Health drop alerts (and their threshold) are configured under <a href="?page=vulopilot#&tab=settings&subtab=visibility-alerts">Notifications → Visibility Alerts</a>.',
				'vulopilot'
			),
		},
	],
};
