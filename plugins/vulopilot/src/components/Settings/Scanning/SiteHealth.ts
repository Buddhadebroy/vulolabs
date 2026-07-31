import { __ } from '@wordpress/i18n';

export default {
	id: 'site-health',
	priority: 3,
	headerTitle: __('Site Health', 'vulopilot'),
	headerIcon: 'shield',
	submitUrl: 'settings',
	modal: [
		{
			key: 'security-section',
			type: 'section',
			title: __('Security', 'vulopilot'),
		},
		{
			key: 'enable_weak_password_scanner',
			type: 'checkbox',
			look: 'toggle',
			label: __('Check administrators for weak passwords', 'vulopilot'),
			desc: __(
				'Checks every administrator account\'s password against a small dictionary of the most commonly used passwords during each scan, using the same hashing check WordPress itself uses at login.',
				'vulopilot'
			),
			options: [
				{ key: 'enable_weak_password_scanner', label: '', value: 'enable_weak_password_scanner' },
			],
		},
		{
			key: 'enable_basic_vulnerabilities_scanner',
			type: 'checkbox',
			look: 'toggle',
			label: __('Check for basic vulnerability exposure', 'vulopilot'),
			desc: __(
				'Checks whether the WordPress version is exposed via the homepage or readme.html, and whether the database table prefix is left at its default.',
				'vulopilot'
			),
			options: [
				{ key: 'enable_basic_vulnerabilities_scanner', label: '', value: 'enable_basic_vulnerabilities_scanner' },
			],
		},
		{
			key: 'enable_core_file_integrity_scanner',
			type: 'checkbox',
			look: 'toggle',
			label: __('Check WordPress core files for changes', 'vulopilot'),
			desc: __(
				'Compares every WordPress core file against the official checksums published for this exact version, flagging anything modified or missing.',
				'vulopilot'
			),
			options: [
				{ key: 'enable_core_file_integrity_scanner', label: '', value: 'enable_core_file_integrity_scanner' },
			],
		},
		{
			key: 'enable_rest_api_scanner',
			type: 'checkbox',
			look: 'toggle',
			label: __('Check for anonymous REST API user exposure', 'vulopilot'),
			desc: __(
				'Makes a real, unauthenticated request to this site\'s own /wp/v2/users endpoint during each scan to check whether it exposes usernames. Turn off if your firewall/WAF flags this request.',
				'vulopilot'
			),
			options: [
				{ key: 'enable_rest_api_scanner', label: '', value: 'enable_rest_api_scanner' },
			],
			// The admin-username check and this REST API exposure check
			// live in vulopilot-pro's SecurityMonitoring module — the three
			// scanners above are the first free scanners this category has
			// ever had (SECURITY-MODULE.md). Pre-existing gap, unrelated to
			// this pass: enable_xmlrpc_scanner/enable_security_headers_scanner/
			// enable_exposed_files_scanner already exist as real settings
			// keys (Utill.php) that XmlrpcExposureScanner/
			// SecurityHeadersScanner/ExposedFilesScanner already read, but
			// none of the three has ever had its own field on this screen —
			// only this REST toggle does. Left as-is; adding the missing
			// three fields is a pure UI gap-fill unrelated to this phase's
			// scope, documented here rather than silently left unexplained.
			moduleEnabled: 'security-monitoring',
		},
		{
			key: 'security_monitoring',
			type: 'section',
			title: __('Security Monitoring', 'vulopilot'),
			desc: __('', 'vulopilot'),
		},
		{
			key: 'security_scan_frequency',
			type: 'select',
			label: __('Scheduled security monitoring', 'vulopilot'),
			desc: __(
				'Runs only the security-category scanners on this cadence, independent of the general Scan frequency setting under General.',
				'vulopilot'
			),
			options: [
				{ label: __('Off', 'vulopilot'), value: 'disabled' },
				{ label: __('Hourly', 'vulopilot'), value: 'hourly' },
				{ label: __('Daily', 'vulopilot'), value: 'daily' },
				{ label: __('Weekly', 'vulopilot'), value: 'weekly' },
			],
			moduleEnabled: 'security-monitoring',
		},
		{
			key: 'security_alerts_enabled',
			type: 'checkbox',
			look: 'toggle',
			label: __('Email me on new security alerts', 'vulopilot'),
			desc: __(
				'Send an email when a scan detects a new security finding at or above the minimum severity below. Already-alerted, still-open findings aren\'t re-sent on every scan.',
				'vulopilot'
			),
			options: [
				{ key: 'security_alerts_enabled', label: '', value: 'security_alerts_enabled' },
			],
			moduleEnabled: 'security-monitoring',
		},
		{
			key: 'security_alert_email',
			type: 'email',
			label: __('Security alert email', 'vulopilot'),
			placeholder: __('noreply@yourstore.com', 'vulopilot'),
			desc: __(
				'Where security alerts are sent. Falls back to the site admin email when left blank.',
				'vulopilot'
			),
			moduleEnabled: 'security-monitoring',
		},
		{
			key: 'security_alert_min_severity',
			type: 'select',
			label: __('Minimum alert severity', 'vulopilot'),
			desc: __(
				'Only findings at or above this severity trigger a security alert email.',
				'vulopilot'
			),
			options: [
				{ label: __('Critical only', 'vulopilot'), value: 'critical' },
				{ label: __('High and above', 'vulopilot'), value: 'high' },
				{ label: __('Medium and above', 'vulopilot'), value: 'medium' },
				{ label: __('Low and above', 'vulopilot'), value: 'low' },
			],
			moduleEnabled: 'security-monitoring',
		},
		{
			key: 'enable_integrity_monitoring',
			type: 'checkbox',
			look: 'toggle',
			label: __('Monitor plugin/theme files for changes', 'vulopilot'),
			desc: __(
				'Maintains a local baseline of every plugin/theme PHP file and flags any added, modified, or removed since the last scan.',
				'vulopilot'
			),
			options: [
				{ key: 'enable_integrity_monitoring', label: '', value: 'enable_integrity_monitoring' },
			],
			moduleEnabled: 'security-monitoring',
		},
		{
			key: 'integrity_monitoring_max_files',
			type: 'number',
			label: __('Integrity monitoring file limit', 'vulopilot'),
			minNumber: 100,
			maxNumber: 20000,
			desc: __(
				'Maximum combined number of plugin/theme PHP files checked per scan, to bound the cost of hashing on large sites.',
				'vulopilot'
			),
			moduleEnabled: 'security-monitoring',
		},
		{
			key: 'accessibility-section',
			type: 'section',
			title: __('Accessibility', 'vulopilot'),
		},
		{
			key: 'enable_wcag_scanner',
			type: 'checkbox',
			look: 'toggle',
			label: __('Check for generic, out-of-context link text', 'vulopilot'),
			desc: __(
				'Flags links whose entire visible text is a generic phrase like "click here" or "read more" — link text should describe its own destination (WCAG 2.4.4).',
				'vulopilot'
			),
			options: [
				{ key: 'enable_wcag_scanner', label: '', value: 'enable_wcag_scanner' },
			],
		},
		{
			key: 'accessibility_audit_frequency',
			type: 'select',
			label: __('Scheduled accessibility audits', 'vulopilot'),
			desc: __(
				'Runs only the accessibility-category scanners on this cadence, independent of the general Scan frequency setting under General.',
				'vulopilot'
			),
			options: [
				{ label: __('Off', 'vulopilot'), value: 'disabled' },
				{ label: __('Hourly', 'vulopilot'), value: 'hourly' },
				{ label: __('Daily', 'vulopilot'), value: 'daily' },
				{ label: __('Weekly', 'vulopilot'), value: 'weekly' },
			],
			moduleEnabled: 'accessibility-audits',
		},
		{
			key: 'target_wcag_level',
			type: 'select',
			label: __('Target WCAG level', 'vulopilot'),
			desc: __(
				'Used to determine which accessibility checks are marked critical vs. warning.',
				'vulopilot'
			),
			options: [
				{ label: __('WCAG 2.1 A', 'vulopilot'), value: '2.1_a' },
				{ label: __('WCAG 2.1 AA', 'vulopilot'), value: '2.1_aa' },
				{ label: __('WCAG 2.1 AAA', 'vulopilot'), value: '2.1_aaa' },
			],
		},
		{
			key: 'performance-section',
			type: 'section',
			title: __('Performance', 'vulopilot'),
		},
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
