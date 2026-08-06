import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import './AICopilot.scss';
import { InformationItemComponent, ModuleGuardComponent, ListComponent } from '@zyra/components';
import { TableCard, TableRow } from '@zyra/table';
import { useApiList } from '../../services/useApiList';

interface FindingRow extends TableRow {
	id: number;
	title: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
	category?: string;
	description?: string;
	/**
	 * Resolved page path (e.g. '/pricing') or 'Site-wide' — added
	 * server-side by Controllers/Findings.php's add_page_field(), same
	 * field FindingsTable.tsx's own Finding type already models.
	 */
	page?: string;
}

/** Same category → tab mapping AISuggestionsWidget.tsx's own Dashboard
 * widget already uses — a finding's actual fix lives on its category's
 * page, not behind a one-click AI trigger (confirmed not to exist yet). */
const CATEGORY_TABS: Record<string, string> = {
	seo: 'seo',
	performance: 'performance',
	accessibility: 'accessibility',
	woocommerce: 'woocommerce',
	geo: 'geo',
	security: 'health',
	content: 'content',
	brand: 'brand-visibility',
};

const CATEGORY_ICONS: Record<string, string> = {
	seo: 'search-discovery',
	performance: 'bar-chart',
	accessibility: 'security',
	woocommerce: 'woocommerce',
	geo: 'geo-location',
	security: 'security',
	content: 'document',
	brand: 'star',
};

const CATEGORY_COLORS: Record<string, string> = {
	seo: '#2563eb',
	performance: '#7c3aed',
	accessibility: '#0d9488',
	woocommerce: '#f97316',
	geo: '#16a34a',
	security: '#dc2626',
	content: '#4f46e5',
	brand: '#db2777',
};

interface SuggestedActionsListProps {
	/** Row cap — omit for the full "Suggested Actions" tab. */
	limit?: number;
}

/**
 * Real open findings (`GET /findings`, same endpoint the Dashboard's
 * AISuggestionsWidget.tsx already uses), rendered as the mockup's icon
 * box + title + one-line description rows. Shared between ChatTab.tsx's
 * sidebar preview and SuggestedActionsTab.tsx's full list so both read
 * the same live data instead of two independent fetches drifting apart.
 */
const SuggestedActionsList: React.FC<SuggestedActionsListProps> = ({
	limit,
}) => {
	const { data, total, isLoading, error, refetch, onQueryUpdate } =
		useApiList<FindingRow>('findings', {
			status: 'open',
			per_page: limit ?? 20,
			orderby: 'id',
			order: 'desc',
		});

	if (error) {
		return (
			<ModuleGuardComponent
				icon="error"
				title={__('Could not load suggested actions', 'vulopilot')}
				desc={error}
				buttonText={__('Retry', 'vulopilot')}
				onButtonClick={refetch}
			/>
		);
	}

	// ChatTab.tsx's sidebar preview (limit passed, narrow column) keeps
	// today's compact icon+title+desc list — a full table would be
	// cramped there and wasn't part of this ask.
	if (limit) {
		if (isLoading) {
			return (
				<>
					{Array.from({ length: limit }).map((_, index) => (
						<InformationItemComponent key={index} title="" isLoading />
					))}
				</>
			);
		}

		if (data.length === 0) {
			return (
				<ModuleGuardComponent
					icon="check"
					title={__('Nothing to suggest right now', 'vulopilot')}
					desc={__(
						'AI suggestions appear here once a scan finds something worth fixing.',
						'vulopilot'
					)}
				/>
			);
		}

		return (
			<ListComponent
				className="mini-card report"
				items={data.map((finding) => {
					const goToFix = () => {
						const tab =
							CATEGORY_TABS[finding.category ?? ''] ?? 'health';

						window.location.href = `?page=vulopilot#&tab=${tab}`;
					};

					return {
						id: String(finding.id),
						title: finding.title,
						icon: CATEGORY_ICONS[finding.category ?? ''] ?? 'ai',
						desc:
							finding.description ||
							sprintf(
								/* translators: %s: finding severity (e.g. "high") */
								__('%s severity', 'vulopilot'),
								finding.severity
							),
						action: goToFix,
					};
				})}
			/>
		);
	}

	// The full "Suggested Actions" tab (SuggestedActionsTab.tsx, no limit
	// passed) — a real Page Name/Issue/Severity/Description table, same
	// TableCard call shape src/components/FindingsTable.tsx already uses
	// for this same `findings` data.
	const rows = data.map((finding) => ({
		...finding,
		page: finding.page || __('Site-wide', 'vulopilot'),
		description:
			finding.description ||
			sprintf(
				/* translators: %s: finding severity (e.g. "high") */
				__(
					'Flagged as a %s-severity issue during the last scan — open this item to review and fix it.',
					'vulopilot'
				),
				finding.severity
			),
	}));

	return (
		<TableCard
			headers={{
				page: { label: __('Page Name', 'vulopilot') },
				title: { label: __('Issue', 'vulopilot') },
				severity: {
					label: __('Severity', 'vulopilot'),
					type: 'badge',
					statusClass: (row: FindingRow) => `severity-${row.severity}`,
				},
				description: { label: __('Description', 'vulopilot') },
				actions: {
					type: 'action',
					actions: [
						{
							label: __('Review', 'vulopilot'),
							icon: 'arrow-right',
							onClick: (row?: Record<string, unknown>) => {
								const tab =
									CATEGORY_TABS[
										(row?.category as string) ?? ''
									] ?? 'health';

								window.location.href = `?page=vulopilot#&tab=${tab}`;
							},
						},
					],
				},
			}}
			rows={rows}
			ids={data.map((finding) => finding.id)}
			totalRows={total}
			isLoading={isLoading}
			onQueryUpdate={onQueryUpdate}
			showMenu={false}
			emptyMessage={__(
				'AI suggestions appear here once a scan finds something worth fixing.',
				'vulopilot'
			)}
		/>
	);
};

export default SuggestedActionsList;
