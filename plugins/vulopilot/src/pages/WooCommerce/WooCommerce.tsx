import { __ } from '@wordpress/i18n';
import { ContainerComponent, NavigatorHeaderComponent } from '@zyra/components';
import { useRunScan } from '../../services/useRunScan';
import WooCommerceTab from './WooCommerceTab';

/**
 * "Sell More" (WP menu slug `woocommerce`) — used to be a tab shell over
 * two views (a mockup "Overview" tab plus this real category-'woocommerce'
 * findings scanner + Pro panels view). The Overview tab (and its
 * exclusively-Overview-only sub-components — AiInsightBanner.tsx,
 * WooCommerceMetricsGrid.tsx, TopSellingProductsCard.tsx,
 * AbandonedCartCard.tsx, ProTipBanner.tsx) has been removed: this route
 * now renders WooCommerceTab directly, no tab bar, so "Sell More" shows
 * that real data immediately rather than requiring a second click.
 */
const WooCommerce = () => {
	// Scoped to this page's own 'woocommerce' category — same "local tab"
	// scoping every other category page's header "Run scan" button uses.
	const { runScanButton } = useRunScan({ categories: ['woocommerce'] });

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
				<WooCommerceTab />
			</ContainerComponent>
		</>
	);
};

export default WooCommerce;
