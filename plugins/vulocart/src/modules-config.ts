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
				'Give every Offering a Digital Passport — serial number, manufacturer, warranty, and other provenance details.',
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
