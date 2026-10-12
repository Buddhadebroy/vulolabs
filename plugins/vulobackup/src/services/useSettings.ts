import { useCallback, useEffect, useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { apiGet, apiPost } from './api';
import { errorMessage, notify } from './notify';

/** The stored settings, plus the read-only context the REST API sends with them. */
export interface Stored {
	areas: string[];
	include_wp_config: boolean;
	exclude_patterns: string;
	max_file_size_mb: number;
	db_scope: string;
	schedule_files: string;
	schedule_database: string;
	schedule_hour: number;
	schedule_weekday: number;
	schedule_monthday: number;
	retention_count: number;
	retention_remote_count: number;
	keep_local_copy: boolean;
	safety_backup: boolean;
	encrypt: boolean;
	part_size_mb: number;
	step_seconds: number;
	backup_dir: string;
	notify_failure: boolean;
	notify_email: string;
	log_retention_days: number;
	keep_data_uninstall: string;
	encryption_available: boolean;
	encryption_has_password: boolean;
	backup_dir_in_use: string;
	backup_dir_default: string;
	backup_dir_public: boolean;
	default_exclusions: string[];
	admin_email: string;
}

/**
 * Loads the settings and saves each change a moment after it is made, the way the other VuloLabs
 * settings screens do: there is no Save button.
 */
export const useSettings = () => {
	const [values, setValues] = useState<Stored | null>(null);
	const [error, setError] = useState('');
	const pending = useRef<Partial<Stored>>({});
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const load = useCallback(() => {
		apiGet<Stored>('settings')
			.then(setValues)
			.catch((e) => setError(errorMessage(e)));
	}, []);

	const flush = useCallback(() => {
		const patch = pending.current;

		pending.current = {};
		timer.current = null;

		if (0 === Object.keys(patch).length) {
			return;
		}

		apiPost<Stored>('settings', patch)
			.then((saved) => {
				// What the server made of it (a trimmed path, a number within its limits), unless more
				// has been typed in the meantime.
				if (0 === Object.keys(pending.current).length) {
					setValues(saved);
				}

				notify('success', __('Settings saved.', 'vulobackup'), 'vulobackup-settings');
			})
			.catch((e) => {
				notify('error', errorMessage(e), 'vulobackup-settings');
				load();
			});
	}, [load]);

	useEffect(() => {
		load();

		// A change made just before leaving the screen is still saved.
		return () => {
			if (timer.current) {
				clearTimeout(timer.current);
				flush();
			}
		};
	}, [load, flush]);

	const set = useCallback(
		(patch: Partial<Stored>) => {
			setValues((current) => (current ? { ...current, ...patch } : current));
			pending.current = { ...pending.current, ...patch };

			if (timer.current) {
				clearTimeout(timer.current);
			}

			timer.current = setTimeout(flush, 800);
		},
		[flush]
	);

	return { values, error, set, reload: load, replace: setValues };
};
