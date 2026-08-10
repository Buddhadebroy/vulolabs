/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent } from '@zyra/components';

interface DashboardStats {
	open_findings: number;
	findings_by_severity: {
		critical: number;
		high: number;
		medium: number;
		low: number;
	};
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };
const ISSUES_TAB_URL =
	'?page=vulopilot#&tab=ai-assistant&subtab=issues';

/**
 * The mockup's "AI Highlights" row has 4 tiles — "Biggest Win" and "AI
 * Success" have no real concept to map to anywhere in this codebase
 * (dropped, same "drop what's unmappable rather than force it" call
 * AutomationLinksRow.tsx made for 3-of-5 cards on Automate Work). Keeps 2,
 * both real, both already-aggregated server-side by GET /dashboard (no
 * capped client-side count): Needs Attention (`findings_by_severity`
 * critical+high) and Opportunities (`open_findings`, same "AI found N
 * opportunities" framing this session's AiOpportunitiesCard.tsx/
 * AiInsightBanner.tsx already established — no fabricated $ value).
 */
const ReportHighlightsRow = () => {
	const [stats, setStats] = useState<DashboardStats | null>(null);

	useEffect(() => {
		getApiResponse<DashboardStats>(
			getApiLink(appLocalizer, 'dashboard'),
			nonceHeaders
		).then((response) => {
			if (response) {
				setStats(response);
			}
		});
	}, []);

	const needsAttention = stats
		? stats.findings_by_severity.critical + stats.findings_by_severity.high
		: null;

	const goToRecommendations = () => {
		window.location.href = ISSUES_TAB_URL;
	};

	return (
		<div className="report-highlights-row">
			<CardComponent
				className="report-highlight-tile"
				titleIcon="error"
				title={__('Needs Attention', 'vulopilot')}
			>
				<p className="report-highlight-value">
					{needsAttention === null ? '—' : needsAttention}
				</p>
				<p className="report-highlight-desc">
					{__(
						'Critical and high-severity findings still open.',
						'vulopilot'
					)}
				</p>
				<button
					type="button"
					className="report-highlight-action"
					onClick={goToRecommendations}
				>
					{__('Review', 'vulopilot')}{' '}
					<i className="adminfont-arrow-right" />
				</button>
			</CardComponent>
			<CardComponent
				className="report-highlight-tile"
				titleIcon="search-discovery"
				title={__('Opportunities', 'vulopilot')}
			>
				<p className="report-highlight-value">
					{stats === null ? '—' : stats.open_findings}
				</p>
				<p className="report-highlight-desc">
					{stats === null
						? ''
						: sprintf(
								/* translators: %d: number of open findings */
								__(
									'AI found %d opportunities to improve your site.',
									'vulopilot'
								),
								stats.open_findings
							)}
				</p>
				<button
					type="button"
					className="report-highlight-action"
					onClick={goToRecommendations}
				>
					{__('Review', 'vulopilot')}{' '}
					<i className="adminfont-arrow-right" />
				</button>
			</CardComponent>
		</div>
	);
};

export default ReportHighlightsRow;
