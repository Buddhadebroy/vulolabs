/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import axios from 'axios';
import { CardComponent } from '@zyra/components';
import { useStoreReadiness } from '../../services/useStoreReadiness';
import { useSectionStatus } from '../../services/useSectionStatus';
import { sumGroupCounts } from './useWooCommerceFindingGroups';
import type { FindingGroup } from '../AIAssistant/issuesTypes';
import {
	PRODUCT_SCANNER_IDS,
	INVENTORY_SCANNER_IDS,
} from './WooCommerceTab.constants';

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * Real out-of-stock product count — `wc/v3/products?stock_status=outofstock`'s
 * own `X-WP-Total` header, same raw-axios technique
 * WooCommerceMetricsGrid.tsx's own `useWcTotalCount()` already
 * established (kept as its own small local copy rather than importing a
 * private hook across sibling files, same "duplicate small per-file
 * hooks" convention this whole page tree already uses).
 */
const useOutOfStockCount = (): number | null => {
	const [count, setCount] = useState<number | null>(null);

	useEffect(() => {
		let cancelled = false;

		axios
			.get(`${appLocalizer.apiUrl}/wc/v3/products`, {
				...nonceHeaders,
				params: { stock_status: 'outofstock', per_page: 1 },
			})
			.then((response) => {
				if (!cancelled) {
					const header = response.headers?.['x-wp-total'];
					setCount(header ? parseInt(header, 10) : null);
				}
			})
			.catch(() => {
				if (!cancelled) {
					setCount(null);
				}
			});

		return () => {
			cancelled = true;
		};
	}, []);

	return count;
};

interface WooCommerceCategoryGridProps {
	groups: FindingGroup[];
	isLoadingGroups: boolean;
	onReviewTab: (tab: 'products' | 'checkout' | 'store') => void;
}

/**
 * The 6 category cards — every number here is real, reconciling exactly
 * to the same `/findings/groups`/`/store-readiness` data
 * WooCommerceIssuesTable.tsx's own tab counts read (see
 * WooCommerceTab.constants.ts's bucket map). `groups` is fetched once by
 * WooCommerceTab.tsx (`useWooCommerceFindingGroups()`) and threaded down
 * here and to TopIssuesToWorkOn.tsx/WooCommerceIssuesTable.tsx, rather
 * than each component re-fetching the same real data independently.
 * "Store Automation" and "Compatibility" have no dedicated issues-table
 * tab (no mockup tab for them either) — Automation links straight to the
 * real Automate Work page; Compatibility's real findings still show up
 * under the table's "Store" tab alongside general store-setup issues.
 */
const WooCommerceCategoryGrid = ({
	groups,
	isLoadingGroups,
	onReviewTab,
}: WooCommerceCategoryGridProps) => {
	const { data: readiness, isLoading: isLoadingReadiness } =
		useStoreReadiness();
	const outOfStock = useOutOfStockCount();
	const runningLow = useSectionStatus('woocommerce', ['inventory-intelligence']);

	const isLoading = isLoadingGroups || isLoadingReadiness;

	const productsCount = sumGroupCounts(groups, PRODUCT_SCANNER_IDS);
	const inventoryFindingsCount = sumGroupCounts(groups, INVENTORY_SCANNER_IDS);
	const failedOrdersCount = sumGroupCounts(groups, ['woocommerce-failed-orders']);
	const onHoldCount = sumGroupCounts(groups, ['woocommerce-stale-onhold-orders']);
	const pendingTooLongCount = sumGroupCounts(groups, [
		'woocommerce-stale-pending-orders',
	]);
	const compatibilityCount = sumGroupCounts(groups, [
		'woocommerce-compatibility',
	]);
	const testModeOn = groups.some(
		(group) => 'woocommerce-checkout' === group.scanner_id && group.count > 0
	);

	return (
		<div className="woocommerce-category-grid">
			<CardComponent
				className="woocommerce-category-card"
				isLoading={isLoading}
			>
				<i className="woocommerce-category-icon adminfont-cash" />
				<div className="woocommerce-category-title">
					{__('Checkout & Payments', 'vulopilot')}
				</div>
				{failedOrdersCount > 0 && (
					<span className="admin-badge red">
						{__('Needs attention', 'vulopilot')}
					</span>
				)}
				<div className="woocommerce-category-rows">
					<div className="woocommerce-category-row">
						<span>{__('Payment methods', 'vulopilot')}</span>
						<span>
							{sprintf(
								/* translators: %d is the number of active payment methods. */
								__('%d active', 'vulopilot'),
								readiness?.payment_methods_active ?? 0
							)}
						</span>
					</div>
					<div className="woocommerce-category-row">
						<span>{__('Failed payments', 'vulopilot')}</span>
						<span className="value-warning">{failedOrdersCount}</span>
					</div>
					<div className="woocommerce-category-row">
						<span>{__('Test mode', 'vulopilot')}</span>
						<span className={testModeOn ? 'value-warning' : ''}>
							{testModeOn ? __('On', 'vulopilot') : __('Off', 'vulopilot')}
						</span>
					</div>
					<div className="woocommerce-category-row">
						<span>{__('Secure payments', 'vulopilot')}</span>
						<span className="value-good">
							<i className="adminfont-lock" />
							{readiness?.secure_checkout
								? __('Protected', 'vulopilot')
								: __('Not secured', 'vulopilot')}
						</span>
					</div>
				</div>
				<a
					className="woocommerce-category-link"
					role="button"
					tabIndex={0}
					onClick={() => onReviewTab('checkout')}
				>
					{__('Review checkout →', 'vulopilot')}
				</a>
			</CardComponent>

			<CardComponent
				className="woocommerce-category-card"
				isLoading={isLoading}
			>
				<i className="woocommerce-category-icon adminfont-cart" />
				<div className="woocommerce-category-title">
					{__('Products', 'vulopilot')}
				</div>
				{productsCount > 0 && (
					<span className="admin-badge red">
						{sprintf(
							/* translators: %d is the number of products needing attention. */
							__('%d need attention', 'vulopilot'),
							productsCount
						)}
					</span>
				)}
				<div className="desc">
					{__(
						'Missing prices, out-of-stock listings, missing images, and incomplete product info.',
						'vulopilot'
					)}
				</div>
				<a
					className="woocommerce-category-link"
					role="button"
					tabIndex={0}
					onClick={() => onReviewTab('products')}
				>
					{__('Review products →', 'vulopilot')}
				</a>
			</CardComponent>

			<CardComponent
				className="woocommerce-category-card"
				isLoading={isLoading}
			>
				<i className="woocommerce-category-icon adminfont-database" />
				<div className="woocommerce-category-title">
					{__('Inventory', 'vulopilot')}
				</div>
				{(inventoryFindingsCount > 0 || null !== outOfStock && outOfStock > 0) && (
					<span className="admin-badge red">
						{__('Needs attention', 'vulopilot')}
					</span>
				)}
				<div className="woocommerce-category-rows">
					<div className="woocommerce-category-row">
						<span>{__('Out of stock', 'vulopilot')}</span>
						<span className="value-warning">
							{null !== outOfStock ? outOfStock : '—'}
						</span>
					</div>
					<div className="woocommerce-category-row">
						<span>{__('Running low', 'vulopilot')}</span>
						<span className="value-warning">
							{inventoryFindingsCount}
						</span>
					</div>
					{runningLow.badge && (
						<div className="woocommerce-category-row">
							<span className="admin-badge purple">
								{__('PRO', 'vulopilot')}
							</span>
							<span>
								{sprintf(
									/* translators: %d is the number of products projected to run out of stock soon. */
									__('%d may run out soon', 'vulopilot'),
									inventoryFindingsCount
								)}
							</span>
						</div>
					)}
				</div>
				<a
					className="woocommerce-category-link"
					role="button"
					tabIndex={0}
					onClick={() => onReviewTab('products')}
				>
					{__('Review inventory →', 'vulopilot')}
				</a>
			</CardComponent>

			<CardComponent
				className="woocommerce-category-card"
				isLoading={isLoading}
			>
				<i className="woocommerce-category-icon adminfont-order" />
				<div className="woocommerce-category-title">
					{__('Orders', 'vulopilot')}
				</div>
				{failedOrdersCount + onHoldCount + pendingTooLongCount > 0 && (
					<span className="admin-badge orange">
						{sprintf(
							/* translators: %d is the number of orders needing attention. */
							__('%d need attention', 'vulopilot'),
							failedOrdersCount + onHoldCount + pendingTooLongCount
						)}
					</span>
				)}
				<div className="woocommerce-category-rows">
					<div className="woocommerce-category-row">
						<span>{__('Failed payments', 'vulopilot')}</span>
						<span className="value-warning">{failedOrdersCount}</span>
					</div>
					<div className="woocommerce-category-row">
						<span>{__('On hold', 'vulopilot')}</span>
						<span className="value-warning">{onHoldCount}</span>
					</div>
					<div className="woocommerce-category-row">
						<span>{__('Pending too long', 'vulopilot')}</span>
						<span className="value-warning">{pendingTooLongCount}</span>
					</div>
				</div>
				<a
					className="woocommerce-category-link"
					href={`${appLocalizer.site_url}/wp-admin/edit.php?post_type=shop_order`}
				>
					{__('View orders →', 'vulopilot')}
				</a>
			</CardComponent>

			<CardComponent
				className="woocommerce-category-card"
				isLoading={isLoading}
			>
				<i className="woocommerce-category-icon adminfont-automation" />
				<div className="woocommerce-category-title">
					{__('Store Automation', 'vulopilot')}
				</div>
				{(readiness?.automation_failed_count ?? 0) > 0 && (
					<span className="admin-badge red">
						{__('Needs attention', 'vulopilot')}
					</span>
				)}
				{(readiness?.automation_failed_count ?? 0) > 0 && (
					<div className="woocommerce-category-highlight">
						{sprintf(
							/* translators: %d is the number of failed automation runs. */
							__('%d automatic tasks failed', 'vulopilot'),
							readiness?.automation_failed_count ?? 0
						)}
					</div>
				)}
				<div className="desc">
					{__(
						'Automation rules for orders, emails, and store events that failed to run in the last 30 days.',
						'vulopilot'
					)}
				</div>
				<a
					className="woocommerce-category-link"
					href={`${appLocalizer.admin_url}#&tab=automation`}
				>
					{__('Review tasks →', 'vulopilot')}
				</a>
			</CardComponent>

			<CardComponent
				className="woocommerce-category-card"
				isLoading={isLoading}
			>
				<i className="woocommerce-category-icon adminfont-editor-code" />
				<div className="woocommerce-category-title">
					{__('Compatibility', 'vulopilot')}
				</div>
				{compatibilityCount > 0 && (
					<span className="admin-badge red">
						{sprintf(
							/* translators: %d is the number of outdated theme templates. */
							__('%d templates outdated', 'vulopilot'),
							compatibilityCount
						)}
					</span>
				)}
				<div className="desc">
					{__(
						'Your theme\'s WooCommerce template overrides may be missing fixes from newer versions.',
						'vulopilot'
					)}
				</div>
				<a
					className="woocommerce-category-link"
					role="button"
					tabIndex={0}
					onClick={() => onReviewTab('store')}
				>
					{__('Review templates →', 'vulopilot')}
				</a>
			</CardComponent>
		</div>
	);
};

export default WooCommerceCategoryGrid;
