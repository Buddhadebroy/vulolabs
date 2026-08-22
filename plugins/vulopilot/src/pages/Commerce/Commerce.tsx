import { __ } from '@wordpress/i18n';
import { ContainerComponent, NavigatorHeaderComponent } from '@zyra/components';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import CommerceTab from './CommerceTab';

/**
 * "Commerce" (WP menu slug `commerce`) — used to be a tab shell over
 * two views (a mockup "Overview" tab plus this real category-'woocommerce'
 * findings scanner + Pro panels view). The Overview tab (and its
 * exclusively-Overview-only sub-components — AiInsightBanner.tsx,
 * WooCommerceMetricsGrid.tsx, TopSellingProductsCard.tsx,
 * AbandonedCartCard.tsx, ProTipBanner.tsx) has been removed: this route
 * now renders CommerceTab directly, no tab bar, so "Commerce" shows
 * that real data immediately rather than requiring a second click.
 */
const Commerce = () => {
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
					<RunScanHeaderExtra
						categories={['woocommerce']}
						settingsSubtab="woocommerce"
					/>
				}
			/>
			<ContainerComponent general>
				<CommerceTab />
			</ContainerComponent>
		</>
	);
};

export default Commerce;
