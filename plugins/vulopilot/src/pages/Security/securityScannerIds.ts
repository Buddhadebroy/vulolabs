/**
 * Every scanner id "Security Findings" rolls up (rather than `category="security"` alone, so it
 * doesn't silently drop RestApiScanner's findings - its own category is `rest-api`, not
 * `security`, see that scanner's own docblock).
 */
export const SECURITY_FINDINGS_SCANNER_IDS = [
	'weak-passwords',
	'rest-api',
	'xmlrpc-exposure',
	'exposed-files',
	'debug-mode',
	'file-editor',
	'security-headers',
	'security',
	'ssl-monitoring',
	'core-file-integrity',
	'integrity-monitoring',
	'basic-vulnerabilities',
	'advanced-vulnerabilities',
	'theme-vulnerabilities',
	// Malware/Firewall/Login Protection/Backups tiles (SecurityMetricsGrid.tsx).
	'malware',
	'firewall',
	'login-protection',
	'backup-health',
];
