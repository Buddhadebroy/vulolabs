import { __ } from '@wordpress/i18n';

/**
 * Static module metadata for zyra's `ModuleGridComponent`
 * (pages/Modules/Modules.tsx) — the *available* module list (name,
 * description, category) is frontend-only config, not fetched from PHP;
 * only which ids are *active* comes from the REST layer
 * (classes/RestAPI/Controllers/Modules.php). `cart`/`order` and the
 * checkout wizard's own `customer`/`address`/`shipping`/`taxes`/`payment`/
 * `review`/`confirmation` all ship in this free plugin itself
 * (`modules/{Name}` — module-architecture.md); `passport` ships in
 * `vulocart-pro` (`proModule: true` gates it behind
 * `vulocartLocalizer.khali_dabba`, same as every other proModule-flagged
 * entry in the sibling plugins).
 *
 * `mcp`/`ai` also ship in this free plugin (`modules/Mcp`, `modules/Ai`)
 * — deliberately minimal Module.php stubs today (see their own
 * docblocks), whose entire purpose right now is to be a real toggle here
 * and to gate `src/settings/Mcp.ts`'s/`Ai.ts`'s config fields via
 * `moduleEnabled`, replacing the "Enable MCP server"/"Enable AI
 * recommendations" Settings-tab toggles that used to duplicate this
 * same on/off state.
 */
export default {
	category: false,
	tab: 'modules',
	modules: [
		{
			id: 'cart',
			name: __( 'Cart', 'vulocart' ),
			desc: __(
				'The Cart Engine — add/update/remove line items, headless-ready via a client-held cart token.',
				'vulocart'
			),
			proModule: false,
		},
		{
			id: 'order',
			name: __( 'Order', 'vulocart' ),
			desc: __(
				'Turns a Cart into a placed Order — requires the Cart module to be active.',
				'vulocart'
			),
			proModule: false,
		},
		{
			id: 'customer',
			name: __( 'Customer', 'vulocart' ),
			desc: __(
				'Checkout wizard Customer step — prefills name/email/phone for a logged-in buyer.',
				'vulocart'
			),
			proModule: false,
		},
		{
			id: 'address',
			name: __( 'Address', 'vulocart' ),
			desc: __(
				'Checkout wizard Address step — billing/shipping address capture and validation.',
				'vulocart'
			),
			proModule: false,
		},
		{
			id: 'shipping',
			name: __( 'Shipping', 'vulocart' ),
			desc: __(
				'Checkout wizard Shipping step — flat-rate shipping cost, configured on the Shipping settings tab.',
				'vulocart'
			),
			proModule: false,
		},
		{
			id: 'taxes',
			name: __( 'Taxes', 'vulocart' ),
			desc: __(
				'Adds tax calculation to order totals, using a flat rate configured on the Taxes settings tab.',
				'vulocart'
			),
			proModule: false,
		},
		{
			id: 'payment',
			name: __( 'Payment', 'vulocart' ),
			desc: __(
				'Checkout wizard Payment step — manual/offline payment, configured on the Payments settings tab.',
				'vulocart'
			),
			proModule: false,
		},
		{
			id: 'review',
			name: __( 'Review', 'vulocart' ),
			desc: __(
				'Checkout wizard Review step — a real preview of the final order total before it\'s placed.',
				'vulocart'
			),
			proModule: false,
		},
		{
			id: 'confirmation',
			name: __( 'Confirmation', 'vulocart' ),
			desc: __(
				'The checkout wizard\'s post-order confirmation step — requires the Order module to be active.',
				'vulocart'
			),
			proModule: false,
		},
		{
			id: 'passport',
			name: __( 'Passport', 'vulocart' ),
			desc: __(
				'Serialized Digital Product Passports — authenticity verification, warranty, service/owner history, certificates, firmware, and a public passport page with QR/NFC sharing and PDF export.',
				'vulocart'
			),
			proModule: true,
		},
		{
			id: 'suppliers',
			name: __( 'Suppliers', 'vulocart' ),
			desc: __(
				'Track who each offering is sourced from — manage suppliers and assign one per offering.',
				'vulocart'
			),
			proModule: true,
		},
		{
			id: 'offering-templates',
			name: __( 'Offering Templates', 'vulocart' ),
			desc: __(
				'Save any offering\'s fields as a reusable preset, and start new offerings from it.',
				'vulocart'
			),
			proModule: true,
		},
		{
			id: 'pricing-rules',
			name: __( 'Pricing Rules', 'vulocart' ),
			desc: __(
				'Automatic percentage/fixed discounts scoped to all offerings, one type, one category, or one offering.',
				'vulocart'
			),
			proModule: true,
		},
		{
			id: 'variants',
			name: __( 'Variants', 'vulocart' ),
			desc: __(
				'Generate attribute-combination variants (e.g. Color × Size) with their own SKU/price/stock.',
				'vulocart'
			),
			proModule: true,
		},
		{
			id: 'bulk-editor',
			name: __( 'Bulk Editor', 'vulocart' ),
			desc: __(
				'A spreadsheet-style screen for editing price/status/stock across many offerings at once, plus Duplicate Offering.',
				'vulocart'
			),
			proModule: true,
		},
		{
			id: 'csv-import',
			name: __( 'Import CSV', 'vulocart' ),
			desc: __( 'Bulk-create offerings from a spreadsheet export, with column mapping and a preview.', 'vulocart' ),
			proModule: true,
		},
		{
			id: 'order-notes',
			name: __( 'Order Notes', 'vulocart' ),
			desc: __( 'Lets a buyer leave a note for their order at checkout, shown on the Order edit page.', 'vulocart' ),
			proModule: true,
		},
		{
			id: 'coupons',
			name: __( 'Coupons', 'vulocart' ),
			desc: __( 'Percentage/fixed discount codes a shopper can enter at checkout.', 'vulocart' ),
			proModule: true,
		},
		{
			id: 'gift-cards',
			name: __( 'Gift Cards', 'vulocart' ),
			desc: __( 'Stored-value codes a shopper can redeem, partially or fully, toward their order total.', 'vulocart' ),
			proModule: true,
		},
		{
			id: 'abandoned-checkout',
			name: __( 'Abandoned Checkout', 'vulocart' ),
			desc: __( 'A list of checkout sessions that were started but never completed.', 'vulocart' ),
			proModule: true,
		},
		{
			id: 'checkout-templates',
			name: __( 'Checkout Builder', 'vulocart' ),
			desc: __( 'Enable/disable and reorder checkout steps, saved as named, one-active-at-a-time templates.', 'vulocart' ),
			proModule: true,
		},
		{
			id: 'popup-checkout',
			name: __( 'Popup Checkout', 'vulocart' ),
			desc: __(
				'Opens checkout in a modal from any "data-vulocart-checkout-trigger" element on any page, not just the Checkout block.',
				'vulocart'
			),
			proModule: true,
		},
		{
			id: 'hosted-checkout',
			name: __( 'Hosted Checkout', 'vulocart' ),
			desc: __(
				'A dedicated /checkout/hosted/{cart_token}/ URL a shopper can be redirected to — not a WordPress page, no theme involved.',
				'vulocart'
			),
			proModule: true,
		},
		{
			id: 'one-click-checkout',
			name: __( 'One-Click Checkout', 'vulocart' ),
			desc: __(
				'Lets a returning buyer place an order instantly, reusing the address/shipping/payment from their last order under the same email.',
				'vulocart'
			),
			proModule: true,
		},
		{
			id: 'address-autocomplete',
			name: __( 'Address Autocomplete', 'vulocart' ),
			desc: __(
				'Suggests full addresses as a shopper types at checkout, via a pluggable lookup provider (none configured out of the box).',
				'vulocart'
			),
			proModule: true,
		},
		{
			id: 'embedded-checkout',
			name: __( 'Embedded Checkout', 'vulocart' ),
			desc: __(
				'Renders checkout inline into any "data-vulocart-embedded-checkout" container on any page — same-site only, see module docs for cross-domain embedding.',
				'vulocart'
			),
			proModule: true,
		},
		{
			id: 'drawer-checkout',
			name: __( 'Drawer Checkout', 'vulocart' ),
			desc: __(
				'Opens checkout in a slide-in side panel from any "data-vulocart-drawer-checkout-trigger" element, via the VuloCart SDK.',
				'vulocart'
			),
			proModule: true,
		},
		{
			id: 'checkout-links',
			name: __( 'Checkout Links & QR Codes', 'vulocart' ),
			desc: __(
				'Shareable payment/checkout links for a fixed set of offerings — a dedicated /pay/ URL, embeddable, or shown as a QR code.',
				'vulocart'
			),
			proModule: true,
		},
		{
			id: 'stripe',
			name: __( 'Stripe', 'vulocart' ),
			desc: __(
				'Accept credit/debit cards via Stripe — Payment Intents, saved cards for recurring billing, and partial capture/refund.',
				'vulocart'
			),
			proModule: true,
		},
		{
			id: 'paypal',
			name: __( 'PayPal', 'vulocart' ),
			desc: __( 'Accept payments via PayPal Checkout.', 'vulocart' ),
			proModule: true,
		},
		{
			id: 'razorpay',
			name: __( 'Razorpay', 'vulocart' ),
			desc: __( 'Accept payments via Razorpay Checkout.', 'vulocart' ),
			proModule: true,
		},
		{
			id: 'subscriptions',
			name: __( 'Subscriptions', 'vulocart' ),
			desc: __(
				'Recurring billing on top of a recurring-capable payment gateway — automatic renewal charges, dunning retries, and customer self-service.',
				'vulocart'
			),
			proModule: true,
		},
		{
			id: 'customer-growth',
			name: __( 'Customer Growth', 'vulocart' ),
			desc: __(
				'Wishlist, saved carts, manual groups, dynamic segments, a unified loyalty points/credits/wallet ledger (spendable at checkout), communication history, and a merged customer timeline.',
				'vulocart'
			),
			proModule: true,
		},
		{
			id: 'inventory',
			name: __( 'Inventory Engine', 'vulocart' ),
			desc: __(
				'Warehouses/locations, purchase orders, transfers, reservations, low-stock alerts, batch/serial tracking, a full inventory history ledger, and demand forecasting — stock decrements automatically on paid orders and stays synced with each offering\'s own stock field.',
				'vulocart'
			),
			proModule: true,
		},
		{
			id: 'shipping-engine',
			name: __( 'Shipping Engine', 'vulocart' ),
			desc: __(
				'Zone/weight-based rates on top of the free flat-rate fallback, packaging presets, multi-shipment fulfillment with tracking, a pluggable carrier/label framework, returns (RMA) with automatic refunds, and local pickup.',
				'vulocart'
			),
			proModule: true,
		},
		{
			id: 'mcp',
			name: __( 'MCP', 'vulocart' ),
			desc: __(
				'Model Context Protocol server — exposes VuloCart\'s catalog/orders to MCP-compatible AI clients.',
				'vulocart'
			),
			proModule: false,
		},
		{
			id: 'ai',
			name: __( 'AI', 'vulocart' ),
			desc: __(
				'AI-generated offering/upsell recommendations.',
				'vulocart'
			),
			proModule: false,
		},
	],
};
