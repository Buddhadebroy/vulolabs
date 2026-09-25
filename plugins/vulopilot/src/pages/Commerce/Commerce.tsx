/* global vulopilotAppLocalizer */
import { useState } from 'react';
import type { ComponentType } from 'react';
import { __ } from '@wordpress/i18n';
import { addFilter } from '@wordpress/hooks';
import { ContainerComponent, NavigatorHeaderComponent, PopupComponent } from '@zyra/components';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import ShowProPopup from '../../components/Popup/Popup';
import { useFilterSlot } from '../../services/useFilterSlot';
import CommerceIssuesTable from './CommerceIssuesTable';
import AiSalesAssistantCard from './AiSalesAssistantCard';
import AiSalesOptimizerCard from './AiSalesOptimizerCard';
import CommerceProDummies from './CommerceProDummies';
import BannerCard from '../../components/BannerCard';
import './Commerce.scss';

const COMMERCE_MODULE_ID = 'woocommerce-analytics';

/**
 * Runs once, unconditionally, at this module's own top-level scope - this
 * file (Commerce.tsx) is this route's own entry point, itself always
 * eagerly imported by routes.ts - so these 3 registrations exist on every
 * VuloPilot admin page load, not just while the Commerce tab is actually
 * open.
 */
addFilter(
	'vulopilot_commerce_issues_table',
	'vulopilot/commerce',
	() => CommerceIssuesTable
);

addFilter(
	'vulopilot_commerce_ai_sales_assistant',
	'vulopilot/commerce',
	() => AiSalesAssistantCard
);

addFilter(
	'vulopilot_commerce_ai_sales_optimizer',
	'vulopilot/commerce',
	() => AiSalesOptimizerCard
);

addFilter('vulopilot_banner_card', 'vulopilot/commerce', () => BannerCard);

/**
 * Was previously its own CommercePanel.tsx file, imported only here -
 * merged into this route's own entry point (its one real consumer), same
 * "single-consumer wrapper" cleanup already applied to
 * pages/Content/OverviewTab.tsx and pages/AIAssistant/ChatTab.tsx.
 */
const CommercePanel = ({
	RealPanel,
	onLockedClick,
}: {
	RealPanel: ComponentType | null;
	onLockedClick: () => void;
}) => {
	if (RealPanel) {
		return <RealPanel />;
	}

	return <CommerceProDummies onClick={onLockedClick} />;
};

const Commerce = () => {
	const RealPanel = useFilterSlot('vulopilot_commerce_panel');
	const isProInstalled = Boolean(vulopilotAppLocalizer.khali_dabba);
	const [isPopupOpen, setIsPopupOpen] = useState(false);
	const isUnlocked = Boolean(RealPanel);

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="cart"
				headerTitle={__('Commerce', 'vulopilot')}
				headerDescription={__(
					'AI-powered WooCommerce intelligence to help you increase sales and grow revenue.',
					'vulopilot'
				)}
				headerCustomContent={
					isUnlocked ? (
						<RunScanHeaderExtra
							categories={['woocommerce']}
							settingsSubtab="woocommerce"
						/>
					) : (
						<RunScanHeaderExtra
							categories={['woocommerce']}
							settingsSubtab="woocommerce"
							hideSettingsButton
							hideRunScanButton
							replaceRunScanButton={{
								text: __('Run scan', 'vulopilot'),
								icon: 'search',
								onClick: () => setIsPopupOpen(true),
							}}
						/>
					)
				}
			/>
			<ContainerComponent general>
				<CommercePanel
					RealPanel={RealPanel}
					onLockedClick={() => setIsPopupOpen(true)}
				/>
			</ContainerComponent>
			<PopupComponent
				open={isPopupOpen}
				onClose={() => setIsPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{isProInstalled ? (
					<ShowProPopup moduleName={COMMERCE_MODULE_ID} />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</>
	);
};

export default Commerce;
