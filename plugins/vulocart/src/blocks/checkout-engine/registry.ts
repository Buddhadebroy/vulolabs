import type { ReactNode } from 'react';
import type { CartResponse } from '../shared/cart';

/**
 * The shared, mutable data bag every checkout step reads from and writes
 * to via `update()` — deliberately untyped/open (`Record<string, unknown>`)
 * at the engine level rather than one big interface CheckoutEngine.tsx
 * would have to know every field of: a step this plugin has never heard
 * of (a future vulocart-pro one) can add its own keys without this file
 * changing. Each step component casts the slice it actually cares about.
 */
export type CheckoutRunData = Record< string, unknown >;

export interface CheckoutStepContext {
	cartToken: string;
	cart: CartResponse | null;
	data: CheckoutRunData;
	update: ( patch: CheckoutRunData ) => void;
	/** Lets a step decide whether to render its own Back/Continue controls — single-page mode shows every step at once with no per-step navigation, only Review's own "Place Order". */
	mode: 'single_page' | 'multi_step';
	/**
	 * Multi-step mode only — advances to the next registered step. A
	 * step's own `render()` calls this itself (from its own "Continue"
	 * button) rather than the engine deciding when a step is "done", since
	 * only the step knows what "done" means for its own fields. No-op
	 * effect in single-page mode (there is no "next"), but still safe to
	 * call — Review's own "Place Order" flow doesn't call it at all, it
	 * calls `onPlaceOrder` instead.
	 */
	goNext: () => void;
	/** Multi-step mode only — returns to the previous step. No-op in single-page mode. */
	goBack: () => void;
	/** Only meaningful for the Review step's own render() — triggers order placement. */
	onPlaceOrder: () => void;
	isFirstStep: boolean;
	isLastStep: boolean;
}

export interface CheckoutStepDefinition {
	id: string;
	render: ( context: CheckoutStepContext ) => ReactNode;
}

/**
 * A Pro (or any third-party) module extending an EXISTING step's own
 * render rather than registering a whole new one — e.g. vulocart-pro's
 * Order Notes adds a textarea inside Review's own summary, it doesn't
 * need its own navigable step. Same "compose, don't replace" reasoning
 * `vulocart_offering_edit_sections` already establishes on the admin
 * side, just as a plain function list here instead of a
 * `@wordpress/hooks` filter chain.
 */
export type CheckoutStepExtension = ( context: CheckoutStepContext ) => ReactNode;

/**
 * Fired once, right after `POST /orders` succeeds and before
 * CheckoutEngine.tsx switches to rendering the Confirmation step alone —
 * the extension point Order Notes/Coupons/Gift Cards' redemption-recording
 * all need ("the order now has a real id, do something with it") that a
 * plain step can't provide on its own, since a step (and any step
 * extension) stops being rendered the instant confirmation appears.
 * Handlers are awaited (in parallel, not sequence) but never block
 * showing the confirmation screen — a slow or failing handler degrades
 * gracefully, it doesn't strand the shopper on a spinner after they've
 * already been charged.
 */
export type OrderPlacedHandler = (
	order: Record< string, unknown >,
	data: CheckoutRunData,
	cartToken: string
) => void | Promise< void >;

/**
 * The client-side half of the Checkout Engine's pluggability —
 * server-side discovery (`GET /checkout/steps`,
 * RestAPI\Controllers\Checkout.php) tells the engine WHICH step ids exist
 * and in what order; this registry is what actually resolves a step id to
 * a renderable React component. `registerCheckoutStep()` is a plain
 * module-level call (not a `@wordpress/hooks` filter) since step
 * registration only ever needs to run once, before CheckoutEngine.tsx
 * mounts, with no need for multiple registrants to compose/override a
 * single STEP id the way `vulocart_offering_edit_sections` does — step
 * EXTENSIONS (content injected into an existing step) are the compose-many
 * case instead, via `registerCheckoutStepExtension()`.
 *
 * Free's own checkout block bundle (steps/*.tsx, imported once from
 * Checkout.tsx) registers directly, as plain module-level calls — this
 * plugin's storefront has one webpack entry, unlike its wp-admin bundle
 * which vulocart-pro's own separately-loaded bundle can inject filters
 * into. A vulocart-pro storefront delivery mode or checkout-step
 * extension (Order Notes/Coupons/Gift Cards) can't import this module
 * directly (separate webpack build, no shared module resolution — same
 * "no cross-plugin `use`" posture the PHP side already has), so this
 * whole registry is also exposed as `window.vulocartCheckoutEngine` —
 * Free's own checkout block bundle attaches it there, and
 * vulocart-pro's own storefront script (enqueued via Free's
 * `vulocart_frontend_config_printed` action, Block.php's own docblock)
 * calls it from that global the same way `vulocartLocalizer`/
 * `vulocartFrontendData` already bridge config across the same plugin
 * boundary.
 */
const registry = new Map< string, CheckoutStepDefinition >();
const extensions = new Map< string, CheckoutStepExtension[] >();
const orderPlacedHandlers: OrderPlacedHandler[] = [];

export function registerCheckoutStep( definition: CheckoutStepDefinition ): void {
	registry.set( definition.id, definition );
}

export function getCheckoutStep( id: string ): CheckoutStepDefinition | undefined {
	return registry.get( id );
}

export function registerCheckoutStepExtension( stepId: string, extension: CheckoutStepExtension ): void {
	extensions.set( stepId, [ ...( extensions.get( stepId ) || [] ), extension ] );
}

export function getCheckoutStepExtensions( stepId: string ): CheckoutStepExtension[] {
	return extensions.get( stepId ) || [];
}

export function registerOrderPlacedHandler( handler: OrderPlacedHandler ): void {
	orderPlacedHandlers.push( handler );
}

export function getOrderPlacedHandlers(): OrderPlacedHandler[] {
	return orderPlacedHandlers;
}

declare global {
	interface Window {
		vulocartCheckoutEngine?: {
			registerCheckoutStep: typeof registerCheckoutStep;
			registerCheckoutStepExtension: typeof registerCheckoutStepExtension;
			registerOrderPlacedHandler: typeof registerOrderPlacedHandler;
			/** Set by mount.tsx, not this file — registry.ts alone doesn't import CheckoutEngine.tsx (that'd be a circular import: mount.tsx -> CheckoutEngine.tsx -> registry.ts). Undefined until whatever entry pulls mount.tsx in has run (Checkout.tsx's own import does, always). */
			mount?: ( container: HTMLElement, options: Record< string, unknown > ) => void;
			unmount?: ( container: HTMLElement ) => void;
		};
	}
}

window.vulocartCheckoutEngine = {
	registerCheckoutStep,
	registerCheckoutStepExtension,
	registerOrderPlacedHandler,
};
