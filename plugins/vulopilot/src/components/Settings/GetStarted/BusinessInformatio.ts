import { __ } from '@wordpress/i18n';

export default {
    id: 'business-informa',
    priority: 3,
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
