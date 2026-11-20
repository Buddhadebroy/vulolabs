/* global vulopilotAppLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import type { FindingGroup } from '../../components/Issues/issuesTypes';
import { formatAffected } from '../../components/Issues/issuesTypes';
import type { PageSpeedIssue } from './SlowPagesTab';

interface BiggestSpeedOpportunityCardProps {
	/** The page's open performance groups, worst first: the fallback when no page has been speed-tested. */
	groups: FindingGroup[];
	onViewSlowPages: () => void;
	onViewIssues: () => void;
}

/**
 * "Biggest opportunity": the issue on the most slow pages (`GET /page-speed` top issue), or else the worst open
 * performance finding.
 */
const BiggestSpeedOpportunityCard = ({ groups, onViewSlowPages, onViewIssues }: BiggestSpeedOpportunityCardProps) => {
	const [topIssue, setTopIssue] = useState<PageSpeedIssue | null>(null);

	useEffect(() => {
		getApiResponse<{ top_issues?: PageSpeedIssue[] }>(`${getApiLink(vulopilotAppLocalizer, 'page-speed')}?per_page=1`, {
			headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce },
		}).then((response) => setTopIssue(response?.top_issues?.[0] ?? null));
	}, []);

	const worst = groups[0];

	if (!topIssue && !worst) {
		return null;
	}

	const title = topIssue ? topIssue.issue : worst.label;
	const reach = topIssue
		? sprintf(
				/* translators: %d: number of pages. */
				_n('Slows down %d page', 'Slows down %d pages', topIssue.affected_pages, 'vulopilot'),
				topIssue.affected_pages
		  )
		: sprintf(
				/* translators: %s: what it affects, e.g. "1 endpoint". */
				__('Affects %s', 'vulopilot'),
				formatAffected(worst.count, worst.object_type)
		  );

	return (
		<button type="button" className="vp-card vp-opportunity" onClick={topIssue ? onViewSlowPages : onViewIssues}>
			<span className="vp-opportunity-tag">
				<i className="adminfont-light" aria-hidden="true" />
				{__('Biggest opportunity', 'vulopilot')}
			</span>
			<strong>{title}</strong>
			<span className="vp-opportunity-reach">{reach}</span>
			<span className="vp-opportunity-go">
				{topIssue ? __('See slow pages', 'vulopilot') : __('See the fix', 'vulopilot')}
				<i className="adminfont-arrow-right" aria-hidden="true" />
			</span>
		</button>
	);
};

export default BiggestSpeedOpportunityCard;
