/* global appLocalizer */
import React, { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import {
	ListComponent,
	ModuleGuardComponent,
	NoticeManager,
	TabsComponent,
} from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { useApiList } from '../services/useApiList';
import { formatWpDate } from '../services/formatWpDate';
import { getSeverityClass } from '../services/getSeverityClass';
import { WidgetProps } from './types';

interface FindingRow {
	id: number;
	title: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
	category?: string;
}

interface ActionRunRow {
	id: number;
	action_id: string;
	created_at: string;
}

/** Security has no dedicated page of its own (see HealthPillarsWidget's
 * same note) — its findings only ever show up in Health's unfiltered
 * list, so that's where a security finding's row navigates. */
const CATEGORY_TABS: Record<string, string> = {
	seo: 'seo',
	performance: 'performance',
	accessibility: 'accessibility',
	woocommerce: 'woocommerce',
	geo: 'geo',
	security: 'health',
};

/**
 * "Needs your attention" — the three real, honest data sources that used
 * to be three separate cards (Quick fixes, Recent open issues, Pending
 * approval), combined into one tabbed widget instead. Mirrors the
 * Dashboard mockup's own tabbed "Needs your attention" panel rather than
 * three near-duplicate list cards competing for space in the grid.
 */
const NeedsAttentionWidget: React.FC<WidgetProps> = ({
	onHide,
	isCustomizing,
}) => {
	const quickFixes = useApiList<FindingRow>('findings', {
		category: 'images',
		status: 'open',
		per_page: 5,
	});
	const openIssues = useApiList<FindingRow>('findings', {
		status: 'open',
		per_page: 5,
		orderby: 'id',
		order: 'desc',
	});
	const pendingApproval = useApiList<ActionRunRow>('ai-action-runs', {
		status: 'pending_approval',
		per_page: 5,
	});
	const [busyId, setBusyId] = useState<number | null>(null);

	const handleDecision = (
		row: ActionRunRow,
		decision: 'approve' | 'reject'
	) => {
		if (busyId === row.id) {
			return;
		}

		setBusyId(row.id);

		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, `ai-action-runs/${row.id}/${decision}`),
			{}
		)
			.then((response) => {
				NoticeManager.add({
					uniqueKey: `ai-action-${decision}-${row.id}`,
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? decision === 'approve'
							? __('Action approved and executed.', 'vulopilot')
							: __('Action rejected.', 'vulopilot')
						: __(
								'Could not complete this action. Please try again.',
								'vulopilot'
							),
				});

				if (response) {
					pendingApproval.refetch();
				}
			})
			.finally(() => setBusyId(null));
	};

	const isLoading =
		quickFixes.isLoading || openIssues.isLoading || pendingApproval.isLoading;

	return (
		<DashboardWidget
			title={__('Needs your attention', 'vulopilot')}
			icon="error"
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
		>
			<TabsComponent
				className="dashboard-attention-tabs"
				tabs={[
					{
						label: __('Quick fixes', 'vulopilot'),
						content:
							quickFixes.data.length === 0 ? (
								<ModuleGuardComponent
									icon="check"
									title={__(
										'Nothing to fix right now',
										'vulopilot'
									)}
									desc={__(
										'Quick fixes appear here once a scan finds an image issue AI can resolve.',
										'vulopilot'
									)}
								/>
							) : (
								<ListComponent
									className="mini-card report"
									items={quickFixes.data.map((finding) => ({
										id: String(finding.id),
										title: finding.title,
										action: () => {
											window.location.href =
												'?page=vulopilot#&tab=geo&subtab=seo';
										},
										tags: (
											<span
												className={`admin-badge badge-${finding.severity}`}
											>
												{finding.severity}
											</span>
										),
									}))}
								/>
							),
					},
					{
						label: __('Open issues', 'vulopilot'),
						content:
							openIssues.data.length === 0 ? (
								<ModuleGuardComponent
									icon="check"
									title={__('No open issues', 'vulopilot')}
									desc={__(
										'Every scanned finding is resolved right now.',
										'vulopilot'
									)}
								/>
							) : (
								<ListComponent
									className= "mini-card report"
									items={openIssues.data.map((finding) => ({
										id: String(finding.id),
										title: finding.title,
										action: () => {
											const tab =
												CATEGORY_TABS[
													finding.category ?? ''
												] ?? 'health';
											window.location.href = `?page=vulopilot#&tab=${tab}`;
										},
										tags: (
											<span
												className={`admin-badge badge-${finding.severity}`}
											>
												{finding.severity}
											</span>
										),
									}))}
								/>
							),
					},
					{
						label: __('Pending approval', 'vulopilot'),
						content:
							pendingApproval.data.length === 0 ? (
								<ModuleGuardComponent
									icon="check"
									title={__(
										'Nothing waiting on you',
										'vulopilot'
									)}
									desc={__(
										'AI actions that need your approval before they run will appear here.',
										'vulopilot'
									)}
								/>
							) : (
								<ListComponent
									className="notification"
									items={pendingApproval.data.map((row) => ({
										id: String(row.id),
										title: row.action_id,
										value: formatWpDate(row.created_at),
										onApprove: () =>
											handleDecision(row, 'approve'),
										onReject: () =>
											handleDecision(row, 'reject'),
									}))}
								/>
							),
					},
				]}
			/>
		</DashboardWidget>
	);
};

export default NeedsAttentionWidget;
