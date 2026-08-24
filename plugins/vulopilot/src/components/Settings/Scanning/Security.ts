import { __ } from '@wordpress/i18n';

export default {
	id: 'security-scanning',
	priority: 3,
	headerTitle: __('Security', 'vulopilot'),
	settingTitle:__('Security', 'vulopilot'),
	headerDescription: __(
		'Security, accessibility, and performance scanning behavior.',
		'vulopilot'
	),
	headerIcon: 'security',
	submitUrl: 'settings',
	modal: [
		{
			key: 'enable_weak_password_scanner',
			type: 'checkbox',
			look: 'toggle',
			
			label: __('Check administrators for weak passwords', 'vulopilot'),
			settingDescription: __(
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
			settingDescription: __(
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
			settingDescription: __(
				'Compares every WordPress core file against the official checksums published for this exact version, flagging anything modified or missing.',
				'vulopilot'
			),
			options: [
				{ key: 'enable_core_file_integrity_scanner', label: '', value: 'enable_core_file_integrity_scanner' },
			],
		},
		{
			key: 'enable_malware_scanner',
			type: 'checkbox',
			look: 'toggle',

			label: __('Check for malware and infected files', 'vulopilot'),
			settingDescription: __(
				'Flags any PHP file found inside the uploads directory (which should never contain one), plus known backdoor/webshell code patterns in your active theme\'s own files.',
				'vulopilot'
			),
			options: [
				{ key: 'enable_malware_scanner', label: '', value: 'enable_malware_scanner' },
			],
		},
		{
			key: 'enable_login_protection',
			type: 'checkbox',
			look: 'toggle',

			label: __('Block repeated failed login attempts', 'vulopilot'),
			settingDescription: __(
				'Real brute-force protection — an IP that fails to log in too many times within the window below is blocked from trying again until it passes.',
				'vulopilot'
			),
			options: [
				{ key: 'enable_login_protection', label: '', value: 'enable_login_protection' },
			],
		},
		{
			key: 'login_max_attempts',
			type: 'number',
			size: 10,
			label: __('Failed attempts before lockout', 'vulopilot'),
			minNumber: 1,
			maxNumber: 20,
			settingDescription: __(
				'How many failed login attempts from the same IP are allowed before it\'s blocked.',
				'vulopilot'
			),
		},
		{
			key: 'login_lockout_minutes',
			type: 'number',
			size: 10,
			label: __('Lockout window (minutes)', 'vulopilot'),
			minNumber: 1,
			maxNumber: 1440,
			settingDescription: __(
				'How long a blocked IP has to wait — and how far back failed attempts are counted from.',
				'vulopilot'
			),
		},
		{
			key: 'enable_firewall',
			type: 'checkbox',
			look: 'toggle',

			label: __('Log requests matching known attack patterns', 'vulopilot'),
			settingDescription: __(
				'Checks every request\'s URL against known SQL-injection, path-traversal, and direct-PHP-execution patterns and logs any match — always safe, never blocks anyone on its own.',
				'vulopilot'
			),
			options: [
				{ key: 'enable_firewall', label: '', value: 'enable_firewall' },
			],
		},
		{
			key: 'enable_firewall_blocking',
			type: 'checkbox',
			look: 'toggle',

			label: __('Enable active blocking', 'vulopilot'),
			settingDescription: __(
				'Turns the logging above into real blocking — a matched request gets a 403 and is stopped immediately instead of only being recorded. Off by default: review the log for a while first to make sure nothing legitimate is being flagged.',
				'vulopilot'
			),
			options: [
				{ key: 'enable_firewall_blocking', label: '', value: 'enable_firewall_blocking' },
			],
		},
		{
			key: 'enable_rest_api_scanner',
			type: 'checkbox',
			look: 'toggle',
			
			label: __('Check for anonymous REST API user exposure', 'vulopilot'),
			settingDescription: __(
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
			size: 8,
			label: __('Scheduled security monitoring', 'vulopilot'),
			settingDescription: __(
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
			settingDescription: __(
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
			size: 20,
			label: __('Security alert email', 'vulopilot'),
			placeholder: __('noreply@yourstore.com', 'vulopilot'),
			settingDescription: __(
				'Where security alerts are sent. Falls back to the site admin email when left blank.',
				'vulopilot'
			),
			moduleEnabled: 'security-monitoring',
		},
		{
			key: 'security_alert_min_severity',
			type: 'select',
			size: 10,
			label: __('Minimum alert severity', 'vulopilot'),
			settingDescription: __(
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
			settingDescription: __(
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
			size: 10,
			label: __('Integrity monitoring file limit', 'vulopilot'),
			minNumber: 100,
			maxNumber: 20000,
			settingDescription: __(
				'Maximum combined number of plugin/theme PHP files checked per scan, to bound the cost of hashing on large sites.',
				'vulopilot'
			),
			moduleEnabled: 'security-monitoring',
		},
		{
			// Accessibility's own 3 fields (enable_wcag_scanner/
			// accessibility_audit_frequency/target_wcag_level) moved to
			// their own Settings → Scanning → Accessibility tab — see
			// Accessibility.ts's own docblock. `target_wcag_level` also
			// gained a real PHP consumer there for the first time (it was
			// a fully orphaned UI-only field here before).
			key: 'performance-section',
			type: 'section',
			title: __('Performance', 'vulopilot'),
		},
		{
            key: 'mobile_core_web_vitals',
            type: 'checkbox',
            look: 'toggle',
            
            label: __('Include mobile Core Web Vitals', 'vulopilot'),
            settingDescription: __(
                'Run Core Web Vitals checks against mobile as well as desktop.',
                'vulopilot'
            ),
            options: [
                { key: 'mobile_core_web_vitals', label: '', value: 'mobile_core_web_vitals' },
            ],
        },
	],
};
