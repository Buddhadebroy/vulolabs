import { __ } from '@wordpress/i18n';

export interface Copy {
	id: string;
	name: string;
	where: string;
	status: 'uploading' | 'uploaded' | 'failed' | 'deleted';
	error: string;
}

export interface LogLine {
	time: string;
	time_display: string;
	level: 'info' | 'warning' | 'error';
	message: string;
	event?: string;
}

/** A backup or restore as the REST API returns it (Rest\Controller::view()). */
export interface Job {
	id: string;
	kind: 'backup' | 'restore';
	name: string;
	status: string;
	percent: number;
	label: string;
	error: string;
	warnings: string[];
	created_at: string;
	created_at_display: string;
	finished_at_display: string;
	is_final: boolean;
	// Backups.
	type?: 'full' | 'database' | 'files';
	trigger?: string;
	areas?: string[];
	size_display?: string;
	encrypted?: boolean;
	local?: boolean;
	copies?: Copy[];
	verified?: boolean;
	verified_at_display?: string;
	verify_problems?: string[];
	from_site?: string;
	made_at_display?: string;
	can_restore?: boolean;
	can_download?: boolean;
	// Restores.
	backup_id?: string;
	changed?: 'nothing' | 'partial' | 'all';
	result?: { tables?: number; rows?: number; files?: number; areas?: string[]; notes?: string[] };
	migrated?: { from?: string; to?: string; changed?: number; skipped?: number };
	safety_id?: string;
	[key: string]: unknown;
}

export interface Destination {
	id: string;
	provider: string;
	label: string;
	name: string;
	enabled: boolean;
	config: Record<string, string | number | boolean>;
	has_secret: Record<string, boolean>;
	where: string;
	fingerprint: string;
	checked_at: string;
	ok: boolean;
	message: string;
}

export interface ProviderField {
	key: string;
	label: string;
	type: 'text' | 'number' | 'password' | 'textarea' | 'toggle';
	secret?: boolean;
	required?: boolean;
	placeholder?: string;
	help?: string;
	default?: string | number | boolean;
}

export interface ProviderDefinition {
	id: string;
	label: string;
	fields: ProviderField[];
}

export const AREA_LABELS: Record<string, { name: string; desc: string }> = {
	plugins: { name: __('Plugins', 'vulobackup'), desc: __('Every plugin installed on the site.', 'vulobackup') },
	themes: { name: __('Themes', 'vulobackup'), desc: __('Every theme installed on the site.', 'vulobackup') },
	uploads: { name: __('Uploads', 'vulobackup'), desc: __('The media library: images, documents and other uploaded files.', 'vulobackup') },
	'mu-plugins': { name: __('Must-use plugins', 'vulobackup'), desc: __('Plugins in wp-content/mu-plugins, often added by a host.', 'vulobackup') },
	others: { name: __('Other wp-content files', 'vulobackup'), desc: __('Everything else in wp-content, such as languages and files plugins keep there.', 'vulobackup') },
	core: { name: __('WordPress itself', 'vulobackup'), desc: __('wp-admin, wp-includes and the files beside them. WordPress can always be downloaded again, so this is optional.', 'vulobackup') },
};

export const TYPE_LABELS: Record<string, string> = {
	full: __('Full', 'vulobackup'),
	database: __('Database', 'vulobackup'),
	files: __('Files', 'vulobackup'),
};

export const TRIGGER_LABELS: Record<string, string> = {
	manual: __('Started by hand', 'vulobackup'),
	schedule: __('Scheduled', 'vulobackup'),
	safety: __('Safety backup before a restore', 'vulobackup'),
	import: __('Imported', 'vulobackup'),
};

/** What a job's status means, and the badge colour that goes with it. */
export const STATUS: Record<string, { text: string; color: string }> = {
	queued: { text: __('Waiting to start', 'vulobackup'), color: 'blue' },
	preparing: { text: __('Preparing', 'vulobackup'), color: 'blue' },
	backing_up: { text: __('Backing up', 'vulobackup'), color: 'blue' },
	verifying: { text: __('Verifying', 'vulobackup'), color: 'blue' },
	uploading: { text: __('Uploading', 'vulobackup'), color: 'blue' },
	safety_backup: { text: __('Making a safety backup', 'vulobackup'), color: 'blue' },
	restoring: { text: __('Restoring', 'vulobackup'), color: 'blue' },
	completed: { text: __('Completed', 'vulobackup'), color: 'green' },
	failed: { text: __('Failed', 'vulobackup'), color: 'red' },
	cancelled: { text: __('Cancelled', 'vulobackup'), color: 'yellow' },
};
