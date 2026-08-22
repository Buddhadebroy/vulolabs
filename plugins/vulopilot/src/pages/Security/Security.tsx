import { __ } from '@wordpress/i18n';
import { NavigatorHeaderComponent, ContainerComponent } from '@zyra/components';
import { useRunScan } from '../../services/useRunScan';
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
	// Scoped to this page's own real category — same "local tab" scoping
	// every other category page's header "Run scan" button uses.
	const { runScanButton } = useRunScan({ categories: ['security'] });

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="security"
				headerTitle={__('Security', 'vulopilot')}
				headerDescription={__(
					'AI continuously protects your website from threats and vulnerabilities.',
					'vulopilot'
				)}
				buttons={[runScanButton]}
			/>
			<ContainerComponent general>
				<SecurityTab />
			</ContainerComponent>
		</>
	);
};

export default Security;
