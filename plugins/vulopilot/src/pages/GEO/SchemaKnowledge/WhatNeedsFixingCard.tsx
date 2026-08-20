/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf, _n } from '@wordpress/i18n';
import { getApiLink, getApiResponse, scrollToId } from '@zyra/core';
import { BadgeComponent, CardComponent, ModuleGuardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import type { FindingGroup } from '../../AIAssistant/issuesTypes';

/** Same real 5 scanner ids IssuesSection.tsx's own SCHEMA_ISSUE_SCANNER_IDS already uses — one real fetch, reused here for the compact preview rather than a differently-scoped duplicate. */
const SCHEMA_ISSUE_SCANNER_IDS = [
	'schema',
	'structured-data',
	'sitewide-structured-data',
	'organization-schema',
	'author-schema',
];

const MAX_PREVIEW_ROWS = 3;

interface GroupsResponse {
	data: FindingGroup[];
	total: number;
}

/**
 * "What Needs Fixing" — a compact preview of the exact same real findings
 * IssuesSection.tsx's own full table further down this page shows (same
 * `GET /findings/groups?scanner_id=…` fetch, same 5 scanner ids), matching
 * the reference mockup's own top-3-plus-"View all" layout rather than
 * duplicating IssuesSection's own full table/detail-panel UI up here too.
 * "View all issues" scrolls down to that real table instead of this card
 * re-implementing pagination/filtering a second time.
 */
const WhatNeedsFixingCard = () => {
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
				`findings/groups?scanner_id=${SCHEMA_ISSUE_SCANNER_IDS.join(',')}&per_page=${MAX_PREVIEW_ROWS}`
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
			<CardComponent title={__('What Needs Fixing', 'vulopilot')}>
				<ModuleGuardComponent
					icon="error"
					title={__('Could not load findings', 'vulopilot')}
					desc={error}
					buttonText={__('Retry', 'vulopilot')}
					onButtonClick={fetchGroups}
				/>
			</CardComponent>
		);
	}

	return (
		<CardComponent
			title={__('What Needs Fixing', 'vulopilot')}
			titleIcon="error"
			desc={__(
				'These issues are preventing search engines and AI from understanding your business completely.',
				'vulopilot'
			)}
			badges={
				total > 0 ? [{ text: String(total), color: 'red' }] : undefined
			}
			isLoading={isLoading}
		>
			{!isLoading && 0 === groups.length ? (
				<ModuleGuardComponent
					icon="check"
					title={__('Nothing needs fixing right now', 'vulopilot')}
					desc={__(
						'No open schema or entity-related findings — run a scan to check again.',
						'vulopilot'
					)}
				/>
			) : (
				<>
					<ul className="kg-check-list">
						{groups.map((group) => (
							<li key={group.scanner_id} className="kg-check-row">
								<div className="kg-check-icon">
									<i
										className={`adminfont-${
											'critical' === group.severity ||
											'high' === group.severity
												? 'error'
												: 'alarm'
										}`}
									/>
								</div>
								<div className="kg-check-body">
									<div className="kg-check-title kg-fix-title">
										{group.label}
										<BadgeComponent
											color={
												'critical' === group.severity ||
												'high' === group.severity
													? 'red'
													: 'medium' === group.severity
														? 'yellow'
														: 'grey'
											}
											text={group.severity}
										/>
									</div>
									<div className="kg-check-desc">
										{group.sample?.description ||
											sprintf(
												/* translators: %d is a real count of affected pages/site-wide checks. */
												_n(
													'%d item affected.',
													'%d items affected.',
													group.count,
													'vulopilot'
												),
												group.count
											)}
									</div>
								</div>
								<ButtonInput
									buttons={{
										text: `${__('Review', 'vulopilot')} ›`,
										color: 'text-purple',
										onClick: () =>
											scrollToId('schema-knowledge-issues'),
									}}
								/>
							</li>
						))}
					</ul>

					{total > groups.length && (
						<button
							type="button"
							className="schema-view-pages-link kg-fix-view-all"
							onClick={() => scrollToId('schema-knowledge-issues')}
						>
							{__('View all issues', 'vulopilot')}
							<i className="adminfont-chevron-down" />
						</button>
					)}
				</>
			)}
		</CardComponent>
	);
};

export default WhatNeedsFixingCard;
