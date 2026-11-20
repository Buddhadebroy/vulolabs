/** A scored card's 3-tier rating label + `good`/`needs-improvement`/`poor` CSS class. */
export interface Rating {
	label: string;
	className: 'good' | 'needs-improvement' | 'poor';
}

