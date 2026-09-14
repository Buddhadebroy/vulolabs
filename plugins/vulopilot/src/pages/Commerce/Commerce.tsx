import { __ } from '@wordpress/i18n';
import { ContainerComponent, NavigatorHeaderComponent } from '@zyra/components';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import CommercePanel from './CommercePanel';

/**
 * "Commerce" (WP menu slug `commerce`) — used to be a tab shell over
 * two views (a mockup "Overview" tab plus this real category-'woocommerce'
 * findings scanner + Pro panels view). The Overview tab (and its
 * exclusively-Overview-only sub-components — AiInsightBanner.tsx,
 * WooCommerceMetricsGrid.tsx, TopSellingProductsCard.tsx,
 * AbandonedCartCard.tsx, ProTipBanner.tsx) has been removed: this route
 * now renders its real body directly, no tab bar, so "Commerce" shows
 * that content immediately rather than requiring a second click.
 *
 * The header here (and the menu item itself — see Admin.php's own
 * `commerce` submenu, gated on `class_exists('WooCommerce')`) is
 * unconditional; only the body (`CommercePanel`) is Pro-then-module
 * gated — see that file's own docblock for the real "the whole Commerce
 * tab moved to Pro" story.
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
				<CommercePanel />
			</ContainerComponent>
		</>
	);
};

export default Commerce;
