import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
	AnalyticsComponent,
	BadgeComponent,
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
	NavigatorHeaderComponent,
	NoticeComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import CreateBackup from '../components/CreateBackup';
import JobBanner from '../components/JobBanner';
import { apiGet } from '../services/api';
import { errorMessage } from '../services/notify';
import { useJob } from '../services/JobContext';
import { TRIGGER_LABELS, TYPE_LABELS } from '../services/types';
import type { Destination, Job, LogLine } from '../services/types';

interface OverviewData {
	last: Job | null;
	active: Job | null;
	counts: { completed: number; unverified: number; size: string };
	schedule: { files: string; database: string; next_files: string; next_database: string };
	storage: { free: string; public: boolean; folder: string };
	destinations: Destination[];
	warnings: { type: 'error' | 'warning' | 'info'; message: string }[];
	activity: LogLine[];
}

const go = (hash: string) => {
	window.location.hash = hash;
};

/**
 * Overview: is the site backed up, when is the next backup, where are backups kept, and is anything
 * wrong. Every figure is read from the backups and the server; none is an estimate.
 */
const Overview = () => {
	const { finishedCount, job } = useJob();
	const [data, setData] = useState<OverviewData | null>(null);
	const [error, setError] = useState('');
	const [isCreating, setIsCreating] = useState(false);

	useEffect(() => {
		apiGet<OverviewData>('overview')
			.then(setData)
			.catch((e) => setError(errorMessage(e)));
	}, [finishedCount]);

	const header = (
		<NavigatorHeaderComponent
			headerIcon="analytics"
			headerTitle={__('Overview', 'vulobackup')}
			headerDescription={__('Back up your WordPress site. Restore it when it matters.', 'vulobackup')}
			headerCustomContent={
				<ButtonInput
					buttons={{
						text: __('Back up now', 'vulobackup'),
						icon: 'database',
						disabled: Boolean(job),
						onClick: () => setIsCreating(true),
					}}
				/>
			}
		/>
	);

	if (error) {
		return (
			<>
				{header}
				<CardComponent title={__('Overview', 'vulobackup')} titleIcon="error">
					<ModuleGuardComponent icon="error" title={__('Could not load the overview', 'vulobackup')} desc={error} />
				</CardComponent>
			</>
		);
	}

	if (!data) {
		return (
			<>
				{header}
				<CardComponent title={__('Overview', 'vulobackup')} titleIcon="analytics" isLoading />
			</>
		);
	}

	const { last, schedule, storage } = data;
	const manual = 'manual' === schedule.files && 'manual' === schedule.database;

	let next = __('No schedule', 'vulobackup');

	if (!manual) {
		// The sooner of the two, when both are scheduled.
		next = [schedule.next_database, schedule.next_files].filter(Boolean)[0] ?? next;
	}

	return (
		<>
			{header}
			<ContainerComponent general>
				<ColumnComponent>
					<JobBanner />
					{data.warnings.map((warning) => (
						<NoticeComponent key={warning.message} displayPosition="inline-notice" type={warning.type} message={warning.message} />
					))}
					<AnalyticsComponent
						variant="small"
						cols={4}
						data={[
							{ icon: last ? 'check green' : 'error yellow', number: last ? last.created_at_display : '—', text: __('Last backup', 'vulobackup') },
							{ icon: 'clock blue', number: next, text: __('Next scheduled backup', 'vulobackup') },
							{ icon: 'database purple', number: data.counts.completed, text: __('Backups kept', 'vulobackup') },
							{ icon: 'analytics blue', number: data.counts.size, text: __('Used on this server', 'vulobackup') },
						]}
					/>
				</ColumnComponent>
				<ColumnComponent grid={6}>
					<CardComponent id="overview-last-backup" title={__('Last backup', 'vulobackup')} titleIcon="database">
						{last ? (
							<>
								<dl className="vulobackup-detail">
									<dt>{__('Name', 'vulobackup')}</dt>
									<dd>{last.name}</dd>
									<dt>{__('Made', 'vulobackup')}</dt>
									<dd>
										{last.created_at_display} · {TRIGGER_LABELS[last.trigger ?? 'manual']}
									</dd>
									<dt>{__('Contains', 'vulobackup')}</dt>
									<dd>
										{TYPE_LABELS[last.type ?? 'full']} · {last.size_display}
										{last.encrypted ? ` · ${__('Encrypted', 'vulobackup')}` : ''}
									</dd>
									<dt>{__('Integrity', 'vulobackup')}</dt>
									<dd>
										{last.verified ? (
											<BadgeComponent color="green" text={__('Verified', 'vulobackup')} />
										) : (
											<BadgeComponent color="yellow" text={__('Not verified', 'vulobackup')} />
										)}{' '}
										{last.verified_at_display}
									</dd>
									<dt>{__('Kept at', 'vulobackup')}</dt>
									<dd className="vulobackup-badges">
										{last.local && <BadgeComponent color="blue" text={__('This server', 'vulobackup')} />}
										{(last.copies ?? []).map((copy) => (
											<BadgeComponent
												key={copy.id}
												color={'uploaded' === copy.status ? 'green' : 'failed' === copy.status ? 'red' : 'yellow'}
												text={'failed' === copy.status ? sprintf(/* translators: %s: destination name. */ __('%s: failed', 'vulobackup'), copy.name) : copy.name}
											/>
										))}
									</dd>
								</dl>
								<ButtonInput
									buttons={[
										{ text: __('All backups', 'vulobackup'), color: 'purple', icon: 'database', onClick: () => go('&tab=backups') },
										{
											text: __('Restore this backup', 'vulobackup'),
											icon: 'refresh',
											disabled: !last.can_restore || Boolean(job),
											onClick: () => go(`&tab=restore&backup=${last.id}`),
										},
									]}
								/>
							</>
						) : (
							<ModuleGuardComponent
								icon="database"
								title={__('No backup yet', 'vulobackup')}
								desc={__('Make the first one now. It takes a few minutes on most sites.', 'vulobackup')}
							/>
						)}
					</CardComponent>
				</ColumnComponent>
				<ColumnComponent grid={6}>
					<CardComponent id="overview-storage" title={__('Where backups are kept', 'vulobackup')} titleIcon="link">
						<ul className="vulobackup-list">
							<li>
								<div className="vulobackup-cell">
									<span className="vulobackup-primary">{__('This server', 'vulobackup')}</span>
									<span className="vulobackup-secondary">
										{storage.folder}
										{storage.free
											? ` · ${sprintf(
													/* translators: %s: free disk space. */
													__('%s free', 'vulobackup'),
													storage.free
											  )}`
											: ''}
									</span>
								</div>
								<BadgeComponent color={storage.public ? 'yellow' : 'green'} text={storage.public ? __('Inside the web root', 'vulobackup') : __('Outside the web root', 'vulobackup')} />
							</li>
							{data.destinations.map((destination) => (
								<li key={destination.id}>
									<div className="vulobackup-cell">
										<span className="vulobackup-primary">{destination.name || destination.label}</span>
										<span className="vulobackup-secondary">{destination.ok ? destination.where : destination.message}</span>
									</div>
									{!destination.enabled ? (
										<BadgeComponent color="yellow" text={__('Off', 'vulobackup')} />
									) : (
										<BadgeComponent color={destination.ok ? 'green' : 'red'} text={destination.ok ? __('Connected', 'vulobackup') : __('Failing', 'vulobackup')} />
									)}
								</li>
							))}
						</ul>
						<ButtonInput buttons={{ text: __('Storage settings', 'vulobackup'), color: 'purple', icon: 'setting', onClick: () => go('&tab=settings&subtab=storage') }} />
					</CardComponent>
				</ColumnComponent>
				<ColumnComponent>
					<CardComponent id="overview-activity" title={__('Recent activity', 'vulobackup')} titleIcon="clock">
						{0 === data.activity.length ? (
							<ModuleGuardComponent icon="clock" title={__('Nothing has happened yet', 'vulobackup')} desc={__('Backups, restores and uploads are listed here as they happen.', 'vulobackup')} />
						) : (
							<ul className="vulobackup-list">
								{data.activity.map((line, index) => (
									<li key={`${line.time}-${index}`}>
										<span>{line.message}</span>
										<span className="vulobackup-secondary">{line.time_display}</span>
									</li>
								))}
							</ul>
						)}
					</CardComponent>
				</ColumnComponent>
			</ContainerComponent>
			<CreateBackup open={isCreating} onClose={() => setIsCreating(false)} />
		</>
	);
};

export default Overview;
