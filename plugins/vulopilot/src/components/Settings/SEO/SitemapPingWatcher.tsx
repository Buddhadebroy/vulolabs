import { useEffect, useRef } from 'react';
import { __ } from '@wordpress/i18n';
import { NoticeManager } from '@zyra/components';
import { useSetting } from '../../../contexts/SettingContext';

/**
 * Sitemap tab's own invisible watcher - fires a 2nd float notice, on top
 * of InputRenderer's own existing generic "Settings saved" float toast
 * (see that component's `sendApiResponse().then()` - it already reads
 * the update-settings response's own `message` field and floats it), the
 * moment "Enable sitemap" (`sitemap_enabled`) transitions off→on.
 *
 * NOT wired via Sitemap.ts's own `settingAction` - that only ever renders
 * through NavigatorComponent's `renderSettingHeaderInfo()`, which
 * `return`s `null` outright whenever `hideSettingHeader` is true (see
 * that component's own source), which Sitemap.ts (like every other
 * GetStarted sub-tab) sets. Mounted instead the same way
 * BackupStoragePanel.tsx is for the Backups tab: Settings.tsx's own
 * `GetForm()` appends it unconditionally right after `InputRenderer`,
 * keyed on `currentTab === 'sitemap'` - see that file's own docblock.
 *
 * Replaces the old separate "Ping search engines on update"
 * (`sitemap_ping_search_engines`) toggle, folded into `sitemap_enabled`
 * alone per direct instruction - SitemapManager.php's own
 * `maybe_ping_search_engines()` now gates on `sitemap_enabled` alone too.
 *
 * Worded as "created", not "sent" - this only confirms the sitemap (and
 * therefore something for search engines to be pointed at) now exists;
 * the real ping to Bing only ever fires later, asynchronously, on the
 * next `save_post` (see SitemapManager.php's docblock), so this doesn't
 * claim a ping happened right now.
 */
const SitemapPingWatcher = () => {
	const { setting } = useSetting();
	const previousEnabled = useRef<boolean | null>(null);

	useEffect(() => {
		const isEnabled =
			Array.isArray(setting.sitemap_enabled) &&
			setting.sitemap_enabled.length > 0;

		if (
			previousEnabled.current === false &&
			isEnabled === true
		) {
			NoticeManager.add({
				uniqueKey: 'vulopilot-sitemap-enabled',
				type: 'success',
				position: 'float',
				message: __(
					'Successfully created search engine notification',
					'vulopilot'
				),
			});
		}

		previousEnabled.current = isEnabled;
	}, [setting.sitemap_enabled]);

	return null;
};

export default SitemapPingWatcher;
