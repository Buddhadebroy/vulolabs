/** A scored card's 3-tier rating label + `good`/`needs-improvement`/`poor` CSS class. */
export interface Rating {
	label: string;
	className: 'good' | 'needs-improvement' | 'poor';
}

/** Shared "last N days" trend-period selector value, used by every trend-chart card. */
export type PeriodDays = '7' | '30' | '90';
