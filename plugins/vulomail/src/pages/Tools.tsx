/* global vulomailAppLocalizer */
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { __, sprintf } from '@wordpress/i18n';
import {
	AnalyticsComponent,
	BadgeComponent,
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	FormGroupComponent,
	FormGroupWrapperComponent,
	ListComponent,
	ModuleGuardComponent,
	NavigatorHeaderComponent,
	NoticeComponent,
} from '@zyra/components';
import { ButtonInput, SelectInput, TextInput } from '@zyra/inputs';
import { apiGet, apiPost } from '../services/api';
import { errorMessage } from '../services/notify';
import { escapeHtml, providerLabel } from '../services/types';
import type { Connection, ConnectionsPayload, TestResult } from '../services/types';

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

// Problems first, so what needs doing is at the top of the list.
const SEVERITY: Check['status'][] = ['error', 'warning', 'info', 'good'];

interface TestCardProps {
	channel: 'email' | 'sms';
	connections: Connection[];
	preselected: string;
}

// react-select shows its placeholder for an empty value, so "Live routing" needs a real one.
const LIVE = 'live';

const STATUS: Record<Check['status'], { color: string; icon: string; text: string }> = {
	good: { color: 'green', icon: 'check', text: __('OK', 'vulomail') },
	warning: { color: 'yellow', icon: 'error', text: __('Needs attention', 'vulomail') },
	error: { color: 'red', icon: 'error', text: __('Problem', 'vulomail') },
	info: { color: 'blue', icon: 'info', text: __('Info', 'vulomail') },
};

const follow = (action: Check['action']) => {
	if (action?.tab) {
		window.location.hash = `&tab=${action.tab}`;
	} else if (action?.url) {
		window.location.href = action.url;
	}
};

const TestCard = ({ channel, connections, preselected }: TestCardProps) => {
	const isEmail = 'email' === channel;
	const cardId = isEmail ? 'tools-test-email-card' : 'tools-test-sms-card';
	// Whether the "Test" button on Connections sent the visitor here for this card's channel.
	const isTarget = '' !== preselected && connections.some((item) => item.id === preselected);
	const [to, setTo] = useState(isEmail ? vulomailAppLocalizer.admin_email : '');
	const [connectionId, setConnectionId] = useState(
		connections.some((item) => item.id === preselected) ? preselected : LIVE
	);
	const [isSending, setIsSending] = useState(false);
	const [result, setResult] = useState<TestResult | null>(null);
	const [isHighlighted, setIsHighlighted] = useState(isTarget);

	// Scrolls to and briefly highlights this card so it's obvious which one was preselected,
	// since both the email and SMS cards are already on screen without any tab to switch to.
	useEffect(() => {
		if (!isTarget) {
			return;
		}

		setIsHighlighted(true);
		document.getElementById(cardId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });

		const timeout = setTimeout(() => setIsHighlighted(false), 2000);

		return () => clearTimeout(timeout);
	}, [cardId, isTarget, preselected]);

	const send = () => {
		setIsSending(true);
		setResult(null);

		apiPost<TestResult>(`tools/test-${channel}`, {
			to,
			connection_id: LIVE === connectionId ? '' : connectionId,
		})
			.then(setResult)
			.catch((error) =>
				setResult({ success: false, provider: '', message: errorMessage(error), attempts: [] })
			)
			.finally(() => setIsSending(false));
	};

	return (
		<CardComponent
			id={cardId}
			className={isHighlighted ? 'vulomail-highlight' : undefined}
			title={isEmail ? __('Send a test email', 'vulomail') : __('Send a test SMS', 'vulomail')}
			titleIcon={isEmail ? 'mail' : 'send'}
			desc={
				isEmail
					? __('Confirms that email leaves this site and reaches an inbox.', 'vulomail')
					: __('Confirms that your gateway accepts and delivers a text message. Your provider may charge for it.', 'vulomail')
			}
		>
			<FormGroupWrapperComponent>
				<FormGroupComponent
					row
					label={isEmail ? __('Send to', 'vulomail') : __('Phone number', 'vulomail')}
					desc={isEmail ? undefined : __('International format, for example +14155550123.', 'vulomail')}
				>
					<TextInput
						name={`test-${channel}-to`}
						type={isEmail ? 'email' : 'text'}
						value={to}
						onChange={(value) => setTo(String(value))}
					/>
				</FormGroupComponent>
				<FormGroupComponent
					row
					label={__('Send through', 'vulomail')}
					desc={__('"Live routing" follows the same path as every other message, including failover.', 'vulomail')}
				>
					<SelectInput
						type="single-select"
						name={`test-${channel}-connection`}
						options={[
							{ value: LIVE, label: __('Live routing', 'vulomail') },
							...connections.map((item) => ({ value: item.id, label: item.label })),
						]}
						value={connectionId}
						isClearable={false}
						onChange={(value) => setConnectionId(value as string)}
					/>
				</FormGroupComponent>
			</FormGroupWrapperComponent>
			{result && (
				<NoticeComponent
					displayPosition="inline-notice"
					type={result.success ? 'success' : 'error'}
					title={
						result.success
							? sprintf(
									/* translators: %s: provider name. */
									__('Accepted by %s', 'vulomail'),
									providerLabel(result.provider)
							  )
							: __('The test was not sent', 'vulomail')
					}
					message={(() => {
						const lines = [
							result.message,
							...result.attempts
								.filter((attempt) => !attempt.success && result.attempts.length > 1)
								.map((attempt) => `${providerLabel(attempt.provider)}: ${attempt.error_message}`),
						];

						// NoticeComponent's array form is the auto-rotating, closable banner UI; a
						// single line should stay plain text, or a stray close icon appears with it.
						return lines.length > 1 ? lines : lines[0];
					})()}
				/>
			)}
			<div className="vulomail-form-footer">
				<ButtonInput
					buttons={{
						text: isSending ? __('Sending…', 'vulomail') : __('Send test', 'vulomail'),
						icon: 'send',
						disabled: isSending || '' === to.trim(),
						onClick: send,
					}}
				/>
			</div>
		</CardComponent>
	);
};

const Tools = () => {
	const preselected = new URLSearchParams(useLocation().hash).get('connection') ?? '';
	const [connections, setConnections] = useState<Connection[] | null>(null);
	const [checks, setChecks] = useState<Check[] | null>(null);
	const [error, setError] = useState('');

	const runDiagnostics = () => {
		setChecks(null);

		apiGet<Check[]>('tools/diagnostics')
			.then(setChecks)
			.catch((e) => setError(errorMessage(e)));
	};

	useEffect(() => {
		apiGet<ConnectionsPayload>('connections')
			.then((payload) => setConnections(payload.connections))
			.catch((e) => setError(errorMessage(e)));

		runDiagnostics();
	}, []);

	const header = (
		<NavigatorHeaderComponent
			headerIcon="tools"
			headerTitle={__('Tools', 'vulomail')}
			headerDescription={__('Check that messages are going out, and find out why if they are not.', 'vulomail')}
			headerCustomContent={
				<ButtonInput
					buttons={{
						text: checks ? __('Run diagnostics again', 'vulomail') : __('Running…', 'vulomail'),
						icon: 'refresh',
						color: 'purple',
						disabled: !checks,
						onClick: runDiagnostics,
					}}
				/>
			}
		/>
	);

	if (error) {
		return (
			<>
				{header}
				<ContainerComponent general>
					<CardComponent title={__('Tools', 'vulomail')} titleIcon="error">
						<ModuleGuardComponent icon="error" title={__('Could not load the tools', 'vulomail')} desc={error} />
					</CardComponent>
				</ContainerComponent>
			</>
		);
	}

	const count = (status: Check['status']) => (checks ?? []).filter((check) => status === check.status).length;

	return (
		<>
			{header}
			<ContainerComponent general>
				<ColumnComponent grid={6}>
					{connections ? (
						<>
							<TestCard
								channel="email"
								connections={connections.filter((item) => 'email' === item.channel)}
								preselected={preselected}
							/>
							<TestCard
								channel="sms"
								connections={connections.filter((item) => 'sms' === item.channel)}
								preselected={preselected}
							/>
						</>
					) : (
						<>
							<CardComponent title={__('Send a test email', 'vulomail')} titleIcon="mail" isLoading />
							<CardComponent title={__('Send a test SMS', 'vulomail')} titleIcon="send" isLoading />
						</>
					)}
				</ColumnComponent>
				<ColumnComponent grid={6}>
					<CardComponent
						id="tools-diagnostics-card"
						title={__('Diagnostics', 'vulomail')}
						titleIcon="security"
						desc={__('Checks of this site\'s delivery setup. Nothing here changes any setting.', 'vulomail')}
						isLoading={!checks}
					>
						{checks && (
							<>
								<AnalyticsComponent
									variant="small"
									cols={3}
									data={[
										{ icon: 'check green', number: count('good'), text: __('Passed', 'vulomail') },
										{
											icon: 'error yellow',
											number: count('warning'),
											text: __('Need attention', 'vulomail'),
										},
										{ icon: 'error red', number: count('error'), text: __('Problems', 'vulomail') },
									]}
								/>
								<ListComponent
									className="mini-card report without-border"
									border
									items={[...checks]
										.sort((a, b) => SEVERITY.indexOf(a.status) - SEVERITY.indexOf(b.status))
										.map((check) => ({
										id: check.id,
										icon: `${STATUS[check.status].icon} ${STATUS[check.status].color}`,
										title: escapeHtml(check.label),
										titleTag: (
											<BadgeComponent
												color={STATUS[check.status].color}
												text={STATUS[check.status].text}
											/>
										),
										desc: (
											<>
												{check.message}
												{check.fix && (
													<span className="vulomail-check-fix">
														<strong>
															{'good' === check.status
																? __('Tip:', 'vulomail')
																: __('What to do:', 'vulomail')}
														</strong>{' '}
														{check.fix}
													</span>
												)}
											</>
										),
										tags: check.action ? (
											<ButtonInput
												buttons={{
													text: check.action.label,
													color: 'purple',
													onClick: () => follow(check.action),
												}}
											/>
										) : undefined,
									}))}
								/>
							</>
						)}
					</CardComponent>
				</ColumnComponent>
			</ContainerComponent>
		</>
	);
};

export default Tools;
