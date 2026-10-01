import { __ } from '@wordpress/i18n';
import { ContainerComponent, NavigatorHeaderComponent } from '@zyra/components';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import SecurityTab from './SecurityTab';

/**
 * "Security" (WP menu slug `security`) - used to be a tab shell over Security/Site Health/Backups
 * (this page's own former name, "Protect My Site").
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
						label={__('Run Security Scan', 'vulopilot')}
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
