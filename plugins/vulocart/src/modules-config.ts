import { __ } from '@wordpress/i18n';

/**
 * Static module metadata for zyra's `ModuleGridComponent`
 * (components/Settings/ModulesPanel.tsx) - same shape as vulopilot's
 * `components/Modules/index.ts`. The *available* module list is
 * frontend-only config; only which ids are *active* comes from the REST
 * layer (classes/RestAPI/Controllers/Modules.php).
 *
 * - `proModule: true` entries ship in `vulocart-pro` and are gated behind
 *   `ZyraVariable.khali_dabba`.
 * - `freeFeatures` lists what the module gives you in this plugin;
 *   `proFeatures` what `vulocart-pro` adds on top (or, for a Pro-only
 *   module, everything it does). Keep both honest - a feature belongs
 *   here only if the code ships it.
 * - `{ type: 'separator' }` rows are the category pills, not modules; a
 *   module's `category` must match its separator's `id`.
 * - A module id must equal the kebab-cased `modules/{Name}` folder name,
 *   or the loader drops it (see CLAUDE.md "Module/addon system").
 */
export interface ModuleCatalogEntry {
	id: string;
	name: string;
	desc: string;
	proModule: boolean;
	category: string;
	icon?: string;
	freeFeatures?: string[];
	proFeatures?: string[];
}

/** A category-pill-bar heading, not a real module. */
export interface ModuleCatalogSeparator {
	type: 'separator';
	id: string;
	label: string;
}

export type ModuleCatalogItem = ModuleCatalogEntry | ModuleCatalogSeparator;

export const isModuleCatalogEntry = (
	item: ModuleCatalogItem
): item is ModuleCatalogEntry => ! ( 'type' in item );

const MODULES_CATALOG: {
	category: boolean;
	tab: string;
	modules: ModuleCatalogItem[];
} = {
	category: true,
	tab: 'settings',
	modules: [
		// Checkout
		{
			type: 'separator',
			id: 'checkout-steps',
			label: __( 'Checkout', 'vulocart' ),
		},

		{
			id: 'shipping',
			icon: 'shipping',
			name: __( 'Shipping', 'vulocart' ),
			desc: __(
				'Checkout Shipping step - flat-rate shipping, configured on the Shipping settings tab. With Pro: zone and weight-based rates, packaging, tracked shipments, carriers, returns and local pickup. Switch it off for a store that does not ship.',
				'vulocart'
			),
			proModule: false,
			category: 'checkout-steps',
			freeFeatures: [
				__( 'Flat-rate shipping cost', 'vulocart' ),
				__( 'Configured on the Shipping settings tab', 'vulocart' ),
			],
			proFeatures: [
				__( 'Zone and weight-based rates', 'vulocart' ),
				__( 'Packaging presets', 'vulocart' ),
				__( 'Multi-shipment fulfillment with tracking', 'vulocart' ),
				__( 'Pluggable carrier and label framework', 'vulocart' ),
				__( 'Returns (RMA) with automatic refunds', 'vulocart' ),
				__( 'Local pickup', 'vulocart' ),
			],
		},

		{
			id: 'taxes',
			icon: 'tax-compliance',
			name: __( 'Taxes', 'vulocart' ),
			desc: __(
				'Adds tax calculation to order totals, using a flat rate configured on the Taxes settings tab.',
				'vulocart'
			),
			proModule: false,
			category: 'checkout-steps',
			freeFeatures: [
				__( 'Flat tax rate on order totals', 'vulocart' ),
				__( 'Configured on the Taxes settings tab', 'vulocart' ),
			],
			proFeatures: [],
		},

		{
			id: 'review',
			icon: 'eye',
			name: __( 'Review', 'vulocart' ),
			desc: __(
				'Checkout Review step - a preview of the final order total before it\'s placed.',
				'vulocart'
			),
			proModule: false,
			category: 'checkout-steps',
			freeFeatures: [
				__( 'Final order total preview', 'vulocart' ),
				__( 'Totals shown before the order is placed', 'vulocart' ),
			],
			proFeatures: [],
		},

		// Catalog
		{
			type: 'separator',
			id: 'catalog',
			label: __( 'Catalog', 'vulocart' ),
		},
		{
			id: 'variants',
			icon: 'catalog',
			name: __( 'Variants', 'vulocart' ),
			desc: __(
				'Generate attribute-combination variants (e.g. Color × Size) with their own SKU/price/stock.',
				'vulocart'
			),
			proModule: true,
			category: 'catalog',
			freeFeatures: [],
			proFeatures: [
				__( 'Attribute-combination generator', 'vulocart' ),
				__( 'Per-variant SKU, price and stock', 'vulocart' ),
			],
		},
		{
			id: 'pricing-rules',
			icon: 'price',
			name: __( 'Pricing Rules', 'vulocart' ),
			desc: __(
				'Automatic percentage/fixed discounts scoped to all products, one type, one category, or one product.',
				'vulocart'
			),
			proModule: true,
			category: 'catalog',
			freeFeatures: [],
			proFeatures: [
				__( 'Percentage and fixed discounts', 'vulocart' ),
				__( 'Scope to all, a type, a category or one product', 'vulocart' ),
				__( 'Effective-price lookup per product', 'vulocart' ),
			],
		},
		{
			id: 'product-templates',
			icon: 'form-section',
			name: __( 'Product Templates', 'vulocart' ),
			desc: __(
				'Save any product\'s fields as a reusable preset, and start new products from it.',
				'vulocart'
			),
			proModule: true,
			category: 'catalog',
			freeFeatures: [],
			proFeatures: [
				__( 'Save a product as a reusable preset', 'vulocart' ),
				__( 'Start new products from a template', 'vulocart' ),
			],
		},
		{
			id: 'bulk-editor',
			icon: 'bulk-action',
			name: __( 'Bulk Tools', 'vulocart' ),
			desc: __(
				'Work on many products at once from the Products list: edit them in bulk and import them from a CSV file.',
				'vulocart'
			),
			proModule: true,
			category: 'catalog',
			freeFeatures: [],
			proFeatures: [
				__( 'Bulk edit status, price and stock', 'vulocart' ),
				__( 'Bulk-create products from a CSV with column mapping and preview', 'vulocart' ),
			],
		},
		{
			id: 'suppliers',
			icon: 'store-inventory',
			name: __( 'Suppliers', 'vulocart' ),
			desc: __(
				'Track who each product is sourced from - manage suppliers and assign one per product.',
				'vulocart'
			),
			proModule: true,
			category: 'catalog',
			freeFeatures: [],
			proFeatures: [
				__( 'Supplier directory', 'vulocart' ),
				__( 'Assign one supplier per product', 'vulocart' ),
			],
		},
		{
			id: 'passport',
			icon: 'identity-verification',
			name: __( 'Digital Product Passport', 'vulocart' ),
			desc: __(
				'The EU Digital Product Passport for each product - identifiers, manufacturer, compliance, materials, carbon footprint, durability and repair, and end of life - published on a public page you can share as a QR code.',
				'vulocart'
			),
			proModule: true,
			category: 'catalog',
			freeFeatures: [],
			proFeatures: [
				__( 'Passport data on every product, with a completeness checklist', 'vulocart' ),
				__( 'Compliance, materials, footprint, repair and end-of-life details', 'vulocart' ),
				__( 'Public passport page with a QR code', 'vulocart' ),
				__( 'Machine-readable JSON for each passport', 'vulocart' ),
			],
		},


		// Promotions
		{
			type: 'separator',
			id: 'promotions',
			label: __( 'Promotions', 'vulocart' ),
		},
		{
			id: 'coupons',
			icon: 'coupon',
			name: __( 'Coupons', 'vulocart' ),
			desc: __(
				'Percentage/fixed discount codes a shopper can enter at checkout.',
				'vulocart'
			),
			proModule: true,
			category: 'promotions',
			freeFeatures: [],
			proFeatures: [
				__( 'Percentage and fixed discount codes', 'vulocart' ),
				__( 'Code validation and redemption at checkout', 'vulocart' ),
			],
		},
		{
			id: 'gift-cards',
			icon: 'gift-card',
			name: __( 'Gift Cards', 'vulocart' ),
			desc: __(
				'Stored-value codes a shopper can redeem, partially or fully, toward their order total.',
				'vulocart'
			),
			proModule: true,
			category: 'promotions',
			freeFeatures: [],
			proFeatures: [
				__( 'Stored-value gift card codes', 'vulocart' ),
				__( 'Partial or full redemption toward an order', 'vulocart' ),
			],
		},

		{
			id: 'abandoned-checkout',
			icon: 'cart',
			name: __( 'Abandoned Checkout', 'vulocart' ),
			desc: __(
				'A list of checkout sessions that were started but never completed.',
				'vulocart'
			),
			proModule: true,
			category: 'promotions',
			freeFeatures: [],
			proFeatures: [
				__( 'List of started-but-unfinished checkouts', 'vulocart' ),
			],
		},


		// Customers & Operations
		{
			type: 'separator',
			id: 'operations',
			label: __( 'Customers & Operations', 'vulocart' ),
		},
		{
			id: 'subscriptions',
			icon: 'subscription',
			name: __( 'Subscriptions', 'vulocart' ),
			desc: __(
				'Recurring billing on top of a recurring-capable payment gateway - automatic renewal charges, dunning retries, and customer self-service.',
				'vulocart'
			),
			proModule: true,
			category: 'operations',
			freeFeatures: [],
			proFeatures: [
				__( 'Automatic renewal charges', 'vulocart' ),
				__( 'Dunning retries for failed payments', 'vulocart' ),
				__( 'Customer self-service: update payment method', 'vulocart' ),
			],
		},
		{
			id: 'customer-growth',
			icon: 'cohort',
			name: __( 'Customer Growth', 'vulocart' ),
			desc: __(
				'Wishlist, saved carts, manual groups, dynamic segments, a unified loyalty points/credits/wallet ledger (spendable at checkout), communication history, and a merged customer timeline.',
				'vulocart'
			),
			proModule: true,
			category: 'operations',
			freeFeatures: [],
			proFeatures: [
				__( 'Wishlists and saved carts', 'vulocart' ),
				__( 'Customer groups and dynamic segments', 'vulocart' ),
				__( 'Loyalty points, credits and wallet ledger', 'vulocart' ),
				__( 'Communication history and customer timeline', 'vulocart' ),
			],
		},
		{
			id: 'inventory',
			icon: 'store-inventory',
			name: __( 'Inventory Engine', 'vulocart' ),
			desc: __(
				'Warehouses/locations, purchase orders, transfers, reservations, low-stock alerts, batch/serial tracking, a full inventory history ledger, and demand forecasting - stock decrements automatically on paid orders and stays synced with each product\'s own stock field.',
				'vulocart'
			),
			proModule: true,
			category: 'operations',
			freeFeatures: [],
			proFeatures: [
				__( 'Warehouses, locations and transfers', 'vulocart' ),
				__( 'Purchase orders with receiving', 'vulocart' ),
				__( 'Reservations and low-stock alerts', 'vulocart' ),
				__( 'Batch/serial tracking and history ledger', 'vulocart' ),
				__( 'Demand forecasting', 'vulocart' ),
			],
		},

		// AI & Integrations
		{
			type: 'separator',
			id: 'ai-integrations',
			label: __( 'AI & Integrations', 'vulocart' ),
		},
		{
			id: 'mcp',
			icon: 'centralized-connections',
			name: __( 'MCP', 'vulocart' ),
			desc: __(
				'Model Context Protocol server - exposes VuloCart\'s catalog/orders to MCP-compatible AI clients.',
				'vulocart'
			),
			proModule: false,
			category: 'ai-integrations',
			freeFeatures: [
				__( 'MCP endpoint for AI clients', 'vulocart' ),
				__( 'API key authentication', 'vulocart' ),
			],
			proFeatures: [],
		},
		{
			id: 'ai',
			icon: 'ai',
			name: __( 'AI', 'vulocart' ),
			desc: __(
				'AI-generated product/upsell recommendations.',
				'vulocart'
			),
			proModule: false,
			category: 'ai-integrations',
			freeFeatures: [
				__( 'AI-generated product recommendations', 'vulocart' ),
				__( 'Upsell suggestions', 'vulocart' ),
				__( 'Provider configured on the AI settings tab', 'vulocart' ),
			],
			proFeatures: [],
		},
	],
};

export default MODULES_CATALOG;
