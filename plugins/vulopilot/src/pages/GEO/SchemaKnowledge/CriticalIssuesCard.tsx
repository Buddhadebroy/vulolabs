/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse, scrollToId } from '@zyra/core';
import { CardComponent, ColumnComponent, ModuleGuardComponent } from '@zyra/components';
import type { FindingGroup } from '../../AIAssistant/issuesTypes';

/** Same real 5 scanner ids IssuesSection.tsx's own SCHEMA_ISSUE_SCANNER_IDS already uses — one real fetch, scoped here to this card's own compact preview. */
const SCHEMA_ISSUE_SCANNER_IDS = [
	'schema',
	'structured-data',
	'sitewide-structured-data',
	'organization-schema',
	'author-schema',
];

const MAX_PREVIEW_ROWS = 4;

interface GroupsResponse {
	data: FindingGroup[];
	total: number;
}

/**
 * "Critical Issues" — replaces the former "We understand your organization,
 * products, categories." headline+tiles card (`BusinessUnderstandingCard`'s
 * own 2nd, grid={8} half) per direct instruction to remove that section and
 * build the 2 cards from a reference mockup instead. Real data, same fetch
 * IssuesSection.tsx's own full table and the (now removed) WhatNeedsFixingCard
 * both already use (`GET /findings/groups`, the 5 real schema/entity scanner
 * ids) — scoped here with `priority=high`, which `Findings.php`'s own
 * `PRIORITY_SEVERITY_RANKS` documents as the real critical+high severity
 * bucket (the same 3-tier collapse this page's own Issues section stat tiles
 * already use), rather than a 4th, separately-invented "critical" filter.
 * "View all issues →" scrolls to the real Issues table below
 * (`schema-knowledge-issues`) instead of re-implementing it here.
 */
const CriticalIssuesCard = () => {
	const [groups, setGroups] = useState<FindingGroup[]>([]);
	const [total, setTotal] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	const fetchGroups = () => {
		setIsLoading(true);
		setError(null);

		getApiResponse<GroupsResponse>(
			getApiLink(
				appLocalizer,
				`findings/groups?scanner_id=${SCHEMA_ISSUE_SCANNER_IDS.join(',')}&priority=high&per_page=${MAX_PREVIEW_ROWS}`
			),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setGroups(response.data ?? []);
					setTotal(response.total ?? 0);
				} else {
					setError(
						__('Something went wrong while loading issues.', 'vulopilot')
					);
				}
			})
			.finally(() => setIsLoading(false));
	};

	useEffect(() => {
		fetchGroups();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	if (error) {
		return (
			<ColumnComponent grid={4}>
				<CardComponent title={__('Critical Issues', 'vulopilot')}>
					<ModuleGuardComponent
						icon="error"
						title={__('Could not load findings', 'vulopilot')}
						desc={error}
						buttonText={__('Retry', 'vulopilot')}
						onButtonClick={fetchGroups}
					/>
				</CardComponent>
			</ColumnComponent>
		);
	}

	return (
		<ColumnComponent grid={4}>
			<CardComponent title={__('Critical Issues', 'vulopilot')} isLoading={isLoading}>
				{!isLoading && 0 === total ? (
					<ModuleGuardComponent
						icon="check"
						title={__('Nothing critical right now', 'vulopilot')}
						desc={__(
							'No open critical or high-priority schema/entity findings.',
							'vulopilot'
						)}
					/>
				) : (
					<>
						<div className="critical-issues-count">{total}</div>
						<div className="desc critical-issues-caption">
							{__('Need your attention', 'vulopilot')}
						</div>

						<ul className="kg-check-list critical-issues-list">
							{groups.map((group) => (
								<li key={group.scanner_id} className="critical-issue-row">
									<i className="adminfont-error critical-issue-icon" />
									<span>{group.label}</span>
								</li>
							))}
						</ul>

						<button
							type="button"
							className="schema-view-pages-link kg-fix-view-all"
							onClick={() => scrollToId('schema-knowledge-issues')}
						>
							{__('View all issues', 'vulopilot')}
							<i className="adminfont-arrow-right" />
						</button>
					</>
				)}
			</CardComponent>
		</ColumnComponent>
	);
};

export default CriticalIssuesCard;
