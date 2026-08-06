/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ModuleGuardComponent } from '@zyra/components';
import { formatWpDate } from '../../services/formatWpDate';

interface ScheduleRow {
	id: number;
	schedule: 'daily' | 'weekly' | 'monthly';
	is_enabled: boolean;
	next_run_at: string | null;
	last_run_at: string | null;
	last_run_status: 'success' | 'failure' | null;
	created_at: string;
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

const CADENCES: { key: 'weekly' | 'monthly'; label: string }[] = [
	{ key: 'weekly', label: __('Weekly Report', 'vulopilot') },
	{ key: 'monthly', label: __('Monthly Report', 'vulopilot') },
];

const scrollToGenerate = () => {
	document
		.getElementById('reports-generate')
		?.scrollIntoView({ behavior: 'smooth' });
};

/**
 * The mockup's "Weekly vs Monthly Comparison" shows fabricated 87/100 and
 * 89/100 gauge scores — no score concept attaches to a report schedule
 * anywhere in this codebase. Real substitute: GET /report-schedules
 * (Pro-only, graceful degrade — a 404 here means AdvancedReports isn't
 * active, not a transient failure) already returns real `last_run_at`/
 * `last_run_status`/`next_run_at` per schedule row, fields SchedulePanel.tsx
 * itself never displays. Shows the most recent weekly/monthly schedule's
 * real status instead.
 */
const ReportSchedulesSummary = () => {
	const [schedules, setSchedules] = useState<ScheduleRow[] | null>(null);

	useEffect(() => {
		getApiResponse<{ data: ScheduleRow[] } | ScheduleRow[]>(
			getApiLink(appLocalizer, 'report-schedules'),
			nonceHeaders
		).then((response) => {
			const list = Array.isArray(response)
				? response
				: (response?.data ?? []);
			setSchedules(list);
		});
	}, []);

	if (schedules === null) {
		return null;
	}

	return (
		<div className="report-schedules-summary">
			{CADENCES.map((cadence) => {
				const latest = schedules
					.filter((row) => row.schedule === cadence.key)
					.sort((a, b) =>
						b.created_at.localeCompare(a.created_at)
					)[0];

				return (
					<CardComponent
						key={cadence.key}
						className="report-schedule-card"
						titleIcon="calendar"
						title={cadence.label}
					>
						{!latest ? (
							<ModuleGuardComponent
								icon="calendar"
								title={__('Not scheduled yet', 'vulopilot')}
								desc={__(
									'Set up this report schedule below.',
									'vulopilot'
								)}
								buttonText={__('Set Up', 'vulopilot')}
								onButtonClick={scrollToGenerate}
							/>
						) : (
							<>
								<span
									className={
										latest.is_enabled
											? 'admin-badge green'
											: 'admin-badge'
									}
								>
									{latest.is_enabled
										? __('Enabled', 'vulopilot')
										: __('Disabled', 'vulopilot')}
								</span>
								<p className="report-schedule-detail">
									{latest.last_run_at
										? sprintf(
												/* translators: 1: date, 2: "succeeded" or "failed" */
												__(
													'Last run: %1$s (%2$s)',
													'vulopilot'
												),
												formatWpDate(latest.last_run_at),
												latest.last_run_status ===
													'success'
													? __(
															'succeeded',
															'vulopilot'
														)
													: __('failed', 'vulopilot')
											)
										: __('Has not run yet', 'vulopilot')}
								</p>
								<p className="report-schedule-detail">
									{latest.next_run_at
										? sprintf(
												/* translators: %s: date */
												__('Next run: %s', 'vulopilot'),
												formatWpDate(latest.next_run_at)
											)
										: __('Not scheduled', 'vulopilot')}
								</p>
							</>
						)}
					</CardComponent>
				);
			})}
		</div>
	);
};

export default ReportSchedulesSummary;
