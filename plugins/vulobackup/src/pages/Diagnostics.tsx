import { useCallback, useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { BadgeComponent, CardComponent, ColumnComponent, ContainerComponent, ModuleGuardComponent, NavigatorHeaderComponent, PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { TableCard } from '@zyra/table';
import JobBanner from '../components/JobBanner';
import { apiDelete, apiGet } from '../services/api';
import { errorMessage, notify } from '../services/notify';
import { useJob } from '../services/JobContext';
import type { LogLine } from '../services/types';

interface Check {
	label: string;
	status: 'ok' | 'info' | 'warning' | 'error';
	detail: string;
}

interface Data {
	checks: Check[];
	system: [string, string][];
}

interface TableQuery {
	paged?: number | string;
	per_page?: number | string;
	categoryFilter?: string;
}

const BADGES: Record<Check['status'], { color: string; text: string }> = {
	ok: { color: 'green', text: __('OK', 'vulobackup') },
	info: { color: 'blue', text: __('Note', 'vulobackup') },
	warning: { color: 'yellow', text: __('Check', 'vulobackup') },
	error: { color: 'red', text: __('Problem', 'vulobackup') },
};

const LEVELS: Record<string, { color: string; text: string }> = {
	info: { color: 'blue', text: __('Info', 'vulobackup') },
	warning: { color: 'yellow', text: __('Warning', 'vulobackup') },
	error: { color: 'red', text: __('Error', 'vulobackup') },
};

/**
 * Diagnostics: what this server can and cannot do, checked when the screen opens, and the record of
 * what VuloBackup has done.
 */
const Diagnostics = () => {
	const { finishedCount } = useJob();
	const [data, setData] = useState<Data | null>(null);
	const [error, setError] = useState('');
	const [query, setQuery] = useState<TableQuery>({ paged: 1, per_page: 10 });
	const [logs, setLogs] = useState<{ data: LogLine[]; total: number }>({ data: [], total: 0 });
	const [isLoading, setIsLoading] = useState(true);
	const [reload, setReload] = useState(0);
	const [confirmClear, setConfirmClear] = useState(false);

	const onQueryUpdate = useCallback((next: TableQuery) => setQuery(next), []);

	useEffect(() => {
		apiGet<Data>('diagnostics')
			.then(setData)
			.catch((e) => setError(errorMessage(e)));
	}, [reload]);

	useEffect(() => {
		let cancelled = false;

		setIsLoading(true);

		apiGet<{ data: LogLine[]; total: number }>('logs', {
			level: query.categoryFilter && 'all' !== query.categoryFilter ? query.categoryFilter : undefined,
			page: Number(query.paged) || 1,
			per_page: Number(query.per_page) || 10,
		})
			.then((result) => !cancelled && setLogs(result))
			.catch((e) => !cancelled && notify('error', errorMessage(e)))
			.finally(() => !cancelled && setIsLoading(false));

		return () => {
			cancelled = true;
		};
	}, [query, reload, finishedCount]);

	const clear = () => {
		apiDelete('logs')
			.then(() => {
				notify('success', __('Activity log cleared.', 'vulobackup'));
				setReload((n) => n + 1);
			})
			.catch((e) => notify('error', errorMessage(e)))
			.finally(() => setConfirmClear(false));
	};

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="tools"
				headerTitle={__('Diagnostics', 'vulobackup')}
				headerDescription={__('What this server can do, and the record of what VuloBackup did.', 'vulobackup')}
				headerCustomContent={<ButtonInput buttons={{ text: __('Check again', 'vulobackup'), color: 'purple', icon: 'refresh', onClick: () => setReload((n) => n + 1) }} />}
			/>
			<ContainerComponent general>
				<ColumnComponent>
					<JobBanner />
				</ColumnComponent>
				<ColumnComponent grid={7}>
					<CardComponent id="diagnostics-checks" title={__('Server checks', 'vulobackup')} titleIcon="security" isLoading={!data && !error}>
						{error && <ModuleGuardComponent icon="error" title={__('Could not run the checks', 'vulobackup')} desc={error} />}
						{data && (
							<ul className="vulobackup-list">
								{data.checks.map((check) => (
									<li key={check.label}>
										<div className="vulobackup-cell">
											<span className="vulobackup-primary">{check.label}</span>
											<span className="vulobackup-secondary">{check.detail}</span>
										</div>
										<BadgeComponent color={BADGES[check.status].color} text={BADGES[check.status].text} />
									</li>
								))}
							</ul>
						)}
					</CardComponent>
				</ColumnComponent>
				<ColumnComponent grid={5}>
					<CardComponent id="diagnostics-system" title={__('System', 'vulobackup')} titleIcon="info" isLoading={!data && !error}>
						{data && (
							<dl className="vulobackup-detail">
								{data.system.map(([label, value]) => (
									<div key={label} style={{ display: 'contents' }}>
										<dt>{label}</dt>
										<dd>{value}</dd>
									</div>
								))}
							</dl>
						)}
					</CardComponent>
				</ColumnComponent>
				<ColumnComponent>
					<CardComponent
						id="diagnostics-activity"
						title={__('Activity log', 'vulobackup')}
						titleIcon="clock"
						action={<ButtonInput buttons={{ text: __('Clear log', 'vulobackup'), icon: 'delete', color: 'border-red', disabled: 0 === logs.total, onClick: () => setConfirmClear(true) }} />}
					>
						<TableCard
							showMenu={false}
							headers={{
								message: {
									label: __('What happened', 'vulobackup'),
									render: (row: LogLine) => <span>{row.message}</span>,
								},
								time: { label: __('When', 'vulobackup'), render: (row: LogLine) => <span>{row.time_display}</span> },
								level: {
									label: __('Level', 'vulobackup'),
									render: (row: LogLine) => <BadgeComponent color={LEVELS[row.level]?.color ?? 'blue'} text={LEVELS[row.level]?.text ?? row.level} />,
								},
							}}
							rows={logs.data}
							ids={logs.data.map((_, index) => index)}
							totalRows={logs.total}
							categoryCounts={[
								{ value: 'all', label: __('All', 'vulobackup') },
								{ value: 'error', label: __('Errors', 'vulobackup') },
								{ value: 'warning', label: __('Warnings', 'vulobackup') },
							]}
							isLoading={isLoading}
							onQueryUpdate={onQueryUpdate}
							emptyMessage={__('Nothing has been recorded yet.', 'vulobackup')}
						/>
					</CardComponent>
				</ColumnComponent>
			</ContainerComponent>
			<PopupComponent open={confirmClear} onClose={() => setConfirmClear(false)} width={30} height="auto" position="lightbox" header={{ icon: 'delete', title: __('Clear the activity log?', 'vulobackup') }}>
				<div className="vulobackup-popup-body">
					<p>{__('The record of past backups, restores and uploads is deleted. Your backups are not affected.', 'vulobackup')}</p>
					<div className="vulobackup-form-footer">
						<ButtonInput
							buttons={[
								{ text: __('Keep it', 'vulobackup'), color: 'purple', onClick: () => setConfirmClear(false) },
								{ text: __('Clear log', 'vulobackup'), icon: 'delete', color: 'red', onClick: clear },
							]}
						/>
					</div>
				</div>
			</PopupComponent>
		</>
	);
};

export default Diagnostics;
