import { __, sprintf } from '@wordpress/i18n';
import { useApiList } from './useApiList';
import { FindingSeverity, getSeverityClass } from './getSeverityClass';

const SEVERITY_ORDER: FindingSeverity[] = [
	'critical',
	'high',
	'medium',
	'low',
	'info',
];

const SEVERITY_LABEL: Record<FindingSeverity, string> = {
	critical: __('Critical', 'vulopilot'),
	high: __('High', 'vulopilot'),
	medium: __('Medium', 'vulopilot'),
	low: __('Low', 'vulopilot'),
	info: __('Info', 'vulopilot'),
};

interface StatusRow {
	severity: FindingSeverity;
}

export interface SectionStatusBadge {
	text: string;
	color: string;
}

/**
 * Same real total-open / top-severity numbers `badge` below already
 * combines into one "N Open · N {Severity} Severity" string — as 2
 * separate badges instead, for a caller that wants them shown as 2 real
 * pills (e.g. SiteHealthStatusCard.tsx's own `ListComponent` row) rather
 * than one merged one. Always either `null` (still loading) or exactly the
 * same real entries `badge`'s own text would have combined — 1 entry for
 * "No open findings"/plain "N Open" (nothing to split), 2 for the
 * "N Open · N {Severity} Severity" case.
 */
export type SectionStatusBadges = SectionStatusBadge[] | null;

/**
 * "3 Open · 1 High Severity"-style summary for a section card's title
 * (CardComponent's own `badges` prop — same `admin-badge` tag styling
 * every other badge in this app already uses). A section's own
 * FindingsTable already fetches this same scannerIds group internally,
 * but that fetch is paginated/searchable table state, not a stable
 * sitewide summary — same reasoning OpenIssuesGlimpse's own independent
 * summary fetch already documents for the identical tradeoff (a second,
 * small request instead of reaching into FindingsTable's own state).
 *
 * `per_page: 100` bounds the client-side severity tally to the 100 most
 * recent open findings rather than the true total when a section has
 * more open findings than that — total itself (open count) is always
 * exact, only the "N {severity} Severity" breakdown could undercount on
 * a section with 100+ open findings, a scale this app's per-scanner-group
 * sections aren't expected to reach.
 */
export const useSectionStatus = (
	category: string,
	scannerIds: string[]
): {
	badge: SectionStatusBadge | null;
	badges: SectionStatusBadges;
	isLoading: boolean;
} => {
	const { data, total, isLoading } = useApiList<StatusRow>('findings', {
		category,
		scanner_id: scannerIds.length ? scannerIds.join(',') : undefined,
		status: 'open',
		per_page: 100,
	});

	if (isLoading) {
		return { badge: null, badges: null, isLoading: true };
	}

	if (total === 0) {
		const badge = { text: __('No open findings', 'vulopilot'), color: 'green' };
		return { badge, badges: [badge], isLoading: false };
	}

	const topSeverity = SEVERITY_ORDER.find((severity) =>
		data.some((row) => row.severity === severity)
	);

	if (!topSeverity) {
		const badge = {
			text: sprintf(
				/* translators: %d is the number of open findings. */
				__('%d Open', 'vulopilot'),
				total
			),
			color: 'orange',
		};
		return { badge, badges: [badge], isLoading: false };
	}

	const topSeverityCount = data.filter(
		(row) => row.severity === topSeverity
	).length;

	const openBadge = {
		text: sprintf(
			/* translators: %d is the number of open findings. */
			__('%d Open', 'vulopilot'),
			total
		),
		color: 'orange',
	};
	const severityBadge = {
		text: sprintf(
			/* translators: 1: count at the highest severity present, 2: that severity's label. */
			__('%1$d %2$s', 'vulopilot'),
			topSeverityCount,
			SEVERITY_LABEL[topSeverity]
		),
		color: getSeverityClass(topSeverity),
	};

	return {
		badge: {
			text: sprintf(
				/* translators: 1: total open findings, 2: count at the highest severity present, 3: that severity's label. */
				__('%1$d Open · %2$d %3$s Severity', 'vulopilot'),
				total,
				topSeverityCount,
				SEVERITY_LABEL[topSeverity]
			),
			color: getSeverityClass(topSeverity),
		},
		badges: [openBadge, severityBadge],
		isLoading: false,
	};
};
