declare global {
	/**
	 * Shape of the `vulobackupAppLocalizer` object localized by FrontendScripts::localize_scripts().
	 */
	interface VuloBackupLocalizer {
		apiUrl: string;
		restUrl: string;
		nonce: string;
		plugin_url: string;
		admin_url: string;
		site_url: string;
		version: string;
		plugin_slug: string;
		text_domain: string;
		/** The parts of the site that exist here and can be backed up. */
		areas: string[];
		/** Largest piece of an imported backup the server accepts in one request. */
		chunk_bytes: number;
		active_plugins: string[];
		khali_dabba: boolean;
		active_modules: string[];
	}

	var vulobackupAppLocalizer: VuloBackupLocalizer;
}

export {};
