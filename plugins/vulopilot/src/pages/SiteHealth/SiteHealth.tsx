import { useRef, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation, Link } from 'react-router-dom';
import { NavigatorComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import SiteHealthTab from '../Security/SiteHealthTab';
import BackupsTab, { BackupsTabHandle } from '../Security/BackupsTab';

const TAB_IDS = ['site-health', 'backups'] as const;

const TAB_META: Record<
	(typeof TAB_IDS)[number],
	{ headerTitle: string; headerIcon: string }
> = {
	'site-health': { headerTitle: __('Site Health', 'vulopilot'), headerIcon: 'active' },
	backups: { headerTitle: __('Backups', 'vulopilot'), headerIcon: 'error' },
};

/**
 * "Site Health" (WP menu slug `site-health`) - promoted out of the former "Protect My Site" page's
 * own 3-tab shell (Security.tsx).
 */
const SiteHealth = () => {
	const location = useLocation();
	const subtab = new URLSearchParams(location.hash.substring(1)).get(
		'subtab'
	);
	const initialTab = (
		subtab && (TAB_IDS as readonly string[]).includes(subtab)
			? subtab
			: 'site-health'
	) as (typeof TAB_IDS)[number];

	const [activeTab, setActiveTab] = useState<(typeof TAB_IDS)[number]>(
		initialTab
	);

	// "Create Backup Now" lives in the page header's own "Run scan" slot while the Backups tab is
	// active.
	const backupsTabRef = useRef<BackupsTabHandle>(null);
	const [isCreatingBackup, setIsCreatingBackup] = useState(false);

	const prepareUrl = (subTab: string) =>
		`?page=vulopilot#&tab=site-health&subtab=${subTab}`;

	const goToBackups = () => {
		setActiveTab('backups');
		window.history.pushState(null, '', prepareUrl('backups'));
	};

	// A real tab-pill click doesn't go through react-router at all.
	const handleNavigate = (url: string) => {
		window.history.pushState(null, '', url);

		const hashIndex = url.indexOf('#');
		const nextSubtab = new URLSearchParams(
			hashIndex >= 0 ? url.slice(hashIndex + 1) : ''
		).get('subtab');

		if (nextSubtab && (TAB_IDS as readonly string[]).includes(nextSubtab)) {
			setActiveTab(nextSubtab as (typeof TAB_IDS)[number]);
		}
	};

	const settingContent = TAB_IDS.map((tabId) => ({
		type: 'file' as const,
		content: {
			id: tabId,
			headerTitle: TAB_META[tabId].headerTitle,
			headerIcon: TAB_META[tabId].headerIcon,
			hideSettingHeader: true,
		},
	}));

	const getForm = (tabId: string) => {
		switch (tabId) {
			case 'site-health':
				return <SiteHealthTab onNavigateToBackups={goToBackups} />;
			case 'backups':
				return (
					<BackupsTab
						ref={backupsTabRef}
						onCreatingChange={setIsCreatingBackup}
					/>
				);
			default:
				return <div></div>;
		}
	};

	return (
		<NavigatorComponent
			headerIcon="active"
			headerTitle={__('Site Health', 'vulopilot')}
			headerCustomContent={
				'backups' === activeTab ? (
					// "Create Backup Now" replaces "Run scan" entirely while the Backups tab is
					// active.
					<ButtonInput
						buttons={{
							text: isCreatingBackup
								? __('Starting…', 'vulopilot')
								: __('Create Backup Now', 'vulopilot'),
							icon: isCreatingBackup ? 'update' : 'cloud-upload',
							color: 'purple-bg',
							disabled: isCreatingBackup,
							onClick: () => backupsTabRef.current?.createBackup(),
						}}
					/>
				) : (
					// Real category ids of every scanner SiteHealthTab.tsx's own SECTIONS cover
					// (wordpress-health/updates/cron/ database/server-health/php-warnings).
					<RunScanHeaderExtra
						categories={[
							'wordpress',
							'updates',
							'cron',
							'database',
							'server',
							'php-warnings',
						]}
						label={__('Run Site Health Scan', 'vulopilot')}
						// None of these 6 scanners has a Settings tab of its own to point the gear
						// at (all always-on, no per-scanner toggle).
						settingsSubtab="general"
						hideSettingsButton
					/>
				)
			}
			className="site-health-tabs"
			settingContent={settingContent}
			currentSetting={activeTab}
			getForm={getForm}
			prepareUrl={prepareUrl}
			onNavigate={handleNavigate}
			Link={Link}
			settingName="Site Health"
			menuIcon
		/>
	);
};

export default SiteHealth;
