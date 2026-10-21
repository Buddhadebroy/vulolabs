export {};

/**
 * VuloCart's own admin-page localizer - deliberately not `appLocalizer`
 * (a different plugin's shape, react-frontend.md documents it for
 * shared-platform plugins). See classes/Admin/Menu.php's wp_localize_script()
 * call for where this comes from.
 *
 * `apiUrl` is the bare REST root and `restUrl` is the `vulocart/v1`
 * namespace - not one combined base URL - because this object is also
 * passed straight into zyra's `configureZyra()`, whose own `getApiLink()`
 * composes `${apiUrl}/${restUrl}/${endpoint}` under those exact property
 * names (see src/index.tsx). `khali_dabba`/`active_plugins`/`shop_url`/
 * `site_url` are the other zyra-config fields it reads (e.g.
 * `ModuleGridComponent`'s pro-module gating, required-plugin checks).
 */
interface VuloCartLocalizer {
	apiUrl: string;
	restUrl: string;
	nonce: string;
	adminUrl: string;
	active_modules: string[];
	khali_dabba: boolean;
	/** Product types the merchant switched off (Product Types screen). */
	disabled_product_types?: string[];
	ask_product_type?: boolean;
	version: string;
	pro_version: string | null;
	active_plugins: string[];
	shop_url: string;
	site_url: string;
	/** Display name of the signed-in user (Dashboard greeting). */
	user_display_name?: string;
	/** Settings → General date format, PHP `date()` syntax (services/formatWpDate.ts). */
	date_format: string;
	/** Settings → General time format, PHP `date()` syntax. */
	time_format: string;
	/** Settings → General timezone, as minutes offset from UTC. */
	gmt_offset_minutes: number;
}

/**
 * Printed unconditionally on every frontend page load (classes/Block.php's
 * `print_frontend_config()`) - a separate, much smaller global than
 * `VuloCartLocalizer` above, since frontend blocks (src/blocks/*) have no
 * wp-admin context, no nonce (Cart/Order's REST routes are deliberately
 * public - see classes/RestAPI/Controllers/Cart.php's own docblock), and
 * don't need zyra's config shape at all.
 *
 * `guestCheckoutEnabled`/`requireTermsAcceptance`/`requirePhoneNumber`/
 * `checkoutTermsUrl`/`isLoggedIn` are the Settings screen's Commerce/
 * Checkout tab (src/settings/Commerce/Checkout.ts) made real: src/blocks/
 * checkout/Checkout.tsx enforces both client-side (also enforced again
 * server-side by modules/Order/Rest.php's `create_item()` for
 * `guestCheckoutEnabled`/`requirePhoneNumber` - a client-only check isn't
 * real enforcement against a direct API call).
 * `checkoutPageUrl`/`productsPageUrl` are auto-discovered (`Block.php`'s
 * `find_page_url_with_block()`), not merchant-configured - null until a
 * published page/post actually contains that block.
 */
interface VuloCartFrontendData {
	apiUrl: string;
	restUrl: string;
	guestCheckoutEnabled: boolean;
	requireTermsAcceptance: boolean;
	requirePhoneNumber: boolean;
	checkoutTermsUrl: string;
	isLoggedIn: boolean;
	listingTemplate: 'grid' | 'compact' | 'list' | 'showcase';
	listingColumns: number;
	checkoutPageUrl: string | null;
	productsPageUrl: string | null;
	/** The page holding the `vulocart/cart` block, when one exists. */
	cartPageUrl: string | null;
	/** The shop page (Product Collection block, else the legacy products block). */
	shopPageUrl: string | null;
	/** `single_page`|`multi_step` - Domain\Checkout\CheckoutMode::free()'s own two values, read by Checkout.tsx to pick which mode it mounts CheckoutEngine in. */
	checkoutMode: string;
	/** `page` or a vulocart-pro style: popup, drawer, hosted, one_click. */
	checkoutDelivery: string;
	/** The checkout steps Settings → Checkout turned on, in order (Customer and Payment always). */
	checkoutSteps: string[];
	/** The optional checkout fields turned on: name, phone, address_2. */
	checkoutFields: string[];
	homeUrl: string;
	userEmail: string;
	/** The WordPress session: a signed-in user's details with a sign-out link, or just a login link for a guest. */
	currentUser: { name?: string; email?: string; avatar?: string; logoutUrl?: string; loginUrl?: string } | null;
}

declare global {
	var vulocartLocalizer: VuloCartLocalizer;
	var vulocartFrontendData: VuloCartFrontendData;
}
