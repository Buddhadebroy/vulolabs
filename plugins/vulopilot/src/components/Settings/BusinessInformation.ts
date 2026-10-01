import { __ } from '@wordpress/i18n';

/**
 * Settings → Business Information, a standalone top-level tab defined as a declarative `modal`.
 */
export default {
    id: 'business-information',
    priority: 1,
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
                'What kind of business this is - shown on the Business Profile card, not written into any structured data.',
                'vulopilot'
            ),
        },
        {
            key: 'site_tone',
            type: 'text',
            label: __('Site tone', 'vulopilot'),
            settingDescription: __(
                'A short description of how this site should sound (e.g. "Friendly and casual" or "Formal and technical") - included with every AI request.',
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
            key: 'general_settings',
            type: 'section',
            icon: 'person',
            title: __('Competitors', 'vulopilot'),
            desc: __(
                'Used to calculate Share of Voice on the Brand Visibility page.',
                'vulopilot'
            ),
        },
        {
            key: 'geo_competitor_urls',
            type: 'dynamic-row',
            moduleEnabled: 'geo-analysis',
            proSetting: true,
            addLabel: __('Add competitor', 'vulopilot'),
            emptyText: __('No competitors added yet.', 'vulopilot'),
            template: {
                fields: [
                    {
                        key: 'name',
                        type: 'text',
                        label: __('Name', 'vulopilot'),
                        placeholder: __('Competitor name', 'vulopilot'),
                    },
                    {
                        key: 'url',
                        type: 'text',
                        label: __('URL', 'vulopilot'),
                        size: '20rem',
                        placeholder: __('https://competitor.com', 'vulopilot'),
                    },
                ],
            },
        },
    ],
};
