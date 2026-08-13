import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { useLocation } from 'react-router-dom';
import {
	ContainerComponent,
	NavigatorHeaderComponent,
	TabsComponent,
} from '@zyra/components';
import { useRunScan } from '../../services/useRunScan';
import OverviewTab from './OverviewTab';
import WooCommerceTab from './WooCommerceTab';

const TAB_IDS = ['overview', 'woocommerce'] as const;

/**
 * "Sell More" (WP menu slug `woocommerce`) — a tab shell over two views:
 * the mockup's new Overview (OverviewTab.tsx) and today's real
 * category-'woocommerce' findings scanner + Pro panels (WooCommerceTab.tsx,
 * kept rather than replaced — same "keep the real page, add the new
 * mockup alongside it" move `GEO.tsx`/`Content.tsx`/`Performance.tsx`/
 * `Security.tsx` made for their own Overview splits). Only two tabs here
 * (not three or four like those pages) — there's no second old
 * standalone page to fold in this time, since "WooCommerce" was never a
 * separate page from "Sell More", just this same route gaining tabs.
 * Same `subtab` deep-link convention as every other tab shell
 * (`?page=vulopilot#&tab=woocommerce&subtab=<inner-tab>`).
 */
const WooCommerce = () => {
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
	// Scoped to this page's own 'woocommerce' category — same "local tab"
	// scoping every other category page's header "Run scan" button uses.
	const { runScanButton } = useRunScan({ categories: ['woocommerce'] });

	const goToWooCommerceTab = () => setActiveTab('woocommerce');

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="cart"
				headerTitle={__('Sell More', 'vulopilot')}
				headerDescription={__(
					'AI-powered WooCommerce intelligence to help you increase sales and grow revenue.',
					'vulopilot'
				)}
				buttons={[runScanButton]}
			/>
			<ContainerComponent general>
				<TabsComponent
					className="sell-more-tabs"
					activeIndex={TAB_IDS.indexOf(activeTab)}
					onTabChange={(index) => setActiveTab(TAB_IDS[index])}
					tabs={[
						{
							label: __('Overview', 'vulopilot'),
							content: (
								<OverviewTab
									onNavigateToWooCommerceTab={goToWooCommerceTab}
								/>
							),
						},
						{
							label: __('WooCommerce', 'vulopilot'),
							content: <WooCommerceTab />,
						},
					]}
				/>
			</ContainerComponent>
		</>
	);
};

export default WooCommerce;
