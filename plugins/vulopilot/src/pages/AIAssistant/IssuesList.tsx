/* global vulopilotAppLocalizer */
import React, { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, scrollToId } from '@zyra/core';
import { ButtonInput } from '@zyra/inputs';
import { EmptyState, Segmented, Skeleton } from '../../components/ui';
import IssueDetailPanel from '../../components/Issues/IssueDetailPanel';
import {
	CATEGORY_LABELS,
	CATEGORY_TABS,
	FindingGroup,
	findTabIdForCategory,
	formatAffected,
	groupKey,
	issueIconFor,
} from '../../components/Issues/issuesTypes';

const PER_PAGE = 8;

const SEVERITY: Record<string, string> = {
	critical: __('Critical', 'vulopilot'),
	high: __('High', 'vulopilot'),
	medium: __('Medium', 'vulopilot'),
	low: __('Low', 'vulopilot'),
	info: __('Info', 'vulopilot'),
};

/** First sentence of a finding's description, capped. */
const summarize = (text?: string | null): string => {
	const first = (text ?? '').split(/(?<=[.!?])\s/)[0].trim();

	return first.length > 110 ? `${first.slice(0, 107)}…` : first;
};

/** `issueIconFor()` returns "glyph colour"; rows use only the glyph, the severity carries the colour. */
const glyphFor = (group: FindingGroup): string => issueIconFor(group.category, group.scanner_id).split(' ')[0];

/** The details sit beside the list on wide screens and under it on narrow ones. */
const isStacked = (): boolean => window.matchMedia('(max-width: 1100px)').matches;

type Priority = 'all' | 'high' | 'medium' | 'low';

interface GroupsResponse {
	data: FindingGroup[];
	total: number;
	priority_counts: { high: number; medium: number; low: number };
	category_counts: Record<string, number>;
}

interface IssuesListProps {
	/** Presets the matching tab and auto-selects that group once loaded. */
	initialScannerId?: string;
	initialCategory?: string;
	/** Sends a question about the group to the chat above. */
	// eslint-disable-next-line no-unused-vars -- parameter name in a type signature.
	onAsk?: (group: FindingGroup) => void;
}

/**
 * AI Copilot's Issues section, in the dashboard's language: one card holding the area tabs, a priority switch and
 * the issue groups (worst first, as `GET /findings/groups` orders them), beside the chosen group's details.
 */
const IssuesList: React.FC<IssuesListProps> = ({
	initialScannerId,
	initialCategory,
	onAsk,
}) => {
	const [activeTabId, setActiveTabId] = useState(
		initialCategory ? findTabIdForCategory(initialCategory) : 'all'
	);
	const [activePriority, setActivePriority] = useState<Priority>('all');
	const [paged, setPaged] = useState(1);

	const [data, setData] = useState<FindingGroup[]>([]);
	const [total, setTotal] = useState(0);
	const [categoryCounts, setCategoryCounts] = useState<
		Record<string, number>
	>({});
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [reloadToken, setReloadToken] = useState(0);
	const [selectedGroup, setSelectedGroup] = useState<FindingGroup | null>(
		null
	);

	const activeTab = CATEGORY_TABS.find((tab) => tab.id === activeTabId);

	useEffect(() => {
		let cancelled = false;
		setIsLoading(true);
		setError(null);

		const params = new URLSearchParams();
		params.set('page', String(paged));
		params.set('per_page', String(PER_PAGE));

		if (activeTab) {
			params.set('category', activeTab.categories.join(','));
		}

		if ('all' !== activePriority) {
			params.set('priority', activePriority);
		}

		const baseUrl = getApiLink(vulopilotAppLocalizer, 'findings/groups');
		const separator = baseUrl.includes('?') ? '&' : '?';
		const url = `${baseUrl}${separator}${params.toString()}`;

		getApiResponse<GroupsResponse>(url, {
			headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce },
		})
			.then((response) => {
				if (cancelled) {
					return;
				}

				if (!response) {
					setError(
						__(
							'Something went wrong while loading issues.',
							'vulopilot'
						)
					);
					setData([]);
					setTotal(0);
					return;
				}

				setData(response.data ?? []);
				setTotal(response.total ?? 0);
				setCategoryCounts(response.category_counts ?? {});

				setSelectedGroup((current) => {
					if (
						current &&
						response.data.some(
							(group) => groupKey(group) === groupKey(current)
						)
					) {
						return (
							response.data.find(
								(group) => groupKey(group) === groupKey(current)
							) ?? current
						);
					}

					if (initialScannerId) {
						const match = response.data.find(
							(group) => group.scanner_id === initialScannerId
						);

						if (match) {
							return match;
						}
					}

					return response.data[0] ?? null;
				});
			})
			.finally(() => {
				if (!cancelled) {
					setIsLoading(false);
				}
			});

		return () => {
			cancelled = true;
		};
	}, [activeTabId, activePriority, paged, reloadToken]);

	const refetch = () => setReloadToken((n) => n + 1);

	const selectGroup = (group: FindingGroup) => {
		setSelectedGroup(group);

		if (isStacked()) {
			scrollToId('ai-copilot-issue-detail-panel');
		}
	};

	const changeTab = (tabId: string) => {
		setActiveTabId(tabId);
		setPaged(1);
	};

	const changePriority = (priority: Priority) => {
		setActivePriority(priority);
		setPaged(1);
	};

	const tabs = [
		{
			id: 'all',
			label: __('All', 'vulopilot'),
			count: Object.values(categoryCounts).reduce((sum, count) => sum + count, 0),
		},
		...CATEGORY_TABS.map((tab) => ({
			id: tab.id,
			label: tab.label,
			count: tab.categories.reduce((sum, category) => sum + (categoryCounts[category] ?? 0), 0),
		})),
	// An area with nothing open is left out, unless it is the one chosen.
	].filter((tab) => 'all' === tab.id || tab.count > 0 || tab.id === activeTabId);

	const isFiltered = 'all' !== activePriority || 'all' !== activeTabId;
	const pages = Math.max(1, Math.ceil(total / PER_PAGE));
	const first = total ? (paged - 1) * PER_PAGE + 1 : 0;
	const last = Math.min(total, paged * PER_PAGE);
	const showDetail = !error && (isLoading || data.length > 0);

	let body: React.ReactNode;

	if (error) {
		body = (
			<div className="vp-steps-body">
				<EmptyState
					icon="error"
					tone="red"
					title={__('Could not load issues', 'vulopilot')}
					text={error}
					action={<ButtonInput buttons={{ text: __('Try again', 'vulopilot'), icon: 'refresh', color: 'purple', onClick: refetch }} />}
				/>
			</div>
		);
	} else if (isLoading && 0 === data.length) {
		body = (
			<div className="vp-steps-body">
				<Skeleton />
				<Skeleton />
				<Skeleton />
				<Skeleton />
			</div>
		);
	} else if (0 === data.length) {
		body = (
			<div className="vp-steps-body">
				<EmptyState
					icon="check"
					tone="green"
					title={isFiltered ? __('Nothing matches this filter', 'vulopilot') : __("You're all caught up", 'vulopilot')}
					text={
						isFiltered
							? __('No open issues in this view. Other areas may still have some.', 'vulopilot')
							: __('Issues appear here once a scan finds something worth fixing.', 'vulopilot')
					}
					action={
						isFiltered && (
							<ButtonInput
								buttons={{
									text: __('Show all issues', 'vulopilot'),
									color: 'purple',
									onClick: () => {
										changeTab('all');
										changePriority('all');
									},
								}}
							/>
						)
					}
				/>
			</div>
		);
	} else {
		body = (
			<ul className={`vp-issue-list${isLoading ? ' is-loading' : ''}`}>
				{data.map((group) => {
					const key = groupKey(group);
					const isActive = selectedGroup ? key === groupKey(selectedGroup) : false;
					const detail = summarize(group.sample?.description);

					return (
						<li key={key}>
							<button
								type="button"
								className={`vp-issue-row is-${group.severity}${isActive ? ' is-active' : ''}`}
								aria-pressed={isActive}
								onClick={() => selectGroup(group)}
							>
								<span className="vp-issue-mark" aria-hidden="true">
									<i className={`adminfont-${glyphFor(group)}`} />
								</span>
								<span className="vp-issue-main">
									<span className="vp-issue-meta">
										<em>{SEVERITY[group.severity] ?? SEVERITY.info}</em>
										<span aria-hidden="true">·</span>
										{CATEGORY_LABELS[group.category] ?? group.category}
										{group.fix_action_id && (
											<span className="vp-issue-ai">
												<i className="adminfont-ai" aria-hidden="true" />
												{__('AI fix', 'vulopilot')}
											</span>
										)}
									</span>
									<strong>{group.label}</strong>
									{detail && <span className="vp-issue-desc">{detail}</span>}
								</span>
								<span className="vp-issue-count">{formatAffected(group.count, group.object_type)}</span>
								<i className="adminfont-arrow-right vp-issue-go" aria-hidden="true" />
							</button>
						</li>
					);
				})}
			</ul>
		);
	}

	return (
		<section className="vp-issues" id="ai-copilot-issues-section" aria-label={__('Issues', 'vulopilot')}>
			<div className="vp-section-head">
				<div>
					<h2>{__('Issues', 'vulopilot')}</h2>
					<p>{__('Findings from your latest scans, grouped by check. Pick one to see what to do.', 'vulopilot')}</p>
				</div>
			</div>

			<div className={`vp-issues-layout${showDetail ? '' : ' is-single'}`}>
				<section className="vp-card vp-issue-browser">
					<header className="vp-issue-toolbar">
						<div className="vp-tabs" role="group" aria-label={__('Area', 'vulopilot')}>
							{tabs.map((tab) => (
								<button
									key={tab.id}
									type="button"
									className={tab.id === activeTabId ? 'is-active' : ''}
									aria-pressed={tab.id === activeTabId}
									onClick={() => changeTab(tab.id)}
								>
									{tab.label}
									<b>{tab.count}</b>
								</button>
							))}
						</div>
						<Segmented
							label={__('Priority', 'vulopilot')}
							size="sm"
							value={activePriority}
							onChange={(next) => changePriority(next as Priority)}
							options={[
								// No counts: the server counts findings, while the rows (and the tabs' counts) are groups.
								{ value: 'all', label: __('Any priority', 'vulopilot') },
								{ value: 'high', label: __('High', 'vulopilot') },
								{ value: 'medium', label: __('Medium', 'vulopilot') },
								{ value: 'low', label: __('Low', 'vulopilot') },
							]}
						/>
					</header>

					{body}

					{total > PER_PAGE && !error && (
						<footer className="vp-steps-foot vp-pager">
							<span>
								{sprintf(
									/* translators: 1: first row shown, 2: last row shown, 3: number of issues. */
									__('%1$d–%2$d of %3$d issues', 'vulopilot'),
									first,
									last,
									total
								)}
							</span>
							<span className="vp-pager-nav">
								<button
									type="button"
									disabled={paged <= 1 || isLoading}
									onClick={() => setPaged((page) => page - 1)}
									aria-label={__('Previous page', 'vulopilot')}
								>
									<i className="adminfont-arrow-left" aria-hidden="true" />
								</button>
								<span>
									{sprintf(
										/* translators: 1: current page, 2: number of pages. */
										__('Page %1$d of %2$d', 'vulopilot'),
										paged,
										pages
									)}
								</span>
								<button
									type="button"
									disabled={paged >= pages || isLoading}
									onClick={() => setPaged((page) => page + 1)}
									aria-label={__('Next page', 'vulopilot')}
								>
									<i className="adminfont-arrow-right" aria-hidden="true" />
								</button>
							</span>
						</footer>
					)}
				</section>

				{showDetail && (
					<aside id="ai-copilot-issue-detail-panel" className="vp-issues-detail">
						<IssueDetailPanel group={selectedGroup} onActionComplete={refetch} onAsk={onAsk} />
					</aside>
				)}
			</div>
		</section>
	);
};

export default IssuesList;
