import { __ } from '@wordpress/i18n';
import { NavigatorHeaderComponent } from '@zyra/components';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import SecurityTab from './SecurityTab';

/**
 * "Security" (WP menu slug `security`) — used to be a tab shell over
 * Security/Site Health/Backups (this page's own former name, "Protect My
 * Site"). Site Health and Backups were promoted to their own standalone
 * top-level page (`pages/SiteHealth/SiteHealth.tsx`, WP menu slug
 * `site-health`) per direct instruction; this page now renders SecurityTab
 * directly, no tab bar, same "drop the tab bar down to one real section"
 * treatment `pages/Commerce/Commerce.tsx` already established.
 *
 * `BackupProtectionNotice` (the "Backup protection: Enabled/Not enabled"
 * status line that used to sit above this page's own 3-tab bar) moved with
 * Backups to the new Site Health page — see that page's own docblock.
 *
 * See SecurityTab.tsx's own docblock for the full history of what used to
 * live on this page's other, now-removed tabs (Performance, Files &
 * Plugins, Accessibility) and where each real section actually landed.
 */
const Security = () => {
	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="security"
				headerTitle={__('Security', 'vulopilot')}
				headerDescription={__(
					'AI continuously protects your website from threats and vulnerabilities.',
					'vulopilot'
				)}
				headerCustomContent={
					<RunScanHeaderExtra
						categories={['security']}
						settingsSubtab="security-scanning"
					/>
				}
			/>
			<ContainerComponent general>
				<SecurityTab />
			</ContainerComponent>
		</>
	);
};

export default Security;
