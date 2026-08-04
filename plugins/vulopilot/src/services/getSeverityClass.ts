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
