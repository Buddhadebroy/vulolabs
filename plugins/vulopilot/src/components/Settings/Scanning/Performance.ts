import { __ } from '@wordpress/i18n';

export default {
    id: 'performance',
    priority: 4,
    headerTitle: __('Performance', 'vulopilot'),
    headerIcon: 'universal-access-alt',
    submitUrl: 'settings',
    modal: [
        {
            key: 'mobile_core_web_vitals',
            type: 'checkbox',
            look: 'toggle',
            label: __('Include mobile Core Web Vitals', 'vulopilot'),
            desc: __(
                'Run Core Web Vitals checks against mobile as well as desktop.',
                'vulopilot'
            ),
            options: [
                { key: 'mobile_core_web_vitals', label: '', value: 'mobile_core_web_vitals' },
            ],
        },
    ],
};
