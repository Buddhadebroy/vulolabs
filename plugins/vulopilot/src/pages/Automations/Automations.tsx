/* global vulopilotAppLocalizer */
import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { ColumnComponent, ContainerComponent, NavigatorHeaderComponent, PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import ShowProPopup from '../../components/Popup/Popup';
import { Kpi, KpiGrid, SectionHead, Skeleton } from '../../components/ui';
import { formatWpTime, isWpToday, formatWpDate } from '../../services/formatWpDate';
import { DOCS_URL } from '../../services/links';
import BuiltinAutomationCard from './BuiltinAutomationCard';
import { AiAgentsSample, CustomAutomationsSample } from './AutomationsProSamples';
import { REPORT_TRIGGER, SCAN_TRIGGER } from './automationsTypes';
import type { AutomationRow } from './automationsTypes';
import './Automations.scss';

const nonce = () => ({ headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } });

/** "Today 09:00" or "Nov 21". */
const shortWhen = (iso: string): string => (isWpToday(iso) ? `${__('Today', 'vulopilot')} ${formatWpTime(iso)}` : formatWpDate(iso));

const CUSTOM_AUTOMATIONS = {
	title: __('Custom automations', 'vulopilot'),
	description: __('Build your own: pick what starts it, then what it does - alerts, reports or AI fixes.', 'vulopilot'),
	icon: 'automation',
};

/**
 * Automations, free: the two built-in automations (a scheduled scan and a scheduled visibility report), how they are
 * doing, and samples of what VuloPilot Pro's Workflow Automation adds. With Pro, its own Automations page replaces
 * this one (Pro registers the `automations` route after free does).
 */
const Automations = () => {
	const [rows, setRows] = useState<AutomationRow[]>([]);
	const [failedRuns, setFailedRuns] = useState(0);
	const [isLoading, setIsLoading] = useState(true);
	const [refetchSignal, setRefetchSignal] = useState(0);
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);

	useEffect(() => {
		let cancelled = false;

		Promise.all([
			getApiResponse<{ data?: AutomationRow[] } | AutomationRow[]>(`${getApiLink(vulopilotAppLocalizer, 'automations')}?per_page=100`, nonce()),
			getApiResponse<{ failed?: number }>(`${getApiLink(vulopilotAppLocalizer, 'automation-dashboard-stats')}?period=month`, nonce()),
		])
			.then(([list, stats]) => {
				if (cancelled) {
					return;
				}

				setRows(Array.isArray(list) ? list : (list?.data ?? []));
				setFailedRuns(stats?.failed ?? 0);
			})
			.finally(() => !cancelled && setIsLoading(false));

		return () => {
			cancelled = true;
		};
	}, [refetchSignal]);

	const refetch = () => setRefetchSignal((n) => n + 1);

	const scan = rows.find((row) => SCAN_TRIGGER === row.trigger_type);
	const report = rows.find((row) => REPORT_TRIGGER === row.trigger_type);
	const builtins = [scan, report].filter((row): row is AutomationRow => Boolean(row));
	const on = builtins.filter((row) => 'enabled' === row.status);
	const nameOf = (row: AutomationRow) =>
		SCAN_TRIGGER === row.trigger_type ? __('Website scan', 'vulopilot') : __('Visibility report', 'vulopilot');
	// The most recent finished run of either built-in.
	const latest = [...builtins]
		.filter((row) => row.last_run_finished_at)
		.sort((a, b) => String(b.last_run_finished_at).localeCompare(String(a.last_run_finished_at)))[0];

	// What needs the user: a built-in that is on and failed its last run.
	const attention = on
		.filter((row) => 'failed' === row.last_run_status)
		.map((row) =>
			sprintf(
				/* translators: %s: automation name. */
				__('%s failed its last run. Run it again from its card below.', 'vulopilot'),
				nameOf(row)
			)
		);

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="automation"
				headerTitle={__('Automations', 'vulopilot')}
				headerDescription={__('Work VuloPilot does for you on a schedule, so you do not have to remember it.', 'vulopilot')}
				headerCustomContent={
					<ButtonInput
						buttons={{
							text: __('Create automation', 'vulopilot'),
							icon: 'pro-tag',
							color: 'purple',
							onClick: () => setIsProPopupOpen(true),
						}}
					/>
				}
			/>

			<ContainerComponent general>
				<ColumnComponent>
					<div className="vp-page vp-automations">
						<KpiGrid label={__('Automation summary', 'vulopilot')} cols={3}>
							<Kpi
								icon="automation"
								tone="violet"
								label={__('Running', 'vulopilot')}
								value={isLoading ? '–' : `${on.length}/${builtins.length}`}
								hint={
									isLoading
										? ''
										: sprintf(
												/* translators: %d: automations switched on. */
												_n('%d automation is on', '%d automations are on', on.length, 'vulopilot'),
												on.length
										  )
								}
							/>
							<Kpi
								icon="clock"
								tone="blue"
								label={__('Last run', 'vulopilot')}
								value={isLoading ? '–' : latest?.last_run_finished_at ? shortWhen(latest.last_run_finished_at) : __('Not yet', 'vulopilot')}
								hint={latest ? nameOf(latest) : __('Runs appear here once one finishes', 'vulopilot')}
							/>
							<Kpi
								icon="error"
								tone={failedRuns > 0 ? 'red' : 'green'}
								label={__('Failed runs', 'vulopilot')}
								value={isLoading ? '–' : failedRuns}
								hint={__('In the last 30 days', 'vulopilot')}
							/>
						</KpiGrid>

						{attention.length > 0 && (
							<div className="vp-auto-alert" role="status">
								<i className="adminfont-error" aria-hidden="true" />
								<ul>
									{attention.map((line) => (
										<li key={line}>{line}</li>
									))}
								</ul>
							</div>
						)}

						<SectionHead title={__('Running for you', 'vulopilot')} />
						{isLoading && 0 === builtins.length ? (
							<div className="vp-row">
								<Skeleton size="tall" />
								<Skeleton size="tall" />
							</div>
						) : (
							<div className="vp-row">
								{scan && <BuiltinAutomationCard row={scan} kind="scan" onChanged={refetch} />}
								{report && <BuiltinAutomationCard row={report} kind="report" onChanged={refetch} />}
							</div>
						)}

						<SectionHead title={__('Do more with VuloPilot Pro', 'vulopilot')} />
						<div className="vp-row is-wide-left">
							<section className="vp-card vp-auto-sample">
								<header className="vp-card-head">
									<div className="vp-card-title">
										<span className="vp-card-icon" aria-hidden="true">
											<i className="adminfont-automation" />
										</span>
										<div>
											<h3>{__('Your own automations', 'vulopilot')}</h3>
											<p>{__('When something happens on your site, VuloPilot handles it.', 'vulopilot')}</p>
										</div>
									</div>
								</header>
								<div className="vp-card-body">
									<CustomAutomationsSample />
								</div>
							</section>
							<section className="vp-card vp-auto-sample">
								<header className="vp-card-head">
									<div className="vp-card-title">
										<span className="vp-card-icon" aria-hidden="true">
											<i className="adminfont-ai" />
										</span>
										<div>
											<h3>{__('AI agents', 'vulopilot')}</h3>
											<p>{__('Hand off ongoing work, review every change.', 'vulopilot')}</p>
										</div>
									</div>
								</header>
								<div className="vp-card-body">
									<AiAgentsSample />
								</div>
							</section>
						</div>

						<section className="vp-card vp-auto-learn">
							<div className="vp-card-body">
								<i className="adminfont-document" aria-hidden="true" />
								<span>
									<strong>{__('New to automations?', 'vulopilot')}</strong>
									{__('How schedules work, what the report contains, and how to change who receives it.', 'vulopilot')}
								</span>
								<a className="vp-card-link" href={DOCS_URL} target="_blank" rel="noopener noreferrer">
									{__('Read the guide', 'vulopilot')}
									<i className="adminfont-external" aria-hidden="true" />
								</a>
							</div>
						</section>
					</div>
				</ColumnComponent>
			</ContainerComponent>

			<PopupComponent
				open={isProPopupOpen}
				onClose={() => setIsProPopupOpen(false)}
				width={46}
				height="auto"
				position="lightbox"
			>
				<ShowProPopup feature={CUSTOM_AUTOMATIONS} />
			</PopupComponent>
		</>
	);
};

export default Automations;
