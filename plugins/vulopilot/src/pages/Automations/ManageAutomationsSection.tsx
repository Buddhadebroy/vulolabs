/* global appLocalizer */
import { useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { CardComponent, ModuleGuardComponent } from '@zyra/components';
import { MultiCheckboxInput } from '@zyra/inputs';
import { TableCard, TableRow } from '@zyra/table';
import { useApiList } from '../../services/useApiList';
import { CATEGORY_LABELS, TRIGGER_TYPE_LABELS, describeAutomationActions } from './automationsLabels';

/** Automations\BuiltinAutomationSeeder's own two TRIGGER_* constants — BuiltinAutomationCards.tsx (this page's own top section) is their one real home; excluded here so they never show up twice on the same page. */
const BUILTIN_TRIGGER_TYPES = ['free_full_site_scan', 'free_visibility_report'];

export interface AutomationRow extends TableRow {
	id: number;
	name: string;
	category: string;
	trigger_type: string;
	actions: string;
	conditions?: string | null;
	status: 'enabled' | 'disabled' | 'draft';
	last_triggered_at: string | null;
	last_run_status: 'running' | 'completed' | 'failed' | null;
	last_run_actions_executed: number | null;
	last_run_actions_failed: number | null;
	last_run_changes_made: number | null;
	/** Real for the 4 cron-based trigger types only (see `AutomationsRest::with_next_run()`'s own docblock) — null for event/manual/webhook triggers, which have no "next scheduled" concept at all. */
	next_run_at: string | null;
	last_run_finished_at: string | null;
}

/**
 * Active/Drafts/Paused (spec section 9) — maps directly onto the real
 * `status` column's 3 real values (`AutomationsRepository::get_status_counts()`).
 */
const STATUS_OPTIONS = [
	{ label: __('Active', 'vulopilot'), value: 'enabled' },
	{ label: __('Drafts', 'vulopilot'), value: 'draft' },
	{ label: __('Paused', 'vulopilot'), value: 'disabled' },
];

/**
 * `name`/`what_it_does`/`trigger_type`/`category` — 4 of the former
 * 6 columns — collapsed into the "info"-type first column's own
 * `iconKey`/`descriptionKey`/`badgesKey` fields (`type: 'info'` reads
 * these straight off each row, see TableUtils.tsx's own `case 'info'`),
 * same `hideHeader` + merged-first-column shape `useFindingsTable.tsx`'s
 * own `defaultHeaders` already establishes for the Issues table, applied
 * here per direct instruction. Real data only: no field here is invented,
 * just regrouped onto the row TableCard actually reads.
 */
const withInfoColumnFields = (row: AutomationRow) => ({
	...row,
	defaultTitleIcon: 'automation',
	defaultTitleBadges: [
		{
			text: CATEGORY_LABELS[row.category] ?? row.category,
			color: `category-${row.category}`,
		},
	],
	descriptionText: `${describeAutomationActions(row.actions)} • ${TRIGGER_TYPE_LABELS[row.trigger_type] ?? row.trigger_type}`,
});

interface StatusToggleProps {
	row: AutomationRow;
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onToggle: (row: AutomationRow) => void;
}

/**
 * Just the enable/disable toggle now — Run now/Open moved out to their own
 * `type: 'action'` header (see `headers.actions` below) instead of being
 * rendered inline here via `TableRowActions`, per direct instruction.
 */
const StatusToggleCell = ({ row, onToggle }: StatusToggleProps) => (
	<MultiCheckboxInput
		look="toggle"
		options={[{ value: 'enabled', label: '' }]}
		value={'enabled' === row.status ? ['enabled'] : []}
		onChange={() => onToggle(row)}
		modules={[]}
	/>
);

interface ManageAutomationsSectionProps {
	/** Whether the real wizard resolved (`vulopilot_automations_panel`'s own `Wizard` — Pro active and the Automations module on) — gates whether row actions call the real endpoints directly or fall back to the upsell popup. */
	hasWizard: boolean;
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onOpenRow: (row: AutomationRow) => void;
	onRequireProUpsell: () => void;
	/** Bumped by the host (`Automations.tsx`) after the wizard actually saves/changes something — this table has no fetch state of its own to update otherwise, since it isn't the one that owns the popup that just wrote to it. */
	refetchSignal: number;
}

/**
 * The real, single automations list — "the automation list itself is the
 * management experience" (spec section 9). Used for both Pro-active and
 * Pro-inactive states now: `AutomationWizard.tsx`/its now-deleted
 * predecessor `AutomationPanel.tsx` used to render an entire second,
 * near-identical table of its own whenever Pro was active, so this table
 * only ever rendered while Pro was inactive — see this file's own git
 * history / the redesign plan this was built against for that duplication.
 * Toggle/Run now now call the real endpoints directly from here either way
 * (previously only ever real inside Pro's own now-removed internal table);
 * "Open" (its own `type: 'action'` header, alongside Run now — see
 * `headers.actions` below) hands off to the real wizard's read-only view
 * when one exists.
 */
const ManageAutomationsSection = ({
	hasWizard,
	onOpenRow,
	onRequireProUpsell,
	refetchSignal,
}: ManageAutomationsSectionProps) => {
	const { data, total, categoryCounts, isLoading, error, refetch, onQueryUpdate } =
		useApiList<AutomationRow>('automations', {}, { key: 'status', options: STATUS_OPTIONS });

	const visibleData = data.filter((row) => !BUILTIN_TRIGGER_TYPES.includes(row.trigger_type));

	useEffect(() => {
		if (refetchSignal > 0) {
			refetch();
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately keyed only on refetchSignal, the increment-to-refetch token from the host; refetch() itself is stable per useApiList's own useCallback.
	}, [refetchSignal]);

	const handleToggle = (row: AutomationRow) => {
		if (!hasWizard) {
			onRequireProUpsell();
			return;
		}

		const nextStatus = 'enabled' === row.status ? 'disabled' : 'enabled';

		sendApiResponse(appLocalizer, getApiLink(appLocalizer, `automations/${row.id}`), {
			status: nextStatus,
		}).then((response) => {
			if (response) {
				refetch();
			}
		});
	};

	const handleRunNow = (row: AutomationRow) => {
		if (!hasWizard) {
			onRequireProUpsell();
			return;
		}

		sendApiResponse(appLocalizer, getApiLink(appLocalizer, `automations/${row.id}/run`), {}).then(
			(response) => {
				if (response) {
					refetch();
				}
			}
		);
	};

	const handleOpen = (row: AutomationRow) => {
		if (!hasWizard) {
			onRequireProUpsell();
			return;
		}

		onOpenRow(row);
	};

	return (
			<CardComponent
				title={__('Your automations', 'vulopilot')}
				titleIcon="automation"
				id="automation-manage"
				desc={__('React to scan findings automatically — enable, pause, or run an automation, and see when it last ran.', 'vulopilot')}
			>
				{error ? (
					<ModuleGuardComponent
						icon="error"
						title={__('Could not load automations', 'vulopilot')}
						desc={error}
						buttonText={__('Retry', 'vulopilot')}
						onButtonClick={refetch}
					/>
				) : (
					<TableCard
						hideHeader={true}
						className="transparent-table"
						search={{ placeholder: __('Search automations…', 'vulopilot') }}
						format={appLocalizer.date_format_js}
						headers={{
							name: {
								key: 'name',
								type: 'info',
								label: __('Automation', 'vulopilot'),
								isSortable: true,
								width: '65%',
								iconKey: 'defaultTitleIcon',
								descriptionKey: 'descriptionText',
								badgesKey: 'defaultTitleBadges',
							},
							status: {
								label: __('Status', 'vulopilot'),
								render: (row: AutomationRow) => (
									<StatusToggleCell row={row} onToggle={handleToggle} />
								),
							},
							actions: {
								label: '',
								type: 'action',
								actions: [
									{
										label: __('Run now', 'vulopilot'),
										icon: 'refresh blue',
										onClick: (row?: Record<string, unknown>) =>
											row && handleRunNow(row as unknown as AutomationRow),
									},
									{
										label: __('Open', 'vulopilot'),
										icon: 'external yellow',
										onClick: (row?: Record<string, unknown>) =>
											row && handleOpen(row as unknown as AutomationRow),
									},
								],
							},
						}}
						rows={visibleData.map(withInfoColumnFields)}
						ids={visibleData.map((row) => row.id)}
						totalRows={Math.max(0, total - 2)}
						// categoryCounts={categoryCounts}
						showMenu={false}
						isLoading={isLoading}
						onQueryUpdate={onQueryUpdate}
						emptyMessage={__(
							'No automations yet — create one to react to scan findings automatically.',
							'vulopilot'
						)}
					/>
				)}
			</CardComponent>
	);
};

export default ManageAutomationsSection;
