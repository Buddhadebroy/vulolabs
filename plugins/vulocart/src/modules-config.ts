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
	/** Where this module is configured or used - zyra shows it as the card's Settings link. */
	settingsLink?: string;
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
			settingsLink: '?page=vulocart#&tab=settings&subtab=shipping',
			icon: 'shipping',
			name: __( 'Shipping', 'vulocart' ),
			desc: __(
				'Checkout Shipping step - flat-rate shipping, configured under Shipping & Tax. With Pro, the same card also turns on zone and weight-based rates, packaging, the Shipment page (tracked shipments, carriers, returns, local pickup). Switch it off for a store that does not ship.',
				'vulocart'
			),
			proModule: false,
			category: 'checkout-steps',
			freeFeatures: [
				__( 'Flat-rate shipping cost', 'vulocart' ),
				__( 'Configured under Shipping & Tax', 'vulocart' ),
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
			settingsLink: '?page=vulocart#&tab=settings&subtab=taxes',
			icon: 'tax-compliance',
			name: __( 'Taxes', 'vulocart' ),
			desc: __(
				'Charges tax by where the order is going and what each product is: rates per country, state and postcode, tax classes, tax on shipping, tax-inclusive prices, and ready-made sets (EU VAT, UK VAT, India GST and more). Set it up under Shipping & Tax.',
				'vulocart'
			),
			proModule: false,
			category: 'checkout-steps',
			freeFeatures: [
				__( 'Rates by country, state and postcode', 'vulocart' ),
				__( 'Tax classes (standard, reduced, zero, your own)', 'vulocart' ),
				__( 'Stacked taxes such as CGST + SGST', 'vulocart' ),
				__( 'Tax-inclusive or tax-exclusive prices', 'vulocart' ),
			],
			proFeatures: [
				__( 'Automatic rates with Stripe Tax', 'vulocart' ),
				__( 'EU VAT reverse charge and GSTIN capture for business buyers', 'vulocart' ),
			],
		},

		{
			id: 'checkout-links',
			settingsLink: '?page=marketing&view=checkout-links',
			icon: 'link',
			name: __( 'Payment links & QR codes', 'vulocart' ),
			desc: __(
				'Create shareable checkout links and QR codes for a product or a custom cart, to sell in chat, email or in person.',
				'vulocart'
			),
			proModule: true,
			category: 'promotions',
			freeFeatures: [],
			proFeatures: [
				__( 'Shareable checkout links', 'vulocart' ),
				__( 'QR codes for in-person sales', 'vulocart' ),
			],
		},

		// Catalog
		{
			type: 'separator',
			id: 'catalog',
			label: __( 'Catalog', 'vulocart' ),
		},
		{
			id: 'variants',
			settingsLink: '?page=products',
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
			settingsLink: '?page=marketing&view=pricing-rules',
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
			settingsLink: '?page=products&view=product-templates',
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
			settingsLink: '?page=products',
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
			settingsLink: '?page=inventory&view=suppliers',
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
			settingsLink: '?page=products',
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
			settingsLink: '?page=marketing&view=coupons',
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
			settingsLink: '?page=marketing&view=gift-cards',
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
			settingsLink: '?page=marketing&view=abandoned-checkouts',
			icon: 'cart',
			name: __( 'Cart Abandoned', 'vulocart' ),
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
			settingsLink: '?page=orders&view=subscriptions',
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
			settingsLink: '?page=customers&view=segments',
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
			id: 'order-documents',
			settingsLink: '?page=orders',
			icon: 'invoice',
			name: __( 'Order Documents', 'vulocart' ),
			desc: __(
				'Invoice, packing slip and credit note for every order - as a PDF or a print-ready page, from the order screen.',
				'vulocart'
			),
			proModule: true,
			category: 'operations',
			freeFeatures: [],
			proFeatures: [
				__( 'PDF invoice with your store details', 'vulocart' ),
				__( 'Packing slip without prices', 'vulocart' ),
				__( 'Credit note for refunded orders', 'vulocart' ),
				__( 'Print-ready page for each document', 'vulocart' ),
			],
		},
		{
			id: 'inventory',
			settingsLink: '?page=inventory',
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
		{
			id: 'analytics',
			settingsLink: '?page=vulocart#&tab=dashboard',
			icon: 'analytics',
			name: __( 'Analytics', 'vulocart' ),
			desc: __(
				'Sales, revenue, customers, products, funnels, abandonment, conversion, lifetime value, retention and forecasts on one dashboard.',
				'vulocart'
			),
			proModule: true,
			category: 'operations',
			freeFeatures: [],
			proFeatures: [
				__( 'Sales, revenue and customer reports', 'vulocart' ),
				__( 'Funnels, conversion and abandonment', 'vulocart' ),
				__( 'Lifetime value, retention and forecasts', 'vulocart' ),
			],
		},
		{
			id: 'workflow-builder',
			settingsLink: '?page=workflows',
			icon: 'automation',
			name: __( 'Workflow Builder', 'vulocart' ),
			desc: __(
				'Automate what happens after an order, payment, refund, low-stock alert, new customer or delivery - triggers, conditions and actions such as email, webhook and Slack.',
				'vulocart'
			),
			proModule: true,
			category: 'operations',
			freeFeatures: [],
			proFeatures: [
				__( 'Seven triggers and seven actions', 'vulocart' ),
				__( 'Conditions, loops and waits', 'vulocart' ),
				__( 'Run history', 'vulocart' ),
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
			settingsLink: '?page=vulocart#&tab=settings&subtab=integrations',
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
			settingsLink: '?page=vulocart#&tab=settings&subtab=integrations',
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
		{
			id: 'catalog-ai',
			settingsLink: '?page=ai',
			icon: 'ai',
			name: __( 'Catalog AI', 'vulocart' ),
			desc: __(
				'Describe a product and Catalog AI drafts it - title, description, SEO, specifications, FAQs, translations and pricing suggestions. Needs the AI module and a provider on the AI settings tab.',
				'vulocart'
			),
			proModule: true,
			category: 'ai-integrations',
			freeFeatures: [],
			proFeatures: [
				__( 'Generate products and descriptions', 'vulocart' ),
				__( 'SEO, specifications, FAQs and translations', 'vulocart' ),
				__( 'Pricing and inventory suggestions', 'vulocart' ),
			],
		},
		{
			id: 'checkout-ai',
			settingsLink: '?page=ai',
			icon: 'ai',
			name: __( 'Checkout AI', 'vulocart' ),
			desc: __(
				'Scores every checkout for fraud risk and queues the risky ones for review, and suggests products bought together.',
				'vulocart'
			),
			proModule: true,
			category: 'ai-integrations',
			freeFeatures: [],
			proFeatures: [
				__( 'Real-time fraud scoring', 'vulocart' ),
				__( 'Review queue for risky orders', 'vulocart' ),
				__( 'Co-purchase recommendations', 'vulocart' ),
			],
		},
		{
			id: 'support-ai',
			settingsLink: '?page=ai',
			icon: 'ai',
			name: __( 'Support AI', 'vulocart' ),
			desc: __(
				'Chat assistants that draft replies from your catalog and order data - one for you in wp-admin and one for shoppers on the storefront.',
				'vulocart'
			),
			proModule: true,
			category: 'ai-integrations',
			freeFeatures: [],
			proFeatures: [
				__( 'Merchant assistant in wp-admin', 'vulocart' ),
				__( 'Customer assistant on the storefront', 'vulocart' ),
			],
		},
		{
			id: 'vector-search',
			settingsLink: '?page=ai',
			icon: 'ai',
			name: __( 'Vector Search', 'vulocart' ),
			desc: __(
				'Semantic search over your catalog - finds products by meaning, not just exact keywords.',
				'vulocart'
			),
			proModule: true,
			category: 'ai-integrations',
			freeFeatures: [],
			proFeatures: [
				__( 'Search by meaning', 'vulocart' ),
				__( 'Built on your AI provider embeddings', 'vulocart' ),
			],
		},
	],
};

export default MODULES_CATALOG;
