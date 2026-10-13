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
		// Checkout Steps
		{
			type: 'separator',
			id: 'checkout-steps',
			label: __( 'Checkout Steps', 'vulocart' ),
		},
		{
			id: 'cart',
			icon: 'cart',
			name: __( 'Cart', 'vulocart' ),
			desc: __(
				'The Cart Engine - add/update/remove line items, headless-ready via a client-held cart token.',
				'vulocart'
			),
			proModule: false,
			category: 'checkout-steps',
			freeFeatures: [
				__( 'Add, update and remove line items', 'vulocart' ),
				__( 'Client-held cart token for headless use', 'vulocart' ),
				__( 'REST-first cart API', 'vulocart' ),
			],
			proFeatures: [
				__( 'Saved carts and wishlists (Customer Growth)', 'vulocart' ),
				__( 'Abandoned checkout tracking', 'vulocart' ),
			],
		},
		{
			id: 'order',
			icon: 'store',
			name: __( 'Order', 'vulocart' ),
			desc: __(
				'Turns a Cart into a placed Order - requires the Cart module to be active.',
				'vulocart'
			),
			proModule: false,
			category: 'checkout-steps',
			freeFeatures: [
				__( 'Place an order from a cart', 'vulocart' ),
				__( 'Order list, add and edit screens', 'vulocart' ),
				__( 'Order status management', 'vulocart' ),
			],
			proFeatures: [
				__( 'Buyer order notes shown on the order', 'vulocart' ),
				__( 'Multi-shipment fulfillment and returns (RMA)', 'vulocart' ),
				__( 'Fraud scoring and review queue', 'vulocart' ),
			],
		},
		{
			id: 'customer',
			icon: 'membership',
			name: __( 'Customer', 'vulocart' ),
			desc: __(
				'Checkout wizard Customer step - prefills name/email/phone for a logged-in buyer.',
				'vulocart'
			),
			proModule: false,
			category: 'checkout-steps',
			freeFeatures: [
				__( 'Name, email and phone capture', 'vulocart' ),
				__( 'Prefill for logged-in buyers', 'vulocart' ),
			],
			proFeatures: [
				__( 'Customer groups and dynamic segments', 'vulocart' ),
				__( 'Loyalty points, credits and wallet balances', 'vulocart' ),
			],
		},
		{
			id: 'address',
			icon: 'form-section',
			name: __( 'Address', 'vulocart' ),
			desc: __(
				'Checkout wizard Address step - billing/shipping address capture and validation.',
				'vulocart'
			),
			proModule: false,
			category: 'checkout-steps',
			freeFeatures: [
				__( 'Billing and shipping address capture', 'vulocart' ),
				__( 'Field validation', 'vulocart' ),
			],
			proFeatures: [
				__( 'Address autocomplete suggestions', 'vulocart' ),
			],
		},
		{
			id: 'shipping',
			icon: 'shipping',
			name: __( 'Shipping', 'vulocart' ),
			desc: __(
				'Checkout wizard Shipping step - flat-rate shipping cost, configured on the Shipping settings tab.',
				'vulocart'
			),
			proModule: false,
			category: 'checkout-steps',
			freeFeatures: [
				__( 'Flat-rate shipping cost', 'vulocart' ),
				__( 'Configured on the Shipping settings tab', 'vulocart' ),
			],
			proFeatures: [
				__( 'Zone and weight-based rates (Shipping Engine)', 'vulocart' ),
				__( 'Local pickup option', 'vulocart' ),
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
			id: 'payment',
			icon: 'payment',
			name: __( 'Payment', 'vulocart' ),
			desc: __(
				'Checkout wizard Payment step - manual/offline payment, configured on the Payments settings tab.',
				'vulocart'
			),
			proModule: false,
			category: 'checkout-steps',
			freeFeatures: [
				__( 'Manual / offline payment', 'vulocart' ),
				__( 'Configured on the Payments settings tab', 'vulocart' ),
			],
			proFeatures: [
				__( 'Card, PayPal and Razorpay gateways', 'vulocart' ),
				__( 'Gift card and coupon redemption at checkout', 'vulocart' ),
			],
		},
		{
			id: 'review',
			icon: 'eye',
			name: __( 'Review', 'vulocart' ),
			desc: __(
				'Checkout wizard Review step - a real preview of the final order total before it\'s placed.',
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
		{
			id: 'confirmation',
			icon: 'save',
			name: __( 'Confirmation', 'vulocart' ),
			desc: __(
				'The checkout wizard\'s post-order confirmation step - requires the Order module to be active.',
				'vulocart'
			),
			proModule: false,
			category: 'checkout-steps',
			freeFeatures: [
				__( 'Post-order confirmation screen', 'vulocart' ),
				__( 'Order summary for the buyer', 'vulocart' ),
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
				'Automatic percentage/fixed discounts scoped to all offerings, one type, one category, or one offering.',
				'vulocart'
			),
			proModule: true,
			category: 'catalog',
			freeFeatures: [],
			proFeatures: [
				__( 'Percentage and fixed discounts', 'vulocart' ),
				__( 'Scope to all, a type, a category or one offering', 'vulocart' ),
				__( 'Effective-price lookup per offering', 'vulocart' ),
			],
		},
		{
			id: 'offering-templates',
			icon: 'form-section',
			name: __( 'Offering Templates', 'vulocart' ),
			desc: __(
				'Save any offering\'s fields as a reusable preset, and start new offerings from it.',
				'vulocart'
			),
			proModule: true,
			category: 'catalog',
			freeFeatures: [],
			proFeatures: [
				__( 'Save an offering as a reusable preset', 'vulocart' ),
				__( 'Start new offerings from a template', 'vulocart' ),
			],
		},
		{
			id: 'bulk-editor',
			icon: 'bulk-action',
			name: __( 'Bulk Editor', 'vulocart' ),
			desc: __(
				'A spreadsheet-style screen for editing price/status/stock across many offerings at once, plus Duplicate Offering.',
				'vulocart'
			),
			proModule: true,
			category: 'catalog',
			freeFeatures: [],
			proFeatures: [
				__( 'Spreadsheet-style price, status and stock editing', 'vulocart' ),
				__( 'Duplicate an offering in one click', 'vulocart' ),
			],
		},
		{
			id: 'csv-import',
			icon: 'csv',
			name: __( 'Import CSV', 'vulocart' ),
			desc: __(
				'Bulk-create offerings from a spreadsheet export, with column mapping and a preview.',
				'vulocart'
			),
			proModule: true,
			category: 'catalog',
			freeFeatures: [],
			proFeatures: [
				__( 'Bulk-create offerings from a CSV', 'vulocart' ),
				__( 'Column mapping', 'vulocart' ),
				__( 'Preview before import', 'vulocart' ),
			],
		},
		{
			id: 'suppliers',
			icon: 'store-inventory',
			name: __( 'Suppliers', 'vulocart' ),
			desc: __(
				'Track who each offering is sourced from - manage suppliers and assign one per offering.',
				'vulocart'
			),
			proModule: true,
			category: 'catalog',
			freeFeatures: [],
			proFeatures: [
				__( 'Supplier directory', 'vulocart' ),
				__( 'Assign one supplier per offering', 'vulocart' ),
			],
		},
		{
			id: 'passport',
			icon: 'identity-verification',
			name: __( 'Passport', 'vulocart' ),
			desc: __(
				'Serialized Digital Product Passports - authenticity verification, warranty, service/owner history, certificates, firmware, and a public passport page with QR/NFC sharing and PDF export.',
				'vulocart'
			),
			proModule: true,
			category: 'catalog',
			freeFeatures: [],
			proFeatures: [
				__( 'Serialized passports with authenticity verification', 'vulocart' ),
				__( 'Warranty, service and owner history', 'vulocart' ),
				__( 'Public passport page with QR/NFC sharing', 'vulocart' ),
				__( 'PDF export and revocation', 'vulocart' ),
			],
		},

		// Checkout Experience
		{
			type: 'separator',
			id: 'checkout-experience',
			label: __( 'Checkout Experience', 'vulocart' ),
		},
		{
			id: 'checkout-templates',
			icon: 'form-section',
			name: __( 'Checkout Builder', 'vulocart' ),
			desc: __(
				'Enable/disable and reorder checkout steps, saved as named, one-active-at-a-time templates.',
				'vulocart'
			),
			proModule: true,
			category: 'checkout-experience',
			freeFeatures: [],
			proFeatures: [
				__( 'Enable, disable and reorder checkout steps', 'vulocart' ),
				__( 'Named templates, one active at a time', 'vulocart' ),
			],
		},
		{
			id: 'order-notes',
			icon: 'document',
			name: __( 'Order Notes', 'vulocart' ),
			desc: __(
				'Lets a buyer leave a note for their order at checkout, shown on the Order edit page.',
				'vulocart'
			),
			proModule: true,
			category: 'checkout-experience',
			freeFeatures: [],
			proFeatures: [
				__( 'Buyer note field at checkout', 'vulocart' ),
				__( 'Notes shown on the Order edit page', 'vulocart' ),
			],
		},
		{
			id: 'one-click-checkout',
			icon: 'automation',
			name: __( 'One-Click Checkout', 'vulocart' ),
			desc: __(
				'Lets a returning buyer place an order instantly, reusing the address/shipping/payment from their last order under the same email.',
				'vulocart'
			),
			proModule: true,
			category: 'checkout-experience',
			freeFeatures: [],
			proFeatures: [
				__( 'Instant reorder for returning buyers', 'vulocart' ),
				__( 'Reuses last address, shipping and payment', 'vulocart' ),
			],
		},
		{
			id: 'address-autocomplete',
			icon: 'form-section',
			name: __( 'Address Autocomplete', 'vulocart' ),
			desc: __(
				'Suggests full addresses as a shopper types at checkout, via a pluggable lookup provider (none configured out of the box).',
				'vulocart'
			),
			proModule: true,
			category: 'checkout-experience',
			freeFeatures: [],
			proFeatures: [
				__( 'Address suggestions as the shopper types', 'vulocart' ),
				__( 'Pluggable lookup provider', 'vulocart' ),
			],
		},
		{
			id: 'popup-checkout',
			icon: 'storefront',
			name: __( 'Popup Checkout', 'vulocart' ),
			desc: __(
				'Opens checkout in a modal from any "data-vulocart-checkout-trigger" element on any page, not just the Checkout block.',
				'vulocart'
			),
			proModule: true,
			category: 'checkout-experience',
			freeFeatures: [],
			proFeatures: [
				__( 'Checkout in a modal from any page', 'vulocart' ),
				__( 'Triggered by a simple data attribute', 'vulocart' ),
			],
		},
		{
			id: 'drawer-checkout',
			icon: 'storefront',
			name: __( 'Drawer Checkout', 'vulocart' ),
			desc: __(
				'Opens checkout in a slide-in side panel from any "data-vulocart-drawer-checkout-trigger" element, via the VuloCart SDK.',
				'vulocart'
			),
			proModule: true,
			category: 'checkout-experience',
			freeFeatures: [],
			proFeatures: [
				__( 'Slide-in side-panel checkout', 'vulocart' ),
				__( 'Triggered by a simple data attribute', 'vulocart' ),
			],
		},
		{
			id: 'embedded-checkout',
			icon: 'storefront',
			name: __( 'Embedded Checkout', 'vulocart' ),
			desc: __(
				'Renders checkout inline into any "data-vulocart-embedded-checkout" container on any page - same-site only, see module docs for cross-domain embedding.',
				'vulocart'
			),
			proModule: true,
			category: 'checkout-experience',
			freeFeatures: [],
			proFeatures: [
				__( 'Inline checkout in any container on any page', 'vulocart' ),
				__( 'Same-site embedding', 'vulocart' ),
			],
		},
		{
			id: 'hosted-checkout',
			icon: 'link',
			name: __( 'Hosted Checkout', 'vulocart' ),
			desc: __(
				'A dedicated /checkout/hosted/{cart_token}/ URL a shopper can be redirected to - not a WordPress page, no theme involved.',
				'vulocart'
			),
			proModule: true,
			category: 'checkout-experience',
			freeFeatures: [],
			proFeatures: [
				__( 'Dedicated hosted checkout URL per cart', 'vulocart' ),
				__( 'Theme-independent page', 'vulocart' ),
			],
		},
		{
			id: 'checkout-links',
			icon: 'link',
			name: __( 'Checkout Links & QR Codes', 'vulocart' ),
			desc: __(
				'Shareable payment/checkout links for a fixed set of offerings - a dedicated /pay/ URL, embeddable, or shown as a QR code.',
				'vulocart'
			),
			proModule: true,
			category: 'checkout-experience',
			freeFeatures: [],
			proFeatures: [
				__( 'Shareable /pay/ links for fixed offerings', 'vulocart' ),
				__( 'QR code and embeddable link', 'vulocart' ),
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

		// Payments
		{
			type: 'separator',
			id: 'payments',
			label: __( 'Payments', 'vulocart' ),
		},
		{
			id: 'stripe',
			icon: 'stripe-connect',
			name: __( 'Stripe', 'vulocart' ),
			desc: __(
				'Accept credit/debit cards via Stripe - Payment Intents, saved cards for recurring billing, and partial capture/refund.',
				'vulocart'
			),
			proModule: true,
			category: 'payments',
			freeFeatures: [],
			proFeatures: [
				__( 'Card payments via Payment Intents', 'vulocart' ),
				__( 'Saved cards for recurring billing', 'vulocart' ),
				__( 'Partial capture and refund', 'vulocart' ),
			],
		},
		{
			id: 'paypal',
			icon: 'paypal-marketplace',
			name: __( 'PayPal', 'vulocart' ),
			desc: __( 'Accept payments via PayPal Checkout.', 'vulocart' ),
			proModule: true,
			category: 'payments',
			freeFeatures: [],
			proFeatures: [ __( 'PayPal Checkout payments', 'vulocart' ) ],
		},
		{
			id: 'razorpay',
			icon: 'razorpay',
			name: __( 'Razorpay', 'vulocart' ),
			desc: __( 'Accept payments via Razorpay Checkout.', 'vulocart' ),
			proModule: true,
			category: 'payments',
			freeFeatures: [],
			proFeatures: [ __( 'Razorpay Checkout payments', 'vulocart' ) ],
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
			category: 'payments',
			freeFeatures: [],
			proFeatures: [
				__( 'Automatic renewal charges', 'vulocart' ),
				__( 'Dunning retries for failed payments', 'vulocart' ),
				__( 'Customer self-service: update payment method', 'vulocart' ),
			],
		},

		// Customers & Operations
		{
			type: 'separator',
			id: 'operations',
			label: __( 'Customers & Operations', 'vulocart' ),
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
				'Warehouses/locations, purchase orders, transfers, reservations, low-stock alerts, batch/serial tracking, a full inventory history ledger, and demand forecasting - stock decrements automatically on paid orders and stays synced with each offering\'s own stock field.',
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
			id: 'shipping-engine',
			icon: 'shipping',
			name: __( 'Shipping Engine', 'vulocart' ),
			desc: __(
				'Zone/weight-based rates on top of the free flat-rate fallback, packaging presets, multi-shipment fulfillment with tracking, a pluggable carrier/label framework, returns (RMA) with automatic refunds, and local pickup.',
				'vulocart'
			),
			proModule: true,
			category: 'operations',
			freeFeatures: [
				__( 'Flat-rate fallback (Shipping module)', 'vulocart' ),
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
				'AI-generated offering/upsell recommendations.',
				'vulocart'
			),
			proModule: false,
			category: 'ai-integrations',
			freeFeatures: [
				__( 'AI-generated offering recommendations', 'vulocart' ),
				__( 'Upsell suggestions', 'vulocart' ),
				__( 'Provider configured on the AI settings tab', 'vulocart' ),
			],
			proFeatures: [],
		},
	],
};

export default MODULES_CATALOG;
