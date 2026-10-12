import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { NoticeComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { apiPost } from '../services/api';
import { errorMessage, notify } from '../services/notify';
import { useJob } from '../services/JobContext';
import { STATUS } from '../services/types';

/**
 * Shown on every screen while a backup or restore is running: what it is doing, how far along it
 * is, and a way to stop it. When one finishes, says how it ended.
 */
const JobBanner = () => {
	const { job, finished, sessionLost, dismiss, kick } = useJob();
	const [isCancelling, setIsCancelling] = useState(false);

	if (sessionLost) {
		return (
			<NoticeComponent
				displayPosition="inline-notice"
				type="success"
				title={__('The site has been switched to the backup', 'vulobackup')}
				message={__('The restored database has its own users and sign-ins, so you need to sign in again, with a user name and password from the backup. The result of the restore is under VuloBackup → Restore.', 'vulobackup')}
				actionLabel={__('Sign in', 'vulobackup')}
				onAction={() => window.location.reload()}
			/>
		);
	}

	if (!job) {
		if (!finished) {
			return null;
		}

		const isRestore = 'restore' === finished.kind;
		const failed = 'completed' !== finished.status;

		let title = isRestore ? __('Restore completed', 'vulobackup') : __('Backup completed and verified', 'vulobackup');

		if ('failed' === finished.status) {
			title = isRestore ? __('The restore failed', 'vulobackup') : __('The backup failed', 'vulobackup');
		} else if ('cancelled' === finished.status) {
			title = isRestore ? __('The restore was cancelled', 'vulobackup') : __('The backup was cancelled', 'vulobackup');
		}

		let message = finished.error;

		if (!failed) {
			message = isRestore
				? __('Your site now runs from the backup. If you are asked to sign in again, use a user name and password from the backup.', 'vulobackup')
				: sprintf(
						/* translators: 1: backup name, 2: size. */
						__('"%1$s" is %2$s.', 'vulobackup'),
						finished.name,
						finished.size_display ?? ''
				  );

			if (finished.warnings.length > 0) {
				message += ' ' + __('It finished with warnings; open it to read them.', 'vulobackup');
			}
		}

		return (
			<NoticeComponent
				displayPosition="inline-notice"
				type={failed ? ('cancelled' === finished.status ? 'warning' : 'error') : finished.warnings.length > 0 ? 'warning' : 'success'}
				title={title}
				message={message}
				actionLabel={__('Dismiss', 'vulobackup')}
				onAction={dismiss}
			/>
		);
	}

	const cancel = () => {
		setIsCancelling(true);

		apiPost(`${'restore' === job.kind ? 'restores' : 'backups'}/${job.id}/cancel`)
			.then(() => kick())
			.catch((error) => notify('error', errorMessage(error)))
			.finally(() => setIsCancelling(false));
	};

	const isRestore = 'restore' === job.kind;
	// Once the site is being switched over there is nothing left that can safely be stopped.
	const canCancel = !(isRestore && 'restoring' === job.status);

	return (
		<div className="vulobackup-job" role="status" aria-live="polite">
			<div className="vulobackup-job-head">
				<div>
					<strong>
						{isRestore
							? sprintf(
									/* translators: %s: backup name. */
									__('Restoring "%s"', 'vulobackup'),
									job.name
							  )
							: job.name}
					</strong>{' '}
					<span>{job.label || STATUS[job.status]?.text || ''}</span>
				</div>
				<div className="vulobackup-inline">
					<span>{job.percent}%</span>
					{canCancel && (
						<ButtonInput
							buttons={{
								text: isCancelling ? __('Cancelling…', 'vulobackup') : __('Cancel', 'vulobackup'),
								color: 'border-red',
								disabled: isCancelling,
								onClick: cancel,
							}}
						/>
					)}
				</div>
			</div>
			<div className="vulobackup-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={job.percent}>
				<span style={{ width: `${Math.max(2, job.percent)}%` }} />
			</div>
			<span className="vulobackup-secondary">
				{isRestore
					? __('Keep this page open until the restore has finished. Nothing on the site is replaced until the last step.', 'vulobackup')
					: __('You can leave this page: the backup carries on in the background whenever the site is visited.', 'vulobackup')}
			</span>
		</div>
	);
};

export default JobBanner;
