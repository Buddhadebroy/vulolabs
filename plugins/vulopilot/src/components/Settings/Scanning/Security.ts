import { createElement } from 'react';
import { __ } from '@wordpress/i18n';
import SecurityPanel from './SecurityPanel';
import SecurityRestoreDefaultsHeader from './SecurityRestoreDefaultsHeader';

/**
 * Settings → Scanning → Security.
 *
 * Fully hand-rendered by SecurityPanel.tsx (the `PanelComponent` escape
 * hatch Settings.tsx's own generic `settingModal?.PanelComponent` branch
 * uses — same mechanism Connections/AiProviders.ts and
 * Connections/GoogleServices.ts already carry) rather than InputRenderer,
 * so every field below stays listed here purely so SettingContext still
 * seeds their real current values — none of them render through this
 * `modal` array directly. See SecurityPanel.tsx's own docblock for the
 * actual layout (3 real card panels — Security scans / Protection /
 * Security Monitoring — plus one plain frequency select).
 *
 * "Restore Defaults" is SecurityRestoreDefaultsHeader.tsx — extracted out
 * of SecurityPanel.tsx's own body (per direct instruction, same extraction
 * AiVisibilityScansHeader.tsx/ContentSearchScansHeader.tsx already are)
 * into this tab's own top-level `settingAction` instead of being rendered
 * inline at the top of that panel. `settingAction` is
 * NavigatorComponent.tsx's own per-tab header action slot
 * (`renderSettingHeaderInfo()`'s `<SectionComponent
 * rightContent={activeFile.settingAction} />`, rendered once above every
 * tab's own fields — real regardless of whether that tab uses `modal` or,
 * like this one, `PanelComponent`), so this now sits right next to
 * "Security" itself instead of as a bare block above SecurityPanel's own
 * body.
 *
 * `mobile_core_web_vitals` (previously this tab's own stray "Performance"
 * section) moved out to Settings → General — it isn't a security setting,
 * and this tab is now scoped to exactly what its own mockup shows plus the
 * security-relevant settings that were already real and already lived
 * here (login protection, firewall, Security Monitoring).
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
