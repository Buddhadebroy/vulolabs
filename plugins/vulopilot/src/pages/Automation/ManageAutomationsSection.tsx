/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import {
	CardComponent,
	ModuleGuardComponent,
	PopupComponent,
	BadgeComponent,
} from '@zyra/components';
import { ButtonInput, MultiCheckboxInput } from '@zyra/inputs';
import { TableCard, TableRow } from '@zyra/table';
import { useApiList } from '../../services/useApiList';
import { useFilterSlot } from '../../services/useFilterSlot';
import { formatWpDate } from '../../services/formatWpDate';
import ShowProPopup from '../../components/Popup/Popup';
import AutomationStatsRow from './AutomationStatsRow';
import {
	CATEGORY_LABELS,
	TRIGGER_TYPE_LABELS,
	describeAutomationActions,
} from './automationLabels';

interface AutomationRow extends TableRow {
	id: number;
	name: string;
	category: string;
	trigger_type: string;
	actions: string;
	status: 'enabled' | 'disabled';
	last_triggered_at: string | null;
	last_run_status: 'running' | 'completed' | 'failed' | null;
	last_run_actions_executed: number | null;
	last_run_actions_failed: number | null;
	last_run_changes_made: number | null;
	last_run_finished_at: string | null;
}

/**
 * The "AUTOMATION" column — real icon (fixed per this codebase's own
 * `adminfont-automation` glyph, same one Automation.tsx's own header uses;
 * no per-category icon set exists to honestly pick from instead) + real
 * name + a real category badge (`row.category`, CATEGORY_LABELS —
 * Install.php's own add_automations_category_column() docblock explains
 * why this is a real column, not a fabricated grouping).
 */
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

/**
 * The "LAST RUN" column — real date (`last_run_finished_at`, falling back
 * to the real `last_triggered_at` a run always stamps even before this
 * pass's own `last_run_*` enrichment existed) plus a real colored outcome:
 * never run yet (neutral), failed (red), completed with real changes made
 * (green, real count), or completed with nothing to change (neutral) —
 * never the mockup's own invented "3 opportunities found" copy, always
 * this automation's own real last AutomationRunRepository row
 * (Controllers\Automations::with_last_run()).
 */
const renderLastRunCell = (row: AutomationRow) => {
	const date = row.last_run_finished_at ?? row.last_triggered_at;

	let outcome: { text: string; tone: 'is-good' | 'is-attention' | 'is-neutral' };

	if (!row.last_run_status) {
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
	onToggle: (row: AutomationRow) => void;
	onRunNow: (row: AutomationRow) => void;
	runDisabled?: boolean;
}

/**
 * A real toggle switch (not the mockup's own untouched screenshot chrome —
 * zyra's `MultiCheckboxInput` with `look="toggle"`, a single-option list
 * standing in for one row's own boolean status rather than a raw
 * `<input type="checkbox">`) plus a compact "Run now" icon button alongside
 * it — this tab's only other real per-row action, kept rather than dropped
 * just because the mockup's own cropped screenshot doesn't show a second
 * control here.
 */
const StatusToggleCell = ({
	row,
	onToggle,
	onRunNow,
	runDisabled,
}: StatusToggleProps) => (
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

/**
 * The real automation list/create/enable/run management UI — today's
 * whole "Automations" tab (Automation.tsx). Every other card's
 * "Manage"/"Create"/"View all" action switches to this tab
 * (`onManageAutomations`) rather than scrolling to it, since it's a full
 * tab of its own now, not a section further down a single long page.
 *
 * Redesigned to match the mockup: a real 4-tile stat row
 * (AutomationStatsRow.tsx) above an "All automations" table whose columns
 * (Automation/What it does/Runs/Last run/Status) are all real data — see
 * each `render*Cell()` helper above for its own honest-substitution notes.
 *
 * The real panel (list, enable/disable, create, run) lives in
 * vulopilot-pro/modules/Automation's own React entry
 * (modules/Automation/src/index.tsx), registered into the
 * `vulopilot_automation_panel` slot — same "register a source, don't
 * modify the host" pattern already used for Reports'
 * `vulopilot_reports_advanced_panel`. Read via `useFilterSlot()`, not a
 * one-time module-scope `applyFilters()` call: Pro's own `addFilter()`
 * call always runs strictly after this component's first render on a
 * fresh page load (FrontendScriptsPro.php's own docblock — Pro's script
 * depends on Free's, but "depends on" only orders the <script> tags, not
 * when each one finishes executing), so a one-time read here permanently
 * missed it — "Create automation" opened the "Unlock with Pro" popup and
 * did nothing even with the real 'automation' module genuinely active,
 * same bug already fixed this session for WooCommerceTab.tsx's two panel
 * slots. AutomationPanel.tsx (Pro) duplicates this same table styling —
 * it can't import this file's src/ tree, only the shared zyra package.
 */
const ManageAutomationsSection = () => {
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);
	const AutomationPanel = useFilterSlot('vulopilot_automation_panel');

	const statusOptions = [
		{ label: __('Enabled', 'vulopilot'), value: 'enabled' },
		{ label: __('Disabled', 'vulopilot'), value: 'disabled' },
	];

	const {
		data,
		total,
		categoryCounts,
		isLoading,
		error,
		refetch,
		onQueryUpdate,
	} = useApiList<AutomationRow>(
		'automations',
		{},
		{ key: 'status', options: statusOptions }
	);

	const openProPopup = () => setIsProPopupOpen(true);

	return (
		<div id="automation-manage">
			<AutomationStatsRow />
			<CardComponent
				title={__('All automations', 'vulopilot')}
				titleIcon="automation"
				action={
					AutomationPanel ? undefined : (
						<ButtonInput
							buttons={{
								text: __('Create automation', 'vulopilot'),
								icon: 'plus',
								onClick: openProPopup,
							}}
						/>
					)
				}
			>
				{error ? (
					<ModuleGuardComponent
						icon="error"
						title={__('Could not load automations', 'vulopilot')}
						desc={error}
						buttonText={__('Retry', 'vulopilot')}
						onButtonClick={refetch}
					/>
				) : AutomationPanel ? (
					<AutomationPanel />
				) : (
					<>
						{/*
						 * Pro isn't active (or the Automation module isn't) — the
						 * table still renders with whatever Free's own baseline
						 * `automations` REST controller returns (list/enable-disable
						 * only, no create), but every action opens the Pro popup
						 * instead of calling the API, since creating/running an
						 * automation for real needs vulopilot-pro's engine.
						 */}
						<TableCard
							search={{
								placeholder: __(
									'Search automations…',
									'vulopilot'
								),
							}}
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
										<StatusToggleCell
											row={row}
											onToggle={openProPopup}
											onRunNow={openProPopup}
										/>
									),
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
						<PopupComponent
							open={isProPopupOpen}
							onClose={() => setIsProPopupOpen(false)}
							width={31.25}
							height="auto"
							position="lightbox"
						>
							{appLocalizer.khali_dabba ? (
								// Pro is active — this specific module just
								// isn't toggled on yet, so point at Modules
								// rather than pitching an upgrade the user
								// already has. Real backend id is 'automation'
								// (Automation's folder name kebab-cased, no
								// 'Engine' suffix) — this previously pointed
								// at 'automation-engine', an id no real module
								// resolves to, same broken-toggle-deep-link
								// bug fixed for the other <ShowProPopup>
								// call sites this session.
								<ShowProPopup moduleName="automation" />
							) : (
								<ShowProPopup />
							)}
						</PopupComponent>
					</>
				)}
			</CardComponent>
		</div>
	);
};

export default ManageAutomationsSection;
