/* global vulopilotAppLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { NoticeManager } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { IconTile, Pill, Segmented, Switch } from '../../components/ui';
import type { Tone } from '../../components/ui';
import { formatWpDate, formatWpTime, isWpToday } from '../../services/formatWpDate';
import type { AutomationRow } from './automationsTypes';

interface TriggerConfig {
	frequency: string;
	day_of_week?: number;
}

const DAYS = [
	{ value: '1', label: __('Mon', 'vulopilot'), name: __('Monday', 'vulopilot') },
	{ value: '2', label: __('Tue', 'vulopilot'), name: __('Tuesday', 'vulopilot') },
	{ value: '3', label: __('Wed', 'vulopilot'), name: __('Wednesday', 'vulopilot') },
	{ value: '4', label: __('Thu', 'vulopilot'), name: __('Thursday', 'vulopilot') },
	{ value: '5', label: __('Fri', 'vulopilot'), name: __('Friday', 'vulopilot') },
	{ value: '6', label: __('Sat', 'vulopilot'), name: __('Saturday', 'vulopilot') },
	{ value: '7', label: __('Sun', 'vulopilot'), name: __('Sunday', 'vulopilot') },
];

const parseConfig = (row: AutomationRow): TriggerConfig => {
	try {
		return { frequency: 'disabled', ...JSON.parse(row.trigger_config || '{}') };
	} catch {
		return { frequency: 'disabled' };
	}
};

/** "Every Monday", "Every day"… for a row's `trigger_config`. */
const scheduleLabel = (config: TriggerConfig): string => {
	switch (config.frequency) {
		case 'daily':
			return __('Every day', 'vulopilot');
		case 'weekly':
			return sprintf(
				/* translators: %s: weekday, e.g. "Monday". */
				__('Every %s', 'vulopilot'),
				DAYS.find((day) => day.value === String(config.day_of_week ?? 1))?.name ?? ''
			);
		case 'monthly':
			return __('1st of every month', 'vulopilot');
		case 'manual':
			return __('Only when you run it', 'vulopilot');
		default:
			return __('Not scheduled', 'vulopilot');
	}
};

/** "Today, 09:00" or "Nov 19, 2026, 09:00". */
const when = (iso: string): string =>
	sprintf(
		/* translators: 1: day ("Today" or a date), 2: time. */
		__('%1$s, %2$s', 'vulopilot'),
		isWpToday(iso) ? __('Today', 'vulopilot') : formatWpDate(iso),
		formatWpTime(iso)
	);

export interface BuiltinAutomationCardProps {
	row: AutomationRow;
	kind: 'scan' | 'report';
	onChanged: () => void;
}

const LOOK: Record<
	BuiltinAutomationCardProps['kind'],
	{ icon: string; tone: Tone; title: string; desc: string; schedules: { value: string; label: string }[] }
> = {
	scan: {
		icon: 'search',
		tone: 'blue',
		title: __('Website scan', 'vulopilot'),
		desc: __('Checks your whole site and refreshes every score and issue.', 'vulopilot'),
		schedules: [
			{ value: 'daily', label: __('Daily', 'vulopilot') },
			{ value: 'weekly', label: __('Weekly', 'vulopilot') },
			{ value: 'monthly', label: __('Monthly', 'vulopilot') },
			{ value: 'manual', label: __('Manual', 'vulopilot') },
		],
	},
	report: {
		icon: 'mail',
		tone: 'violet',
		title: __('Visibility report', 'vulopilot'),
		desc: __('Emails you a summary of your visibility, issues and opportunities.', 'vulopilot'),
		schedules: [
			{ value: 'weekly', label: __('Weekly', 'vulopilot') },
			{ value: 'monthly', label: __('Monthly', 'vulopilot') },
		],
	},
};

/**
 * One of free's two built-in automations: on or off, its schedule, when it runs next or ran last, and the action
 * that runs it now. Changes save as they are made (`PATCH /automations/{id}`).
 */
const BuiltinAutomationCard = ({ row, kind, onChanged }: BuiltinAutomationCardProps) => {
	const look = LOOK[kind];
	const [isRunning, setIsRunning] = useState(false);
	// The switch moves on click, not when the PATCH and the page's refetch come back.
	const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);
	const config = parseConfig(row);
	const isOn = 'enabled' === (optimisticStatus ?? row.status);

	useEffect(() => {
		if (optimisticStatus === row.status) {
			setOptimisticStatus(null);
		}
		// Only follows the server's row catching up.
	}, [row.status]);

	const patch = (data: Record<string, unknown>, onFailure?: () => void) =>
		sendApiResponse(vulopilotAppLocalizer, getApiLink(vulopilotAppLocalizer, `automations/${row.id}`), data).then(
			(response) => (response ? onChanged() : onFailure?.())
		);

	const toggle = () => {
		const next = isOn ? 'disabled' : 'enabled';

		setOptimisticStatus(next);
		patch({ status: next }, () => setOptimisticStatus(null));
	};

	const setFrequency = (frequency: string) =>
		patch({
			trigger_config: 'weekly' === frequency ? { frequency, day_of_week: config.day_of_week ?? 1 } : { frequency },
		});

	const setDay = (day: string) => patch({ trigger_config: { frequency: 'weekly', day_of_week: Number(day) } });

	const runNow = () => {
		setIsRunning(true);
		sendApiResponse(vulopilotAppLocalizer, getApiLink(vulopilotAppLocalizer, `automations/${row.id}/run`), {})
			.then((response) => {
				NoticeManager.add({
					uniqueKey: `automation-run-${row.id}`,
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? 'scan' === kind
							? __('Scan started. Your scores update when it finishes.', 'vulopilot')
							: __('Report sent to the admin email.', 'vulopilot')
						: __('Could not run this now. Please try again.', 'vulopilot'),
				});

				if (response) {
					onChanged();
				}
			})
			.finally(() => setIsRunning(false));
	};

	const failed = 'failed' === row.last_run_status;
	const nextRun = isOn && row.next_run_at ? when(row.next_run_at) : null;
	const lastRun = row.last_run_finished_at ? when(row.last_run_finished_at) : null;
	const enableFirst = 'report' === kind && !isOn;
	const frequency = look.schedules.some((option) => option.value === config.frequency)
		? config.frequency
		: look.schedules[0].value;

	return (
		<section className={`vp-card vp-auto${isOn ? '' : ' is-off'}`} id={`builtin-automation-${kind}`}>
			<header className="vp-auto-head">
				<IconTile icon={look.icon} tone={isOn ? look.tone : 'neutral'} />
				<div className="vp-auto-title">
					<h3>
						{look.title}
						<Pill status={isOn ? 'good' : 'off'}>{isOn ? __('On', 'vulopilot') : __('Off', 'vulopilot')}</Pill>
					</h3>
					<p>{look.desc}</p>
				</div>
				<Switch checked={isOn} onChange={toggle} label={look.title} />
			</header>

			<dl className="vp-auto-facts">
				<div>
					<dt>{__('Schedule', 'vulopilot')}</dt>
					<dd>{scheduleLabel(config)}</dd>
				</div>
				<div>
					<dt>{nextRun ? __('Next run', 'vulopilot') : __('Last run', 'vulopilot')}</dt>
					<dd className={failed && !nextRun ? 'is-bad' : ''}>
						{nextRun ?? lastRun ?? __('Not yet', 'vulopilot')}
					</dd>
				</div>
				<div>
					<dt>{'scan' === kind ? __('Covers', 'vulopilot') : __('Sent to', 'vulopilot')}</dt>
					<dd>
						{'scan' === kind ? (
							__('SEO, speed, security, content', 'vulopilot')
						) : (
							<a href="?page=vulopilot#&tab=settings&subtab=notifications">{__('Admin email', 'vulopilot')}</a>
						)}
					</dd>
				</div>
			</dl>

			<div className="vp-auto-schedule">
				<span className="vp-auto-label">{__('Run', 'vulopilot')}</span>
				<Segmented
					size="sm"
					label={__('How often', 'vulopilot')}
					value={frequency}
					onChange={setFrequency}
					options={look.schedules}
				/>
				{'weekly' === frequency && (
					<Segmented
						size="sm"
						label={__('Day of the week', 'vulopilot')}
						value={String(config.day_of_week ?? 1)}
						onChange={setDay}
						options={DAYS.map(({ value, label }) => ({ value, label }))}
					/>
				)}
			</div>

			<footer className="vp-auto-foot">
				<span className={`vp-auto-status${failed ? ' is-bad' : ''}`}>
					{failed && <i className="adminfont-error" aria-hidden="true" />}
					{failed
						? __('The last run failed. Run it again to retry.', 'vulopilot')
						: __('Changes save as you make them.', 'vulopilot')}
				</span>
				<ButtonInput
					buttons={{
						text: enableFirst
							? __('Turn on', 'vulopilot')
							: isRunning
								? __('Running…', 'vulopilot')
								: 'scan' === kind
									? __('Scan now', 'vulopilot')
									: __('Send now', 'vulopilot'),
						icon: enableFirst ? 'check' : 'scan' === kind ? 'scan' : 'send',
						color: 'purple-bg',
						disabled: isRunning,
						onClick: enableFirst ? toggle : runNow,
					}}
				/>
			</footer>
		</section>
	);
};

export default BuiltinAutomationCard;
