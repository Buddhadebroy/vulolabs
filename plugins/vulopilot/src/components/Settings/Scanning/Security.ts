import { createElement } from 'react';
import { __ } from '@wordpress/i18n';
import SecurityPanel from './SecurityPanel';
import SecurityRestoreDefaultsHeader from './SecurityRestoreDefaultsHeader';

/**
 * Settings → Scanning → Security.
 */
export default {
	id: 'security-scanning',
	priority: 3,
	headerTitle: __('Security', 'vulopilot'),
	settingTitle: __('Security', 'vulopilot'),
	headerDescription: __(
		'These scans help you find security risks and keep your website safe.',
		'vulopilot'
	),
	headerIcon: 'security',
	submitUrl: 'settings',
	settingAction: createElement(SecurityRestoreDefaultsHeader),
	PanelComponent: SecurityPanel,
	groupBySections: true,
	hideSettingHeader: true,
	modal: [
		{
			key: 'general_settings',
			type: 'section',
			icon: 'setting',
			title: __('Site Monitoring', 'vulopilot'),
			desc: __('Configure how vuloPilot monitors your site for issues.', 'vulopilot'),
		},
		{ key: 'enable_weak_password_scanner', type: 'checkbox', label: '', options: [] },
		{ key: 'enable_basic_vulnerabilities_scanner', type: 'checkbox', label: '', options: [] },
		{ key: 'enable_core_file_integrity_scanner', type: 'checkbox', label: '', options: [] },
		{ key: 'enable_malware_scanner', type: 'checkbox', label: '', options: [] },
		{ key: 'enable_rest_api_scanner', type: 'checkbox', label: '', options: [] },
		{ key: 'enable_login_protection', type: 'checkbox', label: '', options: [] },
		{ key: 'login_max_attempts', type: 'number', label: '' },
		{ key: 'login_lockout_minutes', type: 'number', label: '' },
		{ key: 'enable_firewall', type: 'checkbox', label: '', options: [] },
		{ key: 'enable_firewall_blocking', type: 'checkbox', label: '', options: [] },
		{ key: 'security_scan_frequency', type: 'select', label: '', options: [] },
		{ key: 'security_alerts_enabled', type: 'checkbox', label: '', options: [] },
		{ key: 'security_alert_email', type: 'email', label: '' },
		{ key: 'security_alert_min_severity', type: 'select', label: '', options: [] },
		{ key: 'enable_integrity_monitoring', type: 'checkbox', label: '', options: [] },
		{ key: 'integrity_monitoring_max_files', type: 'number', label: '' },
	],
};
