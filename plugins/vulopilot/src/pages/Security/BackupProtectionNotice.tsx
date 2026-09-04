/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { NoticeComponent } from '@zyra/components';

/** `?page=vulopilot#&tab=site-health&subtab=backups` — Site Health's own real "Backups" tab (BackupsTab.tsx) this notice links to when it's not already rendered there itself (see `onNavigateToBackups`). */
const BACKUPS_TAB_URL = '?page=vulopilot#&tab=site-health&subtab=backups';

/**
 * "Backup protection: Enabled/Not enabled" — a single real status line with
 * a link, not a duplicate feature card, per direct instruction: this tab
 * used to also carry a full "Backups" tile (SecurityMetricsGrid.tsx, real
 * data, its own "View" button) alongside the real Backups tab
 * (BackupsTab.tsx) and Settings → Scanning → Backups' own configuration —
 * three places showing/controlling the same thing. The tile was removed
 * earlier this session; this notice is this tab's own honest replacement
 * for "is backup protection even on," scoped to exactly one fact rather
 * than re-adding a scanner-badge/last-scan-time card.
 *
 * Reads the real `enable_automatic_backups` setting (`GET /settings`,
 * Settings/Scanning/Backups.ts's own checkbox — a checkbox-*group* field,
 * so its stored value is an array, `[]` when off per Utill.php's own
 * default, not a plain boolean) rather than inferring "protected" from
 * whether a backup has ever actually run — that's Backups tab's own job
 * (real row list), not this one-line summary's.
 *
 * `uniqueKey` on the `NoticeComponent` below is required, not decorative:
 * a `displayPosition="notice"` NoticeComponent doesn't render inline — it
 * calls zyra's own `NoticeManager.add()` once on mount and lets a separate,
 * globally-mounted receiver render it (confirmed reading zyra's source),
 * with `'lifetime'` validity (no auto-expiry) for this non-`'float'`
 * position. `NoticeManager.add()` only dedupes an entry against one
 * already in its queue with the exact same `uniqueKey`; without one, it
 * defaults to `Date.now().toString()` per mount, so remounting this
 * component (e.g. navigating away from Site Health and back) pushed a
 * second, differently-keyed, equally-non-expiring entry instead of
 * replacing the first — the real cause of the notice visibly doubling.
 */
interface BackupProtectionNoticeProps {
	/**
	 * Switches this same page's own real "Backups" tab in place instead of
	 * navigating — passed only by SiteHealth.tsx, the one real page that
	 * now has that tab itself. Omit to navigate to `BACKUPS_TAB_URL`
	 * instead (a full page load), the only real option for every other
	 * caller (Security.tsx/SecurityTab.tsx), which don't have a "Backups"
	 * tab of their own to switch to.
	 */
	onNavigateToBackups?: () => void;
}

const BackupProtectionNotice = ({
	onNavigateToBackups,
}: BackupProtectionNoticeProps = {}) => {
	const [isEnabled, setIsEnabled] = useState<boolean | null>(null);

	useEffect(() => {
		getApiResponse<{ enable_automatic_backups?: string[] }>(
			getApiLink(appLocalizer, 'settings'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		).then((response) => {
			if (response) {
				setIsEnabled(
					Array.isArray(response.enable_automatic_backups) &&
						response.enable_automatic_backups.length > 0
				);
			}
		});
	}, []);

	if (null === isEnabled) {
		return null;
	}

	return (
		<NoticeComponent
			uniqueKey="backup-protection-notice"
			type={isEnabled ? 'success' : 'info'}
			displayPosition="inline-notice"
			message={
				isEnabled
					? __('Backup protection: Enabled', 'vulopilot')
					: __('Backup protection: Not enabled', 'vulopilot')
			}
			actionLabel={__('View Backups', 'vulopilot')}
			onAction={
				onNavigateToBackups ??
				(() => {
					window.location.href = BACKUPS_TAB_URL;
					window.location.reload();
				})
			}
		/>
	);
};

export default BackupProtectionNotice;
