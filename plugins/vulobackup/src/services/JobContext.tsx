import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { apiGet, apiPost } from './api';
import { errorMessage, notify } from './notify';
import type { Job } from './types';

interface JobState {
	/** The backup or restore that is running, if any. */
	job: Job | null;
	/** The job that most recently finished while this screen was open. */
	finished: Job | null;
	/** Goes up each time a job finishes, so lists know to reload. */
	finishedCount: number;
	/** A restore replaced the database and this browser's session with it. */
	sessionLost: boolean;
	/** Starts asking the server to work on the running job. Safe to call at any time. */
	kick: () => void;
	dismiss: () => void;
}

const JobContext = createContext<JobState | undefined>(undefined);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Keeps the running job moving while the admin screen is open.
 *
 * A job is done in slices of a few seconds. Each call to `jobs/run` does one slice and answers with
 * where the job has got to; this asks again until the job is finished. Backups also move forward on
 * WP-Cron, so closing the screen does not stop one; a restore only moves while a screen is open.
 */
export const JobProvider = ({ children }: { children: ReactNode }) => {
	const [job, setJob] = useState<Job | null>(null);
	const [finished, setFinished] = useState<Job | null>(null);
	const [finishedCount, setFinishedCount] = useState(0);
	const [sessionLost, setSessionLost] = useState(false);
	const running = useRef(false);
	const mounted = useRef(true);

	const kick = useCallback(() => {
		if (running.current) {
			return;
		}

		running.current = true;

		(async () => {
			let failures = 0;
			let current: Job | null = null;

			while (mounted.current) {
				try {
					const result = await apiPost<{ job: Job | null; busy: boolean }>('jobs/run');

					failures = 0;

					if (!result.job) {
						setJob(null);

						// It finished in the background (WP-Cron did the last slice): fetch how it ended.
						if (current) {
							const ended = await apiGet<Job>(`${'restore' === current.kind ? 'restores' : 'backups'}/${current.id}`);

							setFinished(ended);
							setFinishedCount((count) => count + 1);
						}

						break;
					}

					current = result.job;

					if (result.job.is_final) {
						setJob(null);
						setFinished(result.job);
						setFinishedCount((count) => count + 1);
						break;
					}

					setJob(result.job);

					// Another request (WP-Cron, or another tab) is doing this slice.
					if (result.busy) {
						await sleep(2500);
					}
				} catch (error) {
					// The last step of a restore replaces the database, and with it the session this
					// browser was signed in with. The restore itself has finished by then.
					if (current && 'restore' === current.kind && ['restoring', 'preparing'].includes(current.status)) {
						setSessionLost(true);
						setJob(null);
						break;
					}

					if (++failures >= 4) {
						notify('error', errorMessage(error));
						break;
					}

					await sleep(4000);
				}
			}

			running.current = false;
		})();
	}, []);

	useEffect(() => {
		mounted.current = true;
		kick();

		return () => {
			mounted.current = false;
		};
	}, [kick]);

	return (
		<JobContext.Provider value={{ job, finished, finishedCount, sessionLost, kick, dismiss: () => setFinished(null) }}>{children}</JobContext.Provider>
	);
};

export const useJob = (): JobState => {
	const context = useContext(JobContext);

	if (!context) {
		throw new Error('useJob must be used within a JobProvider');
	}

	return context;
};
