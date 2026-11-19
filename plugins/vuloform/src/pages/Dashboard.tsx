/* global vuloformAppLocalizer */
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { ColumnComponent, ContainerComponent, NavigatorHeaderComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { apiGet } from '../services/api';
import { errorMessage } from '../services/notify';
import { goToTab, settingsUrl, tabUrl } from '../services/types';
import {
	Card,
	EmptyState,
	IconTile,
	Kpi,
	KpiGrid,
	SectionHead,
	Segmented,
	Skeleton,
	greeting,
	percentChange,
} from '../components/ui';
import type { Tone } from '../components/ui';

interface Point {
	date: string;
	submissions: number;
	spam: number;
}

interface Overview {
	days: number;
	totals: { submissions: number; spam: number };
	previous: { submissions: number; spam: number };
	series: Point[];
	top_forms: { id: number; title: string; count: number }[];
	forms: { total: number; published: number };
	unread: number;
	ever_received: boolean;
	failing: {
		count: number;
		latest: { id: number; form_id: number; form_title: string; failed: { type: string; name: string; detail: string }[]; day: string } | null;
	};
	spam_guard: { honeypot: boolean; recaptcha: boolean };
}

interface MigrationSource {
	id: string;
	label: string;
	count: number;
}

interface Action {
	id: string;
	icon: string;
	tone: Tone;
	title: ReactNode;
	text: string;
	cta: { label: string; href: string };
}

const RANGES = [
	{ value: '7', label: __('7 days', 'vuloform') },
	{ value: '30', label: __('30 days', 'vuloform') },
	{ value: '90', label: __('90 days', 'vuloform') },
];

/** "Nov 4" for a `Y-m-d` day, in the site visitor's locale. */
const shortDate = (day: string): string =>
	new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

/** Smooth line chart of submissions per day; hover a day to read it. Same drawing as VuloCart's sales chart. */
const TrendChart = ({ series }: { series: Point[] }) => {
	const [hover, setHover] = useState<number | null>(null);
	const received = series.map((point) => point.submissions);
	const spam = series.map((point) => point.spam);
	const max = Math.max(...received, ...spam, 0);
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

	const receivedPath = line(received);
	const ticks = count > 1 ? [0, Math.floor((count - 1) / 2), count - 1] : [0];
	const active = null !== hover ? series[hover] : null;

	return (
		<div className="vf-chart">
			<div className="vf-chart-grid" aria-hidden="true">
				<span>{max ? max.toLocaleString() : ''}</span>
				<span>{max ? Math.round(max / 2).toLocaleString() : ''}</span>
				<span>0</span>
			</div>
			<div
				className="vf-chart-plot"
				onMouseLeave={() => setHover(null)}
				role="img"
				aria-label={__('Submissions per day', 'vuloform')}
			>
				<svg viewBox="0 0 600 190" preserveAspectRatio="none" aria-hidden="true">
					<defs>
						<linearGradient id="vf-area" x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor="#5007aa" stopOpacity="0.16" />
							<stop offset="100%" stopColor="#5007aa" stopOpacity="0" />
						</linearGradient>
					</defs>
					<path d={`${receivedPath} L ${x(count - 1)} 190 L ${x(0)} 190 Z`} fill="url(#vf-area)" />
					<path d={receivedPath} className="vf-chart-line" />
					{spam.some(Boolean) && <path d={line(spam)} className="vf-chart-line is-failed" />}
				</svg>
				{series.map((point, index) => (
					<span
						key={point.date}
						className={`vf-chart-hit${hover === index ? ' is-hover' : ''}`}
						style={{ left: `${(index / count) * 100}%`, width: `${100 / count}%` }}
						onMouseEnter={() => setHover(index)}
					>
						{hover === index && <i style={{ top: `${(y(point.submissions) / 190) * 100}%` }} />}
					</span>
				))}
				{active && null !== hover && (
					<div className="vf-chart-tip" style={{ left: `${((hover + 0.5) / count) * 100}%` }}>
						<strong>
							{sprintf(
								/* translators: %d: number of submissions that day. */
								_n('%d submission', '%d submissions', active.submissions, 'vuloform'),
								active.submissions
							)}
						</strong>
						<span>
							{shortDate(active.date)}
							{active.spam > 0 &&
								` · ${sprintf(
									/* translators: %d: number of spam submissions that day. */
									_n('%d spam', '%d spam', active.spam, 'vuloform'),
									active.spam
								)}`}
						</span>
					</div>
				)}
			</div>
			<div className="vf-chart-axis">
				{ticks.map((index) => (
					<span key={index}>{series[index] ? shortDate(series[index].date) : ''}</span>
				))}
			</div>
		</div>
	);
};

/** One row of "Needs you" / "Get more from VuloForm": icon, a line of text, its action. */
const ActionRow = ({ icon, tone, title, text, cta }: Omit<Action, 'id'>) => (
	<li>
		<IconTile icon={icon} tone={tone} />
		<a className="vf-list-main" href={cta.href}>
			<strong>{title}</strong>
			<span>{text}</span>
		</a>
		<a className="vf-chip-link" href={cta.href}>
			{cta.label}
		</a>
	</li>
);

/**
 * Dashboard: what needs doing first, then how the forms are doing. Laid out like VuloCart's and
 * VuloMail's dashboards, so the three read the same way.
 */
const Dashboard = () => {
	const [days, setDays] = useState('30');
	const [overview, setOverview] = useState<Overview | null>(null);
	const [sources, setSources] = useState<MigrationSource[]>([]);
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

	// Forms another plugin still holds: worth bringing over, and only asked for once per load.
	useEffect(() => {
		apiGet<{ data: MigrationSource[] }>('migration/sources')
			.then((payload) => setSources(payload.data.filter((source) => source.count > 0)))
			.catch(() => {});
	}, []);

	// ---- What needs doing, most urgent first ----
	const needs = useMemo(() => {
		if (!overview) {
			return [];
		}

		const items: Action[] = [];
		const { failing, unread, spam_guard: guard } = overview;

		if (failing.count > 0 && failing.latest) {
			const first = failing.latest.failed[0];

			items.push({
				id: 'failing',
				icon: 'error',
				tone: 'red',
				title: sprintf(
					/* translators: %d: number of submissions. */
					_n(
						'A notification failed for %d submission',
						'Notifications failed for %d submissions',
						failing.count,
						'vuloform'
					),
					failing.count
				),
				text: [first?.detail, failing.latest.form_title, failing.latest.day].filter(Boolean).join(' · '),
				cta: { label: __('See why', 'vuloform'), href: tabUrl(`submissions&form=${failing.latest.form_id}`) },
			});
		}

		if (unread > 0) {
			items.push({
				id: 'unread',
				icon: 'mail',
				tone: 'blue',
				title: sprintf(
					/* translators: %d: number of unread submissions. */
					_n('%d new submission to read', '%d new submissions to read', unread, 'vuloform'),
					unread
				),
				text: __('People are waiting to hear back from you.', 'vuloform'),
				cta: { label: __('Read', 'vuloform'), href: tabUrl('submissions') },
			});
		}

		if (!guard.honeypot && !guard.recaptcha) {
			items.push({
				id: 'spam',
				icon: 'security',
				tone: 'amber',
				title: __('Spam protection is off', 'vuloform'),
				text: __('Bots can fill in your forms freely. Turn on the hidden spam trap.', 'vuloform'),
				cta: { label: __('Turn on', 'vuloform'), href: settingsUrl('spam') },
			});
		}

		if (sources.length > 0) {
			const total = sources.reduce((sum, source) => sum + source.count, 0);

			items.push({
				id: 'migrate',
				icon: 'import',
				tone: 'violet',
				title: sprintf(
					/* translators: %s: comma-separated plugin names. */
					__('Bring your %s forms into VuloForm', 'vuloform'),
					sources.map((source) => source.label).join(', ')
				),
				text: sprintf(
					/* translators: %d: number of forms. */
					_n(
						'%d form found. Migrating copies it; the other plugin is left untouched.',
						'%d forms found. Migrating copies them; the other plugin is left untouched.',
						total,
						'vuloform'
					),
					total
				),
				cta: { label: __('Migrate', 'vuloform'), href: tabUrl('forms') },
			});
		}

		return items;
	}, [overview, sources]);

	// ---- What would make the biggest difference next ----
	const ideas = useMemo(() => {
		if (!overview) {
			return [];
		}

		const items: Action[] = [];

		if (!vuloformAppLocalizer.has_vulomail) {
			items.push({
				id: 'vulomail',
				icon: 'mail',
				tone: 'green',
				title: __('Make sure form emails arrive', 'vuloform'),
				text: __('VuloMail sends them through your own email service, and logs every one.', 'vuloform'),
				cta: { label: __('Get VuloMail', 'vuloform'), href: vuloformAppLocalizer.vulomail_url },
			});
		}

		if (overview.spam_guard.honeypot && !overview.spam_guard.recaptcha) {
			items.push({
				id: 'recaptcha',
				icon: 'security',
				tone: 'amber',
				title: __('Add reCAPTCHA for stronger spam protection', 'vuloform'),
				text: __('Stops the bots the hidden spam trap misses, on the forms you choose.', 'vuloform'),
				cta: { label: __('Set up', 'vuloform'), href: settingsUrl('spam') },
			});
		}

		items.push({
			id: 'templates',
			icon: 'form',
			tone: 'violet',
			title: __('Start from a template', 'vuloform'),
			text: sprintf(
				/* translators: %d: number of form templates. */
				__('%d ready-made forms: contact, quote, booking, feedback and more.', 'vuloform'),
				vuloformAppLocalizer.templates.length
			),
			cta: { label: __('Browse', 'vuloform'), href: tabUrl('forms&new=1') },
		});

		return items.slice(0, 2);
	}, [overview]);

	// First-form checklist: shown until a form exists, is published and has been filled in.
	const steps = overview
		? [
				{ id: 'create', done: overview.forms.total > 0, icon: 'form', label: __('Create a form', 'vuloform'), href: tabUrl('forms&new=1') },
				{ id: 'publish', done: overview.forms.published > 0, icon: 'check', label: __('Publish it', 'vuloform'), href: tabUrl('forms') },
				{ id: 'place', done: overview.ever_received, icon: 'link', label: __('Add it to a page', 'vuloform'), href: tabUrl('forms') },
		  ]
		: [];
	const setupLeft = steps.filter((step) => !step.done).length;
	const waiting = needs.length + setupLeft;

	let headline = __('Here is how your forms are doing.', 'vuloform');

	if (overview) {
		headline =
			waiting > 0
				? sprintf(
						/* translators: %d: number of things that need attention. */
						_n('%d thing needs you. Here is how your forms are doing.', '%d things need you. Here is how your forms are doing.', waiting, 'vuloform'),
						waiting
				  )
				: __('Nothing is waiting on you. Here is how your forms are doing.', 'vuloform');
	}

	const header = (
		<NavigatorHeaderComponent
			headerIcon="analytics"
			headerTitle={sprintf(
				/* translators: 1: time-of-day greeting, 2: current user's display name. */
				__('%1$s, %2$s', 'vuloform'),
				greeting(),
				vuloformAppLocalizer.user_display_name || __('there', 'vuloform')
			)}
			headerDescription={headline}
			headerCustomContent={
				<ButtonInput
					buttons={[
						{
							text: __('Submissions', 'vuloform'),
							icon: 'mail',
							color: 'purple',
							onClick: () => goToTab('submissions'),
						},
						{
							text: __('New form', 'vuloform'),
							icon: 'plus',
							color: 'purple-bg',
							onClick: () => goToTab('forms&new=1'),
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
							<EmptyState icon="error" tone="red" title={__('Could not load the dashboard', 'vuloform')} text={error} />
						</Card>
					</ColumnComponent>
				</ContainerComponent>
			</>
		);
	}

	const totals = overview?.totals;
	const previous = overview?.previous;
	const series = overview?.series ?? [];
	const vsText = sprintf(
		/* translators: %s: length of the period, such as "30 days". */
		__('vs previous %s', 'vuloform'),
		RANGES.find((range) => range.value === days)?.label ?? ''
	);
	const bestDay = series.reduce<Point | null>(
		(best, point) => (point.submissions > (best ? best.submissions : 0) ? point : best),
		null
	);

	return (
		<>
			{header}
			<ContainerComponent general>
				<ColumnComponent>
					<div className={`vf-page${isLoading && overview ? ' is-loading' : ''}`}>
						{/* 1. Get set up. */}
						{overview && setupLeft > 0 && (
							<section className="vf-setup">
								<div>
									<strong>{__('Get your first submission', 'vuloform')}</strong>
									<span>
										{sprintf(
											/* translators: %d: number of steps left. */
											_n('%d step left before people can reach you.', '%d steps left before people can reach you.', setupLeft, 'vuloform'),
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
												{step.done && <span className="screen-reader-text">{__('(done)', 'vuloform')}</span>}
											</a>
										</li>
									))}
								</ol>
							</section>
						)}

						{/* 2. What needs doing, and what would help most. */}
						<div className="vf-row">
							<Card title={__('Needs you', 'vuloform')} icon="notification" desc={__('Most urgent first. Clear these and nobody is left waiting.', 'vuloform')}>
								{!overview && <Skeleton size="block" />}
								{overview && 0 === needs.length && (
									<EmptyState
										compact
										icon="check"
										tone="green"
										title={__('You\'re all caught up', 'vuloform')}
										text={
											setupLeft > 0
												? __('Nothing to answer yet. Finish the steps above to start getting submissions.', 'vuloform')
												: __('Every submission is read and every notification went out.', 'vuloform')
										}
									/>
								)}
								{needs.length > 0 && (
									<ul className="vf-list">
										{needs.map(({ id, ...item }) => (
											<ActionRow key={id} {...item} />
										))}
									</ul>
								)}
							</Card>
							<Card title={__('Get more from VuloForm', 'vuloform')} icon="analytics" desc={__('What would make the biggest difference next.', 'vuloform')}>
								{!overview && <Skeleton size="block" />}
								{ideas.length > 0 && (
									<ul className="vf-list">
										{ideas.map(({ id, ...item }) => (
											<ActionRow key={id} {...item} />
										))}
									</ul>
								)}
							</Card>
						</div>

						{/* 3. How the forms are doing. */}
						<SectionHead title={__('Activity', 'vuloform')}>
							<Segmented options={RANGES} value={days} onChange={setDays} label={__('Date range', 'vuloform')} />
						</SectionHead>

						<KpiGrid label={__('Key figures', 'vuloform')}>
							{overview && totals && previous ? (
								<>
									<Kpi
										icon="mail"
										label={__('Submissions', 'vuloform')}
										value={totals.submissions.toLocaleString()}
										change={percentChange(totals.submissions, previous.submissions)}
										hint={vsText}
										href={tabUrl('submissions')}
									/>
									<Kpi
										icon="notification"
										label={__('Unread', 'vuloform')}
										value={overview.unread.toLocaleString()}
										tone={overview.unread > 0 ? 'blue' : undefined}
										hint={overview.unread > 0 ? __('Waiting for you to open them', 'vuloform') : __('All read', 'vuloform')}
										href={tabUrl('submissions')}
									/>
									<Kpi
										icon="security"
										label={__('Spam blocked', 'vuloform')}
										value={totals.spam.toLocaleString()}
										change={percentChange(totals.spam, previous.spam)}
										inverse
										hint={vsText}
										href={tabUrl('submissions')}
									/>
									<Kpi
										icon="form"
										label={__('Live forms', 'vuloform')}
										value={overview.forms.published.toLocaleString()}
										hint={sprintf(
											/* translators: %d: number of forms in total. */
											_n('Of %d form', 'Of %d forms', overview.forms.total, 'vuloform'),
											overview.forms.total
										)}
										href={tabUrl('forms')}
									/>
								</>
							) : (
								[0, 1, 2, 3].map((index) => <Skeleton key={index} size="block" />)
							)}
						</KpiGrid>

						<div className="vf-row is-wide-left">
							<Card
								title={__('Submissions', 'vuloform')}
								icon="analytics"
								desc={
									bestDay
										? sprintf(
												/* translators: 1: date, 2: number of submissions. */
												__('Busiest day %1$s, with %2$d submissions.', 'vuloform'),
												shortDate(bestDay.date),
												bestDay.submissions
										  )
										: __('Submissions per day. Spam shows as a red line.', 'vuloform')
								}
							>
								{series.length > 0 ? <TrendChart series={series} /> : <Skeleton size="chart" />}
							</Card>

							<Card title={__('Top forms', 'vuloform')} icon="form" link={{ label: __('All forms', 'vuloform'), href: tabUrl('forms') }}>
								{!overview && <Skeleton size="block" />}
								{overview && 0 === overview.top_forms.length && (
									<EmptyState
										compact
										icon="form"
										title={__('No submissions in this period', 'vuloform')}
										text={__('Your busiest forms show here once people fill them in.', 'vuloform')}
									/>
								)}
								{overview && overview.top_forms.length > 0 && (
									<ul className="vf-list">
										{overview.top_forms.map((form) => (
											<li key={form.id}>
												<IconTile icon="form" tone="violet" size="sm" />
												<a className="vf-list-main" href={tabUrl(`submissions&form=${form.id}`)}>
													<strong>{form.title}</strong>
													<span>
														{sprintf(
															/* translators: %d: number of submissions. */
															_n('%d submission', '%d submissions', form.count, 'vuloform'),
															form.count
														)}
													</span>
												</a>
											</li>
										))}
									</ul>
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
