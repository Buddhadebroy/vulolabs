/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { NoticeComponent } from '@zyra/components';

/** `?page=vulopilot#&tab=security&subtab=backups` — Protect My Site's own Backups tab (BackupsTab.tsx), the real backup-management surface this notice links to. */
const BACKUPS_TAB_URL = '?page=vulopilot#&tab=security&subtab=backups';

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
 */
const BackupProtectionNotice = () => {
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
			type={isEnabled ? 'success' : 'info'}
			displayPosition="inline-notice"
			message={
				isEnabled
					? __('Backup protection: Enabled', 'vulopilot')
					: __('Backup protection: Not enabled', 'vulopilot')
			}
			actionLabel={__('View Backups', 'vulopilot')}
			onAction={() => {
				window.location.href = BACKUPS_TAB_URL;
				window.location.reload();
			}}
		/>
	);
};

export default BackupProtectionNotice;
