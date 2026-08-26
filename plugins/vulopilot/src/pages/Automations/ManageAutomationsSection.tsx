/* global appLocalizer */
import { useEffect } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { CardComponent, ModuleGuardComponent, BadgeComponent } from '@zyra/components';
import { MultiCheckboxInput } from '@zyra/inputs';
import { TableCard, TableRow } from '@zyra/table';
import { useApiList } from '../../services/useApiList';
import { formatWpDate } from '../../services/formatWpDate';
import { CATEGORY_LABELS, TRIGGER_TYPE_LABELS, describeAutomationActions } from './automationsLabels';

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

const renderNameCell = (row: AutomationRow) => (
	<div className="automations-name-cell">
		<span className="automations-name-icon">
			<i className="adminfont-automation" />
		</span>
		<span className="automations-name-text">
			<strong>{row.name}</strong>
			<BadgeComponent
				color={`category-${row.category}`}
				text={CATEGORY_LABELS[row.category] ?? row.category}
			/>
		</span>
	</div>
);

const renderWhatItDoesCell = (row: AutomationRow) => (
	<span className="automations-what-it-does">
		{describeAutomationActions(row.actions)}
	</span>
);

const renderRunsCell = (row: AutomationRow) => (
	<span>{TRIGGER_TYPE_LABELS[row.trigger_type] ?? row.trigger_type}</span>
);

const renderLastRunCell = (row: AutomationRow) => {
	const date = row.last_run_finished_at ?? row.last_triggered_at;

	let outcome: { text: string; tone: 'is-good' | 'is-attention' | 'is-neutral' };

	if ('draft' === row.status) {
		outcome = { text: __('Not activated yet', 'vulopilot'), tone: 'is-neutral' };
	} else if (!row.last_run_status) {
		outcome = { text: __('Never run', 'vulopilot'), tone: 'is-neutral' };
	} else if ('failed' === row.last_run_status) {
		outcome = { text: __('Run failed', 'vulopilot'), tone: 'is-attention' };
	} else if ((row.last_run_changes_made ?? 0) > 0) {
		outcome = {
			text:
				1 === row.last_run_changes_made
					? __('1 change made', 'vulopilot')
					: `${row.last_run_changes_made} ${__('changes made', 'vulopilot')}`,
			tone: 'is-good',
		};
	} else {
		outcome = { text: __('No changes needed', 'vulopilot'), tone: 'is-neutral' };
	}

	return (
		<div className="automations-last-run">
			<span className="automations-last-run-date">
				{date ? formatWpDate(date) : __('—', 'vulopilot')}
			</span>
			<span className={`automations-last-run-outcome ${outcome.tone}`}>
				{outcome.text}
			</span>
		</div>
	);
};

interface StatusToggleProps {
	row: AutomationRow;
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onToggle: (row: AutomationRow) => void;
	// eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters.
	onRunNow: (row: AutomationRow) => void;
	runDisabled?: boolean;
}

const StatusToggleCell = ({ row, onToggle, onRunNow, runDisabled }: StatusToggleProps) => (
	<div className="automations-status-actions">
		<MultiCheckboxInput
			look="toggle"
			options={[{ value: 'enabled', label: '' }]}
			value={'enabled' === row.status ? ['enabled'] : []}
			onChange={() => onToggle(row)}
			modules={[]}
		/>
		<button
			type="button"
			className="automations-run-now"
			title={__('Run now', 'vulopilot')}
			disabled={runDisabled}
			onClick={() => onRunNow(row)}
		>
			<i className="adminfont-next" />
		</button>
	</div>
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
 * "Open" (see `renderOpenCell`) hands off to the real wizard's read-only
 * view when one exists.
 */
const ManageAutomationsSection = ({
	hasWizard,
	onOpenRow,
	onRequireProUpsell,
	refetchSignal,
}: ManageAutomationsSectionProps) => {
	const { data, total, categoryCounts, isLoading, error, refetch, onQueryUpdate } =
		useApiList<AutomationRow>('automations', {}, { key: 'status', options: STATUS_OPTIONS });

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
		<div id="automation-manage">
			<CardComponent title={__('Your automations', 'vulopilot')} titleIcon="automation">
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
						search={{ placeholder: __('Search automations…', 'vulopilot') }}
						format={appLocalizer.date_format_js}
						headers={{
							name: {
								label: __('Automation', 'vulopilot'),
								isSortable: true,
								render: renderNameCell,
							},
							what_it_does: {
								label: __('What it does', 'vulopilot'),
								render: renderWhatItDoesCell,
							},
							trigger_type: {
								label: __('Runs', 'vulopilot'),
								render: renderRunsCell,
							},
							last_run: {
								label: __('Last run', 'vulopilot'),
								render: renderLastRunCell,
							},
							status: {
								label: __('Status', 'vulopilot'),
								render: (row: AutomationRow) => (
									<StatusToggleCell row={row} onToggle={handleToggle} onRunNow={handleRunNow} />
								),
							},
							open: {
								label: '',
								type: 'action',
								actions: [
									{
										label: __('Open', 'vulopilot'),
										icon: 'external',
										onClick: (row?: Record<string, unknown>) =>
											row && handleOpen(row as AutomationRow),
									},
								],
							},
						}}
						rows={data}
						ids={data.map((row) => row.id)}
						totalRows={total}
						categoryCounts={categoryCounts}
						isLoading={isLoading}
						onQueryUpdate={onQueryUpdate}
						emptyMessage={__(
							'No automations yet — create one to react to scan findings automatically.',
							'vulopilot'
						)}
					/>
				)}
			</CardComponent>
		</div>
	);
};

export default ManageAutomationsSection;
