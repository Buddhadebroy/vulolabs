/* global vulomailAppLocalizer */
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ColumnComponent, ContainerComponent, NavigatorHeaderComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { apiGet } from '../services/api';
import { errorMessage } from '../services/notify';
import { errorHelp } from '../services/errorHelp';
import { goToTab, settingsUrl, tabUrl } from '../services/types';
import type { Failure } from '../services/errorHelp';
import {
	Card,
	EmptyState,
	IconTile,
	Kpi,
	KpiGrid,
	Pill,
	SectionHead,
	Segmented,
	Skeleton,
	greeting,
	percentChange,
} from '../components/ui';
import type { Status, Tone } from '../components/ui';

interface ChannelState {
	sent: number;
	failed: number;
	enabled: boolean;
	ready: boolean;
	primary: string;
	backup: string;
}

interface Totals {
	sent: number;
	failed: number;
}

interface Point {
	date: string;
	email_sent: number;
	email_failed: number;
	sms_sent: number;
	sms_failed: number;
}

interface Overview {
	days: number;
	email: ChannelState;
	sms: ChannelState;
	previous: { email: Totals; sms: Totals };
	series: Point[];
	sender_set: boolean;
	logging: boolean;
	sms_alerts: { enabled: number; available: number };
	recent_failures: {
		id: number;
		channel: string;
		provider: string;
		recipients: string;
		subject: string;
		error_message: string;
		/** The failure to explain: the connection's, when WordPress's own mailer only ran after it. */
		cause: Failure;
		created_at: string;
		created_at_display?: string;
		created_at_time?: string;
		created_at_day?: string;
	}[];
}

const RANGES = [
	{ value: '7', label: __('7 days', 'vulomail') },
	{ value: '30', label: __('30 days', 'vulomail') },
	{ value: '90', label: __('90 days', 'vulomail') },
];

/** Delivered share of all attempts, as a whole percentage, or null when nothing was sent. */
const rate = (sent: number, failed: number): number | null =>
	0 === sent + failed ? null : Math.round((sent / (sent + failed)) * 100);

/** "Nov 4" for a `Y-m-d` day, in the site visitor's locale. */
const shortDate = (day: string): string =>
	new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** Smooth line chart of messages per day; hover a day to read it. Same drawing as VuloCart's sales chart. */
const TrendChart = ({ series, metric }: { series: Point[]; metric: 'email' | 'sms' }) => {
	const [hover, setHover] = useState<number | null>(null);
	const sent = series.map((point) => point[`${metric}_sent`]);
	const failed = series.map((point) => point[`${metric}_failed`]);
	const max = Math.max(...sent, ...failed, 0);
	const count = series.length;
	const x = (index: number) => (count > 1 ? (index / (count - 1)) * 600 : 300);
	const y = (value: number) => (max ? 176 - (value / max) * 160 : 176);

	// Catmull-Rom → bezier: a smooth line through every day, kept between the two days it joins.
	const line = (values: number[]) =>
		values.reduce((d, value, index) => {
			if (0 === index) {
				return `M ${x(0)} ${y(value)}`;
			}

			const p0 = values[Math.max(0, index - 2)];
			const p1 = values[index - 1];
			const p3 = values[Math.min(count - 1, index + 1)];
			const lo = Math.min(y(p1), y(value));
			const hi = Math.max(y(p1), y(value));
			const clamp = (v: number) => Math.min(hi, Math.max(lo, v));
			const c1x = x(index - 1) + (x(index) - x(Math.max(0, index - 2))) / 6;
			const c1y = clamp(y(p1) + (y(value) - y(p0)) / 6);
			const c2x = x(index) - (x(Math.min(count - 1, index + 1)) - x(index - 1)) / 6;
			const c2y = clamp(y(value) - (y(p3) - y(p1)) / 6);

			return `${d} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x(index)} ${y(value)}`;
		}, '');

	const sentPath = line(sent);
	const failedPath = line(failed);
	const ticks = count > 1 ? [0, Math.floor((count - 1) / 2), count - 1] : [0];
	const active = null !== hover ? series[hover] : null;

	return (
		<div className="vm-chart">
			<div className="vm-chart-grid" aria-hidden="true">
				<span>{max ? max.toLocaleString() : ''}</span>
				<span>{max ? Math.round(max / 2).toLocaleString() : ''}</span>
				<span>0</span>
			</div>
			<div
				className="vm-chart-plot"
				onMouseLeave={() => setHover(null)}
				role="img"
				aria-label={
					'email' === metric ? __('Emails sent per day', 'vulomail') : __('Text messages sent per day', 'vulomail')
				}
			>
				<svg viewBox="0 0 600 190" preserveAspectRatio="none" aria-hidden="true">
					<defs>
						<linearGradient id="vm-area" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor="#5007aa" stopOpacity="0.16" />
							<stop offset="100%" stopColor="#5007aa" stopOpacity="0" />
						</linearGradient>
					</defs>
					<path d={`${sentPath} L ${x(count - 1)} 190 L ${x(0)} 190 Z`} fill="url(#vm-area)" />
					<path d={sentPath} className="vm-chart-line" />
					{failed.some(Boolean) && <path d={failedPath} className="vm-chart-line is-failed" />}
				</svg>
				{series.map((point, index) => (
					<span
						key={point.date}
						className={`vm-chart-hit${hover === index ? ' is-hover' : ''}`}
						style={{ left: `${(index / count) * 100}%`, width: `${100 / count}%` }}
						onMouseEnter={() => setHover(index)}
					>
						{hover === index && <i style={{ top: `${(y(point[`${metric}_sent`]) / 190) * 100}%` }} />}
					</span>
				))}
				{active && null !== hover && (
					<div className="vm-chart-tip" style={{ left: `${((hover + 0.5) / count) * 100}%` }}>
						<strong>
							{sprintf(
								/* translators: %d: number of messages delivered that day. */
								_n('%d delivered', '%d delivered', active[`${metric}_sent`], 'vulomail'),
								active[`${metric}_sent`]
							)}
						</strong>
						<span>
							{shortDate(active.date)}
							{active[`${metric}_failed`] > 0 &&
								` · ${sprintf(
									/* translators: %d: number of messages that failed that day. */
									_n('%d failed', '%d failed', active[`${metric}_failed`], 'vulomail'),
									active[`${metric}_failed`]
								)}`}
						</span>
					</div>
				)}
			</div>
			<div className="vm-chart-axis">
				{ticks.map((index) => (
					<span key={index}>{series[index] ? shortDate(series[index].date) : ''}</span>
				))}
			</div>
		</div>
	);
};

/** One row of "Needs you" / "Get more from VuloMail": icon, a line of text, its action. */
const ActionRow = ({ icon, tone, title, text, cta }: { icon: string; tone: Tone; title: ReactNode; text: string; cta: { label: string; href: string } }) => (
	<li>
		<IconTile icon={icon} tone={tone} />
		<a className="vm-list-main" href={cta.href}>
			<strong>{title}</strong>
			<span>{text}</span>
		</a>
		<a className="vm-chip-link" href={cta.href}>
			{cta.label}
		</a>
	</li>
);

/** One channel's state in the Channels card. */
const ChannelRow = ({ channel, state, icon }: { channel: 'email' | 'sms'; state: ChannelState; icon: string }) => {
	let status: Status = 'good';
	let word = __('Working', 'vulomail');
	let text = state.backup
		? sprintf(
				/* translators: 1: primary connection name, 2: backup connection name. */
				__('Through %1$s, with %2$s as backup.', 'vulomail'),
				state.primary,
				state.backup
		  )
		: sprintf(
				/* translators: %s: connection name. */
				__('Through %s. No backup set.', 'vulomail'),
				state.primary
		  );

	if (!state.enabled) {
		status = 'off';
		word = __('Off', 'vulomail');
		text =
			'email' === channel
				? __('WordPress sends email on its own.', 'vulomail')
				: __('No text messages are sent.', 'vulomail');
	} else if (!state.ready) {
		status = 'email' === channel ? 'warn' : 'bad';
		word = 'email' === channel ? __('Default mailer', 'vulomail') : __('Not set up', 'vulomail');
		text =
			'email' === channel
				? __('Sent with the WordPress default mailer.', 'vulomail')
				: __('Add an SMS gateway to start sending.', 'vulomail');
	}

	return (
		<li>
			<IconTile icon={icon} tone={'email' === channel ? 'green' : 'blue'} />
			<a className="vm-list-main" href={settingsUrl(channel)}>
				<strong>{'email' === channel ? __('Email', 'vulomail') : __('SMS', 'vulomail')}</strong>
				<span>{text}</span>
			</a>
			<Pill status={status}>{word}</Pill>
		</li>
	);
};

const Dashboard = () => {
	const [days, setDays] = useState('30');
	const [metric, setMetric] = useState<'email' | 'sms'>('email');
	const [overview, setOverview] = useState<Overview | null>(null);
	const [error, setError] = useState('');
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;

		setIsLoading(true);
		apiGet<Overview>('overview', { days })
			.then((data) => {
				if (!cancelled) {
					setOverview(data);
					setError('');
				}
			})
			.catch((e) => !cancelled && setError(errorMessage(e)))
			.finally(() => !cancelled && setIsLoading(false));

		return () => {
			cancelled = true;
		};
	}, [days]);

	// ---- What needs doing, most urgent first ----
	const needs = useMemo(() => {
		if (!overview) {
			return [];
		}

		const { email, sms } = overview;
		const items: { id: string; icon: string; tone: Tone; title: ReactNode; text: string; cta: { label: string; href: string } }[] = [];

		// Failures, one row per cause, each with the screen that fixes it.
		const causes = new Map<string, { count: number; latest: Overview['recent_failures'][number]; cta: { label: string; href: string } }>();

		overview.recent_failures.forEach((row) => {
			const help = errorHelp(row.cause, row.channel);
			const title = help ? help.short : row.cause.error_message || __('A message could not be sent.', 'vulomail');
			const known = causes.get(title);

			if (known) {
				known.count++;
				return;
			}

			causes.set(title, {
				count: 1,
				latest: row,
				cta: help
					? { label: help.linkLabel, href: help.href }
					: { label: __('See why', 'vulomail'), href: tabUrl(`logs&log=${row.id}`) },
			});
		});

		causes.forEach((cause, title) => {
			items.push({
				id: `failed-${title}`,
				icon: 'sms' === cause.latest.channel ? 'send' : 'mail',
				tone: 'red',
				title,
				text: [
					sprintf(
						/* translators: %d: number of recent messages that failed for this reason. */
						_n('%d recent message failed', '%d recent messages failed', cause.count, 'vulomail'),
						cause.count
					),
					cause.latest.recipients,
					cause.latest.created_at_day,
				]
					.filter(Boolean)
					.join(' · '),
				cta: cause.cta,
			});
		});

		if (sms.enabled && !sms.ready && overview.sms_alerts.enabled > 0) {
			items.push({
				id: 'sms',
				icon: 'send',
				tone: 'red',
				title: __('SMS alerts are on, but nothing can send them', 'vulomail'),
				text: __('Add an SMS gateway, or the alerts you switched on are never sent.', 'vulomail'),
				cta: { label: __('Add gateway', 'vulomail'), href: settingsUrl('sms') },
			});
		}

		if (!email.enabled) {
			items.push({
				id: 'email-off',
				icon: 'mail',
				tone: 'amber',
				title: __('VuloMail isn\'t sending your email', 'vulomail'),
				text: __('WordPress sends it on its own, with no backup and nothing logged.', 'vulomail'),
				cta: { label: __('Turn on', 'vulomail'), href: settingsUrl('email') },
			});
		}

		if (!overview.logging) {
			items.push({
				id: 'logging',
				icon: 'clock',
				tone: 'amber',
				title: __('The delivery log is off', 'vulomail'),
				text: __('Nothing is recorded, so failures go unnoticed and these numbers stay at zero.', 'vulomail'),
				cta: { label: __('Turn on', 'vulomail'), href: settingsUrl('logging') },
			});
		}

		return items;
	}, [overview]);

	// ---- What would make the biggest difference next ----
	const ideas = useMemo(() => {
		if (!overview) {
			return [];
		}

		const items: { id: string; icon: string; tone: Tone; title: string; text: string; cta: { label: string; href: string } }[] = [];

		if (overview.email.ready && !overview.email.backup) {
			items.push({
				id: 'backup',
				icon: 'refresh',
				tone: 'violet',
				title: __('Add a backup connection', 'vulomail'),
				text: sprintf(
					/* translators: %s: primary connection name. */
					__('If %s goes down, email keeps going out through the backup.', 'vulomail'),
					overview.email.primary
				),
				cta: { label: __('Add backup', 'vulomail'), href: settingsUrl('email') },
			});
		}

		if (0 === overview.sms_alerts.enabled) {
			items.push({
				id: 'alerts',
				icon: 'notification',
				tone: 'blue',
				title: __('Get a text when something happens', 'vulomail'),
				text: __('New orders, failed payments, admin logins - straight to your phone.', 'vulomail'),
				cta: { label: __('Set up', 'vulomail'), href: tabUrl('sms-alerts') },
			});
		}

		items.push({
			id: 'templates',
			icon: 'mail',
			tone: 'green',
			title: __('Make your emails look like you', 'vulomail'),
			text: __('Add your logo and colours to the emails your site sends.', 'vulomail'),
			cta: { label: __('Customise', 'vulomail'), href: tabUrl('email-templates') },
		});

		items.push({
			id: 'health',
			icon: 'security',
			tone: 'amber',
			title: __('Run a delivery health check', 'vulomail'),
			text: __('Finds setup problems before your customers notice them.', 'vulomail'),
			cta: { label: __('Check', 'vulomail'), href: settingsUrl('tools') },
		});

		return items.slice(0, 2);
	}, [overview]);

	// The sentence under the greeting: the most urgent thing first, so the page answers "what now?".
	let headline = __('Here is how email and text messages from this site are doing.', 'vulomail');

	// Setup steps still open (the strip below lists them); they count as waiting on you too.
	const setupLeft = overview ? [!overview.email.ready, !overview.sender_set].filter(Boolean).length : 0;
	const waiting = needs.length + setupLeft;

	if (overview) {
		headline =
			waiting > 0
				? sprintf(
						/* translators: %d: number of things that need attention. */
						_n('%d thing needs you. Here is how delivery is going.', '%d things need you. Here is how delivery is going.', waiting, 'vulomail'),
						waiting
				  )
				: __('Nothing is waiting on you. Here is how delivery is going.', 'vulomail');
	}

	const header = (
		<NavigatorHeaderComponent
			headerIcon="analytics"
			headerTitle={sprintf(
				/* translators: 1: time-of-day greeting, 2: current user's display name. */
				__('%1$s, %2$s', 'vulomail'),
				greeting(),
				vulomailAppLocalizer.user_display_name || __('there', 'vulomail')
			)}
			headerDescription={headline}
			headerCustomContent={
				<ButtonInput
					buttons={[
						{
							text: __('View logs', 'vulomail'),
							icon: 'clock',
							color: 'purple',
							onClick: () => goToTab('logs'),
						},
						{
							text: __('Send a test', 'vulomail'),
							icon: 'send',
							color: 'purple-bg',
							onClick: () => goToTab('settings&subtab=tools'),
						},
					]}
				/>
			}
		/>
	);

	if (error && !overview) {
		return (
			<>
				{header}
				<ContainerComponent general>
					<ColumnComponent>
						<Card>
							<EmptyState icon="error" tone="red" title={__('Could not load the dashboard', 'vulomail')} text={error} />
						</Card>
					</ColumnComponent>
				</ContainerComponent>
			</>
		);
	}

	const email = overview?.email;
	const sms = overview?.sms;
	const previous = overview?.previous;
	const failed = email && sms ? email.failed + sms.failed : 0;
	const failedBefore = previous ? previous.email.failed + previous.sms.failed : 0;
	const deliveryRate = email && sms ? rate(email.sent + sms.sent, failed) : null;
	const rateBefore = previous ? rate(previous.email.sent + previous.sms.sent, failedBefore) : null;
	const vsText = sprintf(
		/* translators: %s: length of the period, such as "30 days". */
		__('vs previous %s', 'vulomail'),
		RANGES.find((range) => range.value === days)?.label ?? ''
	);

	// First-send checklist: shown until email is connected, the sender is set and something has gone out.
	const steps = overview
		? [
				{ id: 'connect', done: Boolean(email?.ready), icon: 'link', label: __('Connect email', 'vulomail'), href: settingsUrl('email') },
				{ id: 'sender', done: overview.sender_set, icon: 'profile', label: __('Set your sender', 'vulomail'), href: settingsUrl('email') },
		  ]
		: [];
	const series = overview?.series ?? [];
	const bestDay = series.reduce<Point | null>(
		(best, point) => (point[`${metric}_sent`] > (best ? best[`${metric}_sent`] : 0) ? point : best),
		null
	);

	return (
		<>
			{header}
			<ContainerComponent general>
				<ColumnComponent>
					<div className={`vm-page${isLoading && overview ? ' is-loading' : ''}`}>
						{/* 1. Get set up. */}
						{overview && setupLeft > 0 && (
							<section className="vm-setup">
								<div>
									<strong>{__('Get ready to send', 'vulomail')}</strong>
									<span>
										{sprintf(
											/* translators: %d: number of steps left. */
											_n('%d step left before your email is in safe hands.', '%d steps left before your email is in safe hands.', setupLeft, 'vulomail'),
											setupLeft
										)}
									</span>
								</div>
								<ol>
									{steps.map((step) => (
										<li key={step.id} className={step.done ? 'is-done' : ''}>
											<a href={step.href}>
												<i className={`adminfont-${step.done ? 'check' : step.icon}`} aria-hidden="true" />
												{step.label}
												{step.done && <span className="screen-reader-text">{__('(done)', 'vulomail')}</span>}
											</a>
										</li>
									))}
								</ol>
							</section>
						)}

						{/* 2. What needs doing, and what would help most. */}
						<div className="vm-row">
							<Card title={__('Needs you', 'vulomail')} icon="notification" desc={__('Most urgent first. Clear these and every message gets through.', 'vulomail')}>
								{!overview && <Skeleton size="block" />}
								{overview && 0 === needs.length && (
									<EmptyState
										compact
										icon="check"
										tone="green"
										title={__('You\'re all caught up', 'vulomail')}
										text={
											setupLeft > 0
												? __('Nothing has failed. Finish the steps above and every message is in safe hands.', 'vulomail')
												: __('Everything is connected and nothing has failed.', 'vulomail')
										}
									/>
								)}
								{needs.length > 0 && (
									<ul className="vm-list">
										{needs.map(({ id, ...item }) => (
											<ActionRow key={id} {...item} />
										))}
									</ul>
								)}
							</Card>
							<Card title={__('Get more from VuloMail', 'vulomail')} icon="analytics" desc={__('What would make the biggest difference next.', 'vulomail')}>
								{!overview && <Skeleton size="block" />}
								{ideas.length > 0 && (
									<ul className="vm-list">
										{ideas.map(({ id, ...item }) => (
											<ActionRow key={id} {...item} />
										))}
									</ul>
								)}
							</Card>
						</div>

						{/* 3. How delivery is going. */}
						<SectionHead title={__('Delivery', 'vulomail')}>
							<Segmented options={RANGES} value={days} onChange={setDays} label={__('Date range', 'vulomail')} />
						</SectionHead>

						<KpiGrid label={__('Key figures', 'vulomail')}>
							{email && sms && previous ? (
								<>
									<Kpi
										icon="mail"
										label={__('Emails delivered', 'vulomail')}
										value={email.sent.toLocaleString()}
										change={percentChange(email.sent, previous.email.sent)}
										hint={vsText}
										href={tabUrl('logs')}
									/>
									<Kpi
										icon="send"
										label={__('Text messages delivered', 'vulomail')}
										value={sms.sent.toLocaleString()}
										change={percentChange(sms.sent, previous.sms.sent)}
										hint={vsText}
										href={tabUrl('logs')}
									/>
									<Kpi
										icon="analytics"
										label={__('Delivery rate', 'vulomail')}
										value={null === deliveryRate ? '—' : `${deliveryRate}%`}
										change={null !== deliveryRate && null !== rateBefore ? deliveryRate - rateBefore : null}
										hint={null === deliveryRate ? __('Nothing sent yet', 'vulomail') : __('Delivered out of every attempt', 'vulomail')}
										href={tabUrl('logs')}
									/>
									<Kpi
										icon="error"
										label={__('Failed', 'vulomail')}
										value={failed.toLocaleString()}
										change={percentChange(failed, failedBefore)}
										inverse
										tone={failed > 0 ? 'red' : undefined}
										hint={failed > 0 ? __('Open the log to see why', 'vulomail') : vsText}
										href={tabUrl('logs')}
									/>
								</>
							) : (
								[0, 1, 2, 3].map((index) => <Skeleton key={index} size="block" />)
							)}
						</KpiGrid>

						<div className="vm-row is-wide-left">
							<Card
								title={'email' === metric ? __('Emails sent', 'vulomail') : __('Text messages sent', 'vulomail')}
								icon="analytics"
								desc={
									bestDay
										? sprintf(
												/* translators: 1: date, 2: number of messages. */
												__('Busiest day %1$s, with %2$d delivered.', 'vulomail'),
												shortDate(bestDay.date),
												bestDay[`${metric}_sent`]
										  )
										: __('Delivered messages per day. Failed ones show as a red line.', 'vulomail')
								}
								action={
									<Segmented
										size="sm"
										options={[
											{ value: 'email', label: __('Email', 'vulomail') },
											{ value: 'sms', label: __('SMS', 'vulomail') },
										]}
										value={metric}
										onChange={(next) => setMetric(next as 'email' | 'sms')}
										label={__('Chart channel', 'vulomail')}
									/>
								}
							>
								{series.length > 0 ? <TrendChart series={series} metric={metric} /> : <Skeleton size="chart" />}
							</Card>

							<Card title={__('Sending through', 'vulomail')} icon="link" link={{ label: __('Settings', 'vulomail'), href: settingsUrl('email') }}>
								{email && sms ? (
									<ul className="vm-list">
										<ChannelRow channel="email" state={email} icon="mail" />
										<ChannelRow channel="sms" state={sms} icon="send" />
									</ul>
								) : (
									<Skeleton size="block" />
								)}
							</Card>
						</div>
					</div>
				</ColumnComponent>
			</ContainerComponent>
		</>
	);
};

export default Dashboard;
