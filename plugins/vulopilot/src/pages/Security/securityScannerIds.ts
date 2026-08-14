/**
 * Every scanner id "Security Findings" rolls up (rather than
 * `category="security"` alone, so it doesn't silently drop
 * RestApiScanner's findings — its own category is `rest-api`, not
 * `security`, see that scanner's own docblock). Its own file (not declared
 * inline in SecurityTab.tsx, where it originally lived) so
 * SecurityMetricsGrid.tsx can reuse it for its own "Security Scan" tile's
 * real last-scan-time lookup without creating a SecurityTab.tsx →
 * SecurityMockupHeader.tsx → SecurityMetricsGrid.tsx → SecurityTab.tsx
 * import cycle (webpack silently leaves a still-initializing circular
 * import's named export `undefined` at the importing module's own
 * top-level eval time, which blanked this whole tab the first time this
 * was imported straight from SecurityTab.tsx).
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
];
