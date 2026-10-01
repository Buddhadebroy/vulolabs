/* global vulopilotAppLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation, Link } from 'react-router-dom';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { NavigatorComponent, NoticeManager } from '@zyra/components';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import OverviewTab from './OverviewTab';
import SlowPagesTab from './SlowPagesTab';

const TAB_IDS = ['overview', 'slow-pages'] as const;

const TAB_META: Record<
	(typeof TAB_IDS)[number],
	{ headerTitle: string; headerIcon: string }
> = {
	overview: { headerTitle: __('Overview', 'vulopilot'), headerIcon: 'bar-chart' },
	'slow-pages': { headerTitle: __('Slow Pages', 'vulopilot'), headerIcon: 'clock' },
};

/**
 * "Performance" (WP menu slug `performance`) - Overview (OverviewTab.tsx) and a real "Slow Pages"
 * tab (SlowPagesTab.tsx, a real per-page speed report - PageSpeedRepository, populated in the
 * background by Services\PageSpeedScanner).
 */
const Performance = () => {
	const subtab = new URLSearchParams(useLocation().hash.substring(1)).get(
		'subtab'
	);
	const initialTab = (
		subtab && (TAB_IDS as readonly string[]).includes(subtab)
			? subtab
			: 'overview'
	) as (typeof TAB_IDS)[number];

	const [activeTab, setActiveTab] = useState<(typeof TAB_IDS)[number]>(
		initialTab
	);
	const goToSlowPages = () => setActiveTab('slow-pages');

	const [isSlowPagesScanning, setIsSlowPagesScanning] = useState(false);

	// The real per-page speed scan (`POST /page-speed`, PageSpeedScanner).
	const handleSlowPagesScan = () => {
		setIsSlowPagesScanning(true);

		sendApiResponse(vulopilotAppLocalizer, getApiLink(vulopilotAppLocalizer, 'page-speed'), {})
			.then((response) => {
				NoticeManager.add({
					uniqueKey: 'vulopilot-slow-pages-scan',
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __(
								'Scan started - results will appear here shortly.',
								'vulopilot'
							)
						: __(
								'Could not start the scan. Please try again.',
								'vulopilot'
							),
				});
			})
			.then(() => window.dispatchEvent(new Event('vulopilot_page_speed_scan_started')))
			.finally(() => setIsSlowPagesScanning(false));
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
			case 'overview':
				return <OverviewTab onNavigateToSlowPages={goToSlowPages} />;
			case 'slow-pages':
				return <SlowPagesTab />;
			default:
				return <div></div>;
		}
	};

	return (
		<>
			<NavigatorComponent
				headerIcon="bar-chart"
				headerTitle={__('Performance', 'vulopilot')}
				// headerDescription={__( 'Make your website faster and deliver a better experience
				// to your visitors.', 'vulopilot' )}
				headerCustomContent={
					'slow-pages' === activeTab ? (
						<RunScanHeaderExtra
							settingsSubtab="performance"
							hideRunScanButton
							replaceRunScanButton={{
								text: isSlowPagesScanning
									? __('Scanning…', 'vulopilot')
									: __('Scan Again', 'vulopilot'),
								icon: 'refresh',
								onClick: handleSlowPagesScan,
							}}
						/>
					) : (
						<RunScanHeaderExtra
							categories={['performance']}
							settingsSubtab="performance"
							label={__('Run Speed Test', 'vulopilot')}
						/>
					)
				}
				className="tabs"
				settingContent={settingContent}
				currentSetting={activeTab}
				getForm={getForm}
				prepareUrl={(subTab: string) =>
					`?page=vulopilot#&tab=performance&subtab=${subTab}`
				}
				Link={Link}
				settingName="Performance"
				menuIcon
			/>
		</>
	);
};

export default Performance;
