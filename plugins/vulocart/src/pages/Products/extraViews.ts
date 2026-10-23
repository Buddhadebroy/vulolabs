import { __ } from '@wordpress/i18n';
import type { EngineView } from '../../components/EngineScreen/EngineScreen';

/**
 * Header/"module required" metadata for the Products sub-pages vulocart-pro's modules register
 * into `vulocart_products_extra_view` (and Customers' `vulocart_customers_extra_view`). Free
 * only knows the ids and copy; the pages themselves come from the modules.
 */
export const productsExtraViews: Record< string, EngineView > = {
	'product-templates': {
		title: __( 'Product templates', 'vulocart' ),
		description: __( 'Presets that pre-fill a new product - pick one when you add a product.', 'vulocart' ),
		icon: 'form-section',
		module: 'product-templates',
		pro: true,
	},
};

/**
 * Pro pages that aren't about products - promotions, cart recovery and checkout setup. They live in the
 * Marketing menu (MarketingEngine.tsx), one submenu each, filled in by vulocart-pro through `vulocart_marketing_view`.
 */
export const storeExtraViews: Record< string, EngineView > = {
	coupons: {
		title: __( 'Coupons', 'vulocart' ),
		description: __( 'Discount codes a shopper can enter at checkout.', 'vulocart' ),
		icon: 'coupon',
		module: 'coupons',
		pro: true,
	},
	'pricing-rules': {
		title: __( 'Pricing Rules', 'vulocart' ),
		description: __( 'Automatic discounts applied when a product is added to cart. When more than one rule matches, the lowest resulting price wins.', 'vulocart' ),
		icon: 'price',
		module: 'pricing-rules',
		pro: true,
	},
	'gift-cards': {
		title: __( 'Gift Cards', 'vulocart' ),
		description: __( 'Stored-value codes a shopper can redeem, partially or fully, toward their order total.', 'vulocart' ),
		icon: 'gift-card',
		module: 'gift-cards',
		pro: true,
	},
	'abandoned-checkouts': {
		title: __( 'Cart Abandoned', 'vulocart' ),
		description: __( 'Checkout sessions that were started but never resulted in an order.', 'vulocart' ),
		icon: 'cart',
		module: 'abandoned-checkout',
		pro: true,
	},
	'checkout-links': {
		title: __( 'Payment Links', 'vulocart' ),
		description: __( 'Sell without a store visit: a link that opens checkout with your chosen products already in the cart. Share it anywhere or print it as a QR code.', 'vulocart' ),
		icon: 'link',
		module: 'checkout-links',
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
		module: 'recurring-billing',
		pro: true,
	},
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
