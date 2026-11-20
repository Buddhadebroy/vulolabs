/* global vulomailAppLocalizer */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { __, _n, sprintf } from '@wordpress/i18n';
import { NoticeComponent } from '@zyra/components';
import { ButtonInput, SelectInput, TextInput } from '@zyra/inputs';
import { apiGet, apiPost } from '../services/api';
import { errorNoticeHtml } from '../services/errorHelp';
import { errorMessage } from '../services/notify';
import { escapeHtml, goToTab, providerLabel } from '../services/types';
import { FieldRow } from './ChannelSettings';
import type {
	Connection,
	ConnectionsPayload,
	TestResult,
} from '../services/types';
import {
	Card,
	EmptyState,
	IconTile,
	Pill,
	Segmented,
	Skeleton,
} from '../components/ui';
import type { Status, Tone } from '../components/ui';

interface Check {
	id: string;
	label: string;
	status: 'good' | 'warning' | 'error' | 'info';
	message: string;
	/** What to do about it; empty when nothing needs doing. */
	fix?: string;
	/** Where to do it: a VuloMail tab, or another admin URL. */
	action?: { label: string; tab?: string; url?: string } | null;
}

type Channel = 'email' | 'sms';

// react-select shows its placeholder for an empty value, so "Live routing" needs a real one.
const LIVE = 'live';

const STATUS: Record<
	Check['status'],
	{ icon: string; text: string; tone: Tone; pill: Status }
> = {
	error: {
		icon: 'close',
		text: __('Problem', 'vulomail'),
		tone: 'red',
		pill: 'bad',
	},
	warning: {
		icon: 'error',
		text: __('Needs attention', 'vulomail'),
		tone: 'amber',
		pill: 'warn',
	},
	info: {
		icon: 'info',
		text: __('Info', 'vulomail'),
		tone: 'blue',
		pill: 'info',
	},
	good: {
		icon: 'check',
		text: __('Passed', 'vulomail'),
		tone: 'green',
		pill: 'good',
	},
};

// Most urgent first.
const ORDER: Check['status'][] = ['error', 'warning', 'info'];

const follow = (action: Check['action']) => {
	if (action?.tab) {
		goToTab(action.tab);
	} else if (action?.url) {
		window.location.href = action.url;
	}
};

/** How long ago `checked` was, for the "Checked …" stamp. */
const checkedStamp = (checked: number) => {
	const minutes = Math.round((Date.now() - checked) / 60000);

	if (minutes < 1) {
		return __('Checked just now', 'vulomail');
	}

	/* translators: %d: minutes since the last diagnostics run. */
	return sprintf(
		_n(
			'Checked %d minute ago',
			'Checked %d minutes ago',
			minutes,
			'vulomail'
		),
		minutes
	);
};

/**
 * One check as an expandable row: icon, name, status and the first line of what was found, with its action on
 * the right. Opening it shows the whole finding and how to fix it. Problems start open.
 */
const CheckRow = ({ check }: { check: Check }) => (
	<details
		className={`vm-check is-${check.status}`}
		open={'error' === check.status}
	>
		<summary>
			<IconTile
				icon={STATUS[check.status].icon}
				tone={STATUS[check.status].tone}
			/>
			<span className="vm-check-head">
				<span className="vm-check-title">
					<strong>{escapeHtml(check.label)}</strong>
					<Pill status={STATUS[check.status].pill}>
						{STATUS[check.status].text}
					</Pill>
				</span>
				<span className="vm-check-line">{check.message}</span>
			</span>
			{check.action && (
				<button
					type="button"
					className="vm-chip-link"
					onClick={(event) => {
						event.preventDefault();
						follow(check.action);
					}}
				>
					{check.action.label}
				</button>
			)}
			<span className="vm-check-chevron" aria-hidden="true" />
		</summary>
		<div className="vm-check-body">
			<p>{check.message}</p>
			{check.fix && (
				<div className="vm-check-fix">
					<i className="adminfont-lightbulb" aria-hidden="true" />
					<p>
						<strong>{__('How to fix it', 'vulomail')}</strong>
						{check.fix}
					</p>
				</div>
			)}
		</div>
	</details>
);

/** Send a test email or text message, through live routing or one chosen connection. */
const TestPanel = ({
	connections,
	preselected,
	initialChannel,
}: {
	connections: Connection[];
	preselected: string;
	initialChannel: Channel | '';
}) => {
	const target = connections.find((item) => item.id === preselected);
	const [channel, setChannel] = useState<Channel>(
		target?.channel ?? (initialChannel || 'email')
	);
	const [to, setTo] = useState<Record<Channel, string>>({
		email: '',
		sms: '',
	});
	const [connectionId, setConnectionId] = useState<Record<Channel, string>>({
		email: 'email' === target?.channel ? target.id : LIVE,
		sms: 'sms' === target?.channel ? target.id : LIVE,
	});
	const [isSending, setIsSending] = useState(false);
	const [result, setResult] = useState<TestResult | null>(null);
	const [isHighlighted, setIsHighlighted] = useState(
		Boolean(target || initialChannel)
	);

	const isEmail = 'email' === channel;
	const own = connections.filter((item) => item.channel === channel);

	// Coming from a connection's or a channel's "Send a test": scroll here and flash the card once.
	useEffect(() => {
		if (!isHighlighted) {
			return;
		}

		document
			.getElementById('tools-test-card')
			?.scrollIntoView({ behavior: 'smooth', block: 'center' });

		const timeout = setTimeout(() => setIsHighlighted(false), 2000);

		return () => clearTimeout(timeout);
	}, []);

	const pick = (next: Channel) => {
		setChannel(next);
		setResult(null);
	};

	const send = () => {
		setIsSending(true);
		setResult(null);

		apiPost<TestResult>(`tools/test-${channel}`, {
			to: to[channel],
			connection_id:
				LIVE === connectionId[channel] ? '' : connectionId[channel],
		})
			.then(setResult)
			.catch((error) =>
				setResult({
					success: false,
					provider: '',
					message: errorMessage(error),
					attempts: [],
				})
			)
			.finally(() => setIsSending(false));
	};

	const failedAttempts = result
		? result.attempts.filter(
				(attempt) => !attempt.success && result.attempts.length > 1
			)
		: [];

	return (
		<Card
			id="tools-test-card"
			className={`vm-tools-test${isHighlighted ? ' vulomail-highlight' : ''}`}
			icon="send"
			title={__('Send a test', 'vulomail')}
			desc={__(
				'The quickest way to know it works: send one and check it arrives.',
				'vulomail'
			)}
		>
			<Segmented
				stretch
				label={__('Channel', 'vulomail')}
				value={channel}
				onChange={(next) => pick(next as Channel)}
				options={[
					{
						value: 'email',
						label: __('Email', 'vulomail'),
						icon: 'mail',
					},
					{
						value: 'sms',
						label: __('SMS', 'vulomail'),
						icon: 'send',
					},
				]}
			/>

			<FieldRow
				htmlFor="vm-test-to"
				label={
					isEmail
						? __('Send to', 'vulomail')
						: __('Phone number', 'vulomail')
				}
				help={
					isEmail
						? __('Any inbox you can check.', 'vulomail')
						: __(
								'With its country code. Your gateway may charge for the message.',
								'vulomail'
							)
				}
			>
				<TextInput
					id="vm-test-to"
					name="vm-test-to"
					type={isEmail ? 'email' : 'text'}
					value={to[channel]}
					placeholder={
						isEmail
							? vulomailAppLocalizer.admin_email
							: '+14155550123'
					}
					onChange={(next) =>
						setTo({ ...to, [channel]: String(next) })
					}
					onKeyDown={(event) => {
						if (
							'Enter' === event.key &&
							to[channel].trim() &&
							!isSending
						) {
							send();
						}
					}}
				/>
			</FieldRow>

			<FieldRow
				label={__('Send through', 'vulomail')}
				help={__(
					'"Normal delivery order" tries the primary, then the backup, exactly like a real message.',
					'vulomail'
				)}
			>
				<SelectInput
					key={channel}
					type="single-select"
					name={`vm-test-through-${channel}`}
					options={[
						{
							value: LIVE,
							label: __('Normal delivery order', 'vulomail'),
						},
						...own.map((item) => ({
							value: item.id,
							label: `${item.label} · ${item.provider_label}`,
						})),
					]}
					value={connectionId[channel]}
					isClearable={false}
					onChange={(value) =>
						setConnectionId({
							...connectionId,
							[channel]: String(value),
						})
					}
				/>
			</FieldRow>

			<div className="vm-tools-send-row">
				<ButtonInput
					buttons={{
						text: isSending
							? __('Sending…', 'vulomail')
							: isEmail
								? __('Send test email', 'vulomail')
								: __('Send test SMS', 'vulomail'),
						icon: 'send',
						color: 'purple-bg',
						disabled: isSending || '' === to[channel].trim(),
						onClick: send,
					}}
				/>
			</div>

			{result && (
				<NoticeComponent
					displayPosition="inline-notice"
					type={result.success ? 'success' : 'error'}
					title={
						result.success
							? sprintf(
									/* translators: %s: provider name. */
									__('Sent - accepted by %s', 'vulomail'),
									providerLabel(result.provider)
								)
							: __('The test was not sent', 'vulomail')
					}
					message={
						// NoticeComponent's array form renders plain text; only the single line can carry the help link.
						failedAttempts.length > 0
							? [
									result.message,
									...failedAttempts.map(
										(attempt) =>
											`${providerLabel(attempt.provider)}: ${attempt.error_message}`
									),
								]
							: result.success
								? result.message
								: errorNoticeHtml(
										{
											provider: result.provider,
											error_message: result.message,
											is_cause: true,
										},
										channel
									)
					}
				/>
			)}
		</Card>
	);
};

/**
 * Tools: one health summary, every check in one list (most urgent first, passed checks folded away), and a
 * test sender beside it.
 */
const Tools = () => {
	const hash = new URLSearchParams(useLocation().hash.substring(1));
	const preselected = hash.get('connection') ?? '';
	const requestedTest = hash.get('test');
	const initialChannel: Channel | '' =
		'sms' === requestedTest || 'email' === requestedTest
			? requestedTest
			: '';
	const [connections, setConnections] = useState<Connection[] | null>(null);
	const [checks, setChecks] = useState<Check[] | null>(null);
	const [lastChecked, setLastChecked] = useState<number | null>(null);
	const [error, setError] = useState('');

	const runDiagnostics = () => {
		setChecks(null);
		setError('');

		apiGet<Check[]>('tools/diagnostics')
			.then((data) => {
				setChecks(data);
				setLastChecked(Date.now());
			})
			.catch((e) => setError(errorMessage(e)));
	};

	useEffect(() => {
		apiGet<ConnectionsPayload>('connections')
			.then((payload) => setConnections(payload.connections))
			.catch((e) => setError(errorMessage(e)));

		runDiagnostics();
	}, []);

	const bySeverity = (status: Check['status']) =>
		(checks ?? []).filter((check) => status === check.status);
	const problems = bySeverity('error').length;
	const attention = bySeverity('warning').length;
	const passed = bySeverity('good');
	const toReview = ORDER.flatMap((status) => bySeverity(status));

	const overallText = problems
		? sprintf(
				/* translators: %d: number of failing checks. */
				_n(
					'%d problem is stopping messages from going out. Fix it first.',
					'%d problems are stopping messages from going out. Fix them first.',
					problems,
					'vulomail'
				),
				problems
			)
		: attention
			? sprintf(
					/* translators: %d: number of checks needing attention. */
					_n(
						'%d check needs attention.',
						'%d checks need attention.',
						attention,
						'vulomail'
					),
					attention
				)
			: __(
					'No problems found. Send a test to see a message arrive.',
					'vulomail'
				);

	// The status card Settings → Email and SMS open with: how healthy delivery is, and the button that re-checks.
	const tone: Status = !checks
		? 'off'
		: problems
			? 'bad'
			: attention
				? 'warn'
				: 'good';
	const toneWord = !checks
		? __('Checking…', 'vulomail')
		: problems
			? __('Needs fixing', 'vulomail')
			: attention
				? __('Needs attention', 'vulomail')
				: __('All good', 'vulomail');
	const counts = checks
		? [
				{
					key: 'bad',
					show: problems > 0,
					label: sprintf(
						/* translators: %d: number of failing checks. */ _n(
							'%d problem',
							'%d problems',
							problems,
							'vulomail'
						),
						problems
					),
				},
				{
					key: 'warn',
					show: attention > 0,
					label: sprintf(
						/* translators: %d: number of checks needing attention. */ _n(
							'%d to review',
							'%d to review',
							attention,
							'vulomail'
						),
						attention
					),
				},
				{
					key: 'good',
					show: passed.length > 0,
					label: sprintf(
						/* translators: %d: number of passed checks. */ _n(
							'%d passed',
							'%d passed',
							passed.length,
							'vulomail'
						),
						passed.length
					),
				},
			].filter((count) => count.show)
		: [];

	const header = (
		<section
			className={`vm-set-hero is-${tone}`}
			aria-labelledby="vm-tools-hero"
		>
			<div className="vm-set-hero-main">
				<IconTile
					icon="security"
					tone={
						'good' === tone
							? 'green'
							: 'warn' === tone
								? 'amber'
								: 'bad' === tone
									? 'red'
									: 'neutral'
					}
					size="lg"
				/>
				<div className="vm-set-hero-text">
					<div className="vm-set-hero-title">
						<h3 id="vm-tools-hero">
							{__('Delivery health', 'vulomail')}
						</h3>
						<Pill status={tone}>{toneWord}</Pill>
					</div>
					<p>
						{checks
							? overallText
							: __(
									"Checking that email and text messages go out, and why if they don't.",
									'vulomail'
								)}
					</p>
					{counts.length > 0 && (
						<div className="vm-set-path">
							<span className="vm-set-path-label">
								{__('Results', 'vulomail')}
							</span>
							<ol>
								{counts.map((count) => (
									<li key={count.key}>
										<span
											className={`vm-set-path-chip vm-tools-count is-${count.key}`}
										>
											{count.label}
										</span>
									</li>
								))}
							</ol>
							{lastChecked && (
								<span className="vm-tools-stamp">
									{checkedStamp(lastChecked)}
								</span>
							)}
						</div>
					)}
				</div>
				<div className="vm-set-hero-actions">
					<ButtonInput
						buttons={{
							text: checks
								? __('Check again', 'vulomail')
								: __('Checking…', 'vulomail'),
							icon: 'refresh',
							color: 'purple',
							disabled: !checks && !error,
							onClick: runDiagnostics,
						}}
					/>
				</div>
			</div>
		</section>
	);

	return (
		<div className="vm-page vm-set vm-tools">
			{header}

			{/* The checks, with the test sender beside them: it stays in view while you work down the list. */}
			<div className="vm-row is-side">
				<Card
					id="tools-diagnostics-card"
					icon="security"
					title={__('Checks', 'vulomail')}
					desc={__(
						'What was looked at on this site, most urgent first. Running them never changes a setting.',
						'vulomail'
					)}
				>
					{error && (
						<EmptyState
							icon="error"
							tone="red"
							title={__('Could not run the checks', 'vulomail')}
							text={error}
						/>
					)}
					{!checks && !error && (
						<>
							<Skeleton />
							<Skeleton />
							<Skeleton />
						</>
					)}
					{checks && (
						<div className="vm-checks">
							{toReview.map((check) => (
								<CheckRow key={check.id} check={check} />
							))}
							{passed.length > 0 && (
								<details
									className="vm-check is-good vm-check-passed"
									open={0 === toReview.length}
								>
									<summary>
										<IconTile icon="check" tone="green" />
										<span className="vm-check-head">
											<span className="vm-check-title">
												<strong>
													{sprintf(
														/* translators: %d: number of passed checks. */
														_n(
															'%d check passed',
															'%d checks passed',
															passed.length,
															'vulomail'
														),
														passed.length
													)}
												</strong>
											</span>
											<span className="vm-check-line">
												{passed
													.map((check) =>
														escapeHtml(check.label)
													)
													.join(', ')}
											</span>
										</span>
										<span
											className="vm-check-chevron"
											aria-hidden="true"
										/>
									</summary>
									<ul className="vm-check-passed-list">
										{passed.map((check) => (
											<li key={check.id}>
												<i
													className="adminfont-check"
													aria-hidden="true"
												/>
												<span>
													<strong>
														{escapeHtml(
															check.label
														)}
													</strong>
													{check.message}
												</span>
											</li>
										))}
									</ul>
								</details>
							)}
						</div>
					)}
				</Card>

				<div className="vm-tools-side">
					{connections ? (
						<TestPanel
							connections={connections}
							preselected={preselected}
							initialChannel={initialChannel}
						/>
					) : (
						<Skeleton size="tall" />
					)}
				</div>
			</div>
		</div>
	);
};

export default Tools;
