export type FindingSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info';

/** Same plain color-name modifier classes HealthPillarsWidget's own
 * `admin-badge` usage already uses (`green`/`red`/`yellow`), rather than a
 * new class per severity level. */
export const getSeverityClass = (severity: FindingSeverity): string => {
	switch (severity) {
		case 'critical':
			return 'red';
		case 'high':
			return 'green';
		case 'medium':
			return 'yellow';
		case 'low':
			return 'grey';
		case 'info':
			return 'blue';
		default:
			return '';
	}
};

/**
 * Actual hex value behind each severity, for spots that need a real CSS
 * color rather than an `admin-badge` modifier class — e.g. FindingsTable's
 * `layout="compact"` row icon. Same 5-value palette the Issues table's own
 * `.badge-*`/`.attention-priority-pills` scale already uses
 * (AICopilot.scss), reused here rather than invented fresh so a finding's
 * severity reads the same color everywhere in the app.
 */
export const getSeverityColor = (severity: FindingSeverity): string => {
	switch (severity) {
		case 'critical':
			return '#dc2626';
		case 'high':
			return '#d88c5c';
		case 'medium':
			return '#b45309';
		case 'low':
			return '#5baab3';
		case 'info':
		default:
			return '#6b7280';
	}
};
