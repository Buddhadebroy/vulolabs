import { __ } from '@wordpress/i18n';

/** Settings → Business Information, a standalone top-level tab defined as a declarative `modal`. */
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
            type: 'textarea',
            label: __('Site tone', 'vulopilot'),
            settingDescription: __(
                'A short description of how this site should sound (e.g. "Friendly and casual" or "Formal and technical") - included with every AI request.',
                'vulopilot'
            ),
        },
        {
            key: 'entity_business_type',
            type: 'textarea',
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
            key: 'entity-section-knowledge-graph',
            type: 'section',
            icon: 'category',
            title: __('Knowledge Graph', 'vulopilot'),
            desc: __(
                'Written into the Organization structured data every page on your site carries, and shown to search engines, social platforms, and AI assistants.',
                'vulopilot'
            ),
        },
        {
            key: 'entity_business_name',
            type: 'text',
            label: __('Organization name', 'vulopilot'),
            settingDescription: __(
                'Defaults to your site title when left blank.',
                'vulopilot'
            ),
        },
        {
            key: 'entity_business_email',
            type: 'text',
            label: __('Contact email', 'vulopilot'),
        },
        {
            key: 'entity_business_phone',
            type: 'text',
            label: __('Contact phone', 'vulopilot'),
            placeholder: __('+1 555 0100', 'vulopilot'),
        },
        {
            key: 'entity_business_street',
            type: 'text',
            label: __('Street address', 'vulopilot'),
        },
        {
            key: 'entity_business_city',
            type: 'text',
            label: __('City', 'vulopilot'),
            size: 15,
        },
        {
            key: 'entity_business_region',
            type: 'text',
            label: __('State/region', 'vulopilot'),
            size: 15,
        },
        {
            key: 'entity_business_postal_code',
            type: 'text',
            label: __('Postal code', 'vulopilot'),
            size: 15,
        },
        {
            key: 'entity_business_country',
            type: 'text',
            label: __('Country', 'vulopilot'),
            size: 15,
        },
        {
            key: 'social_profile_urls',
            type: 'textarea',
            label: __('Social profile URLs', 'vulopilot'),
            settingDescription: __(
                'One per line - Facebook, X/Twitter, LinkedIn, etc. Listed as this Organization\'s sameAs URLs.',
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
