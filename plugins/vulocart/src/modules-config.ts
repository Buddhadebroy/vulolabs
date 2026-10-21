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

/**
 * Modules that have no card of their own: each switches on and off with the card named here (the companions map in
 * `Modules::with_companions()`). Lets a "turn on the X module" prompt for a page name and activate the card.
 */
export const MODULE_CARD_OF: Record< string, string > = {
	fulfillment: 'shipping',
	'stripe-tax': 'taxes',
	'tax-ids': 'taxes',
	'gift-cards': 'coupons',
	'pricing-rules': 'coupons',
	'abandoned-checkout': 'coupons',
	'checkout-links': 'coupons',
	'product-templates': 'bulk-editor',
	'csv-import': 'bulk-editor',
	suppliers: 'inventory',
	'catalog-ai': 'ai',
	'checkout-ai': 'ai',
	'support-ai': 'ai',
	'vector-search': 'ai',
	'mcp-server': 'mcp',
};

export const isModuleCatalogEntry = (
	item: ModuleCatalogItem
): item is ModuleCatalogEntry => ! ( 'type' in item );

/** The card that switches a module: the module itself when it has one, else the card it belongs to. */
export const moduleCardId = ( id: string ): string => MODULE_CARD_OF[ id ] ?? id;

const MODULES_CATALOG: {
	category: boolean;
	tab: string;
	modules: ModuleCatalogItem[];
} = {
	category: true,
	tab: 'settings',
	modules: [
		// Store setup (shipping and taxes)
		{
			type: 'separator',
			id: 'checkout-steps',
			label: __( 'Store setup', 'vulocart' ),
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


		// Catalog
		{
			type: 'separator',
			id: 'catalog',
			label: __( 'Catalog', 'vulocart' ),
		},
		{
			id: 'product-reviews',
			settingsLink: '?page=vulocart#&tab=reviews',
			icon: 'review',
			name: __( 'Product Reviews', 'vulocart' ),
			desc: __(
				'Customer reviews on your products: a moderation queue where you approve, reject or delete them, and a count of reviews waiting on the dashboard. Switching it off hides the Reviews screen and its routes; your stored reviews are kept.',
				'vulocart'
			),
			proModule: false,
			category: 'catalog',
			freeFeatures: [
				__( 'Approve, reject or delete reviews', 'vulocart' ),
				__( 'Filter by status and product, export to CSV', 'vulocart' ),
				__( 'Reviews-to-moderate count on the dashboard', 'vulocart' ),
			],
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
			id: 'bulk-editor',
			settingsLink: '?page=products',
			icon: 'bulk-action',
			name: __( 'Product tools', 'vulocart' ),
			desc: __(
				'Work on products faster: bulk edit and CSV import from the Products list, and reusable product templates that pre-fill a new product.',
				'vulocart'
			),
			proModule: true,
			category: 'catalog',
			freeFeatures: [],
			proFeatures: [
				__( 'Bulk edit status, price and stock', 'vulocart' ),
				__( 'Bulk-create products from a CSV with column mapping and preview', 'vulocart' ),
				__( 'Save a product as a reusable preset', 'vulocart' ),
				__( 'Start new products from a template', 'vulocart' ),
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
			name: __( 'Marketing', 'vulocart' ),
			desc: __(
				'Everything for promoting and recovering sales: coupons, gift cards, automatic pricing rules, abandoned-checkout recovery and shareable payment links with QR codes. One switch for the whole Marketing menu.',
				'vulocart'
			),
			proModule: true,
			category: 'promotions',
			freeFeatures: [],
			proFeatures: [
				__( 'Percentage and fixed discount codes', 'vulocart' ),
				__( 'Code validation and redemption at checkout', 'vulocart' ),
				__( 'Stored-value gift card codes', 'vulocart' ),
				__( 'Partial or full redemption toward an order', 'vulocart' ),
				__( 'Percentage and fixed discounts', 'vulocart' ),
				__( 'Scope to all, a type, a category or one product', 'vulocart' ),
				__( 'Effective-price lookup per product', 'vulocart' ),
				__( 'List of started-but-unfinished checkouts', 'vulocart' ),
				__( 'Shareable checkout links', 'vulocart' ),
				__( 'QR codes for in-person sales', 'vulocart' ),
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
			id: 'pdf-invoices',
			settingsLink: '?page=orders',
			icon: 'invoice',
			name: __( 'PDF Invoices & Packing Slips', 'vulocart' ),
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
			name: __( 'Inventory', 'vulocart' ),
			desc: __(
				'Warehouses and stock locations, purchase orders, transfers, reservations, low-stock alerts, batch/serial tracking, a full history ledger, demand forecasting and suppliers - stock decrements automatically on paid orders and stays synced with each product\'s own stock field.',
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
				__( 'Supplier directory', 'vulocart' ),
				__( 'Assign one supplier per product', 'vulocart' ),
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
			settingsLink: '?page=ai',
			icon: 'ai',
			name: __( 'AI', 'vulocart' ),
			desc: __(
				'The AI toolkit on one switch: product and upsell recommendations, and with Pro catalog drafting, checkout fraud scoring, support assistants and semantic search. Connect a provider under Settings → Integrations.',
				'vulocart'
			),
			proModule: false,
			category: 'ai-integrations',
			freeFeatures: [
				__( 'AI-generated product recommendations', 'vulocart' ),
				__( 'Upsell suggestions', 'vulocart' ),
				__( 'Provider configured on the AI settings tab', 'vulocart' ),
			],
			proFeatures: [
				__( 'Generate products and descriptions', 'vulocart' ),
				__( 'SEO, specifications, FAQs and translations', 'vulocart' ),
				__( 'Pricing and inventory suggestions', 'vulocart' ),
				__( 'Real-time fraud scoring', 'vulocart' ),
				__( 'Review queue for risky orders', 'vulocart' ),
				__( 'Co-purchase recommendations', 'vulocart' ),
				__( 'Merchant assistant in wp-admin', 'vulocart' ),
				__( 'Customer assistant on the storefront', 'vulocart' ),
				__( 'Search by meaning', 'vulocart' ),
				__( 'Built on your AI provider embeddings', 'vulocart' ),
			],
		},
	],
};

export default MODULES_CATALOG;
