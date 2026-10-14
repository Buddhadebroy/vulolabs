import { __ } from '@wordpress/i18n';
import type { EngineView } from '../../components/EngineScreen/EngineScreen';

/**
 * Header/"module required" metadata for the Products sub-pages vulocart-pro's modules register
 * into `vulocart_products_extra_view` (and Customers' `vulocart_customers_extra_view`). Free
 * only knows the ids and copy; the pages themselves come from the modules.
 */
export const productsExtraViews: Record< string, EngineView > = {};

/**
 * Pro pages that aren't about products - promotions, subscriptions and checkout setup. They live in the
 * Marketing menu (MarketingEngine.tsx), filled in by vulocart-pro through `vulocart_marketing_view`.
 * Listed here so the Products router can send old `vulocart-products&view=` links to their new home.
 */
export const storeExtraViews: Record< string, EngineView > = {
	'pricing-rules': {
		title: __( 'Pricing Rules', 'vulocart' ),
		description: __( 'Automatic discounts applied when a product is added to cart. When more than one rule matches, the lowest resulting price wins.', 'vulocart' ),
		icon: 'price',
		module: 'pricing-rules',
		pro: true,
	},
	'abandoned-checkouts': {
		title: __( 'Abandoned Checkouts', 'vulocart' ),
		description: __( 'Checkout sessions that were started but never resulted in an order.', 'vulocart' ),
		icon: 'cart',
		module: 'abandoned-checkout',
		pro: true,
	},
	'checkout-links': {
		title: __( 'Checkout Links', 'vulocart' ),
		description: __( 'Shareable payment/checkout links for a fixed set of products - share the URL directly, embed it, or show it as a QR code.', 'vulocart' ),
		icon: 'link',
		module: 'checkout-links',
		pro: true,
	},
	'checkout-builder': {
		title: __( 'Checkout Builder', 'vulocart' ),
		description: __( 'Choose which checkout steps are active and in what order.', 'vulocart' ),
		icon: 'credit-card',
		module: 'checkout-templates',
		pro: true,
	},
	coupons: {
		title: __( 'Coupons', 'vulocart' ),
		description: __( 'Discount codes a shopper can enter at checkout.', 'vulocart' ),
		icon: 'coupon',
		module: 'coupons',
		pro: true,
	},
	'gift-cards': {
		title: __( 'Gift Cards', 'vulocart' ),
		description: __( 'Stored-value codes a shopper can redeem, partially or fully, toward their order total.', 'vulocart' ),
		icon: 'gift-card',
		module: 'gift-cards',
		pro: true,
	},
};

/**
 * Pro pages that belong with orders. Subscriptions are recurring orders, so they live in the Orders
 * menu (Orders.tsx), filled in by vulocart-pro through `vulocart_orders_view`.
 */
export const ordersExtraViews: Record< string, EngineView > = {
	subscriptions: {
		title: __( 'Subscriptions', 'vulocart' ),
		description: __( 'Recurring billing - automatic renewal charges, dunning retries, and customer self-service.', 'vulocart' ),
		icon: 'subscription',
		module: 'subscriptions',
		pro: true,
	},
};

/** Views that moved to another menu: old `page=...&view=` links are sent to the new page and view. */
export const movedViews: Record< string, { page: string; view: string } > = {
	subscriptions: { page: 'vulocart-orders', view: 'subscriptions' },
	suppliers: { page: 'vulocart-inventory', view: 'suppliers' },
	inventory: { page: 'vulocart-inventory', view: 'stock' },
};

export const customersExtraViews: Record< string, EngineView > = {
	groups: {
		title: __( 'Customer Groups', 'vulocart' ),
		description: __( 'Manual tags - add a customer to a group from their own detail page.', 'vulocart' ),
		icon: 'membership',
		module: 'customer-growth',
		pro: true,
	},
	segments: {
		title: __( 'Segments', 'vulocart' ),
		description: __( 'Dynamic, rule-based customer audiences - membership is always computed live, never a saved snapshot.', 'vulocart' ),
		icon: 'cohort',
		module: 'customer-growth',
		pro: true,
	},
};

/** Pro page in the Inventory menu; Free's own stock-levels view (`stock`) is rendered by InventoryEngine itself. */
export const inventoryExtraViews: Record< string, EngineView > = {
	suppliers: {
		title: __( 'Suppliers', 'vulocart' ),
		description: __( 'The vendors you source products from, and what each one supplies.', 'vulocart' ),
		icon: 'store-inventory',
		module: 'suppliers',
		pro: true,
	},
};
