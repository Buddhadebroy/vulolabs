/* global vulocartFrontendData */

/** What a checkout shows: which steps (in order) and which optional fields. */
export interface CheckoutOptions {
	steps: string[];
	fields: string[];
}

/** The steps the Settings → Checkout and block controls manage; any other step a module adds is left alone. */
export const MANAGED_STEPS = [ 'customer', 'address', 'shipping', 'payment', 'review' ];
export const OPTIONAL_FIELDS = [ 'name', 'phone', 'address_2' ];

/** The store owner's choice in Settings → Checkout. */
function siteOptions(): CheckoutOptions {
	const data = window.vulocartFrontendData;

	return { steps: data?.checkoutSteps ?? MANAGED_STEPS, fields: data?.checkoutFields ?? OPTIONAL_FIELDS };
}

let current: CheckoutOptions = siteOptions();

/**
 * Sets what the engine on this page shows: the site's settings, with whatever the checkout block overrides. The steps
 * are plain functions (not components), so the options live here rather than in React context.
 */
export function setCheckoutOptions( override?: Partial< CheckoutOptions > ): void {
	current = { ...siteOptions(), ...override };
}

/** Whether the checkout currently shows the given optional field (name, phone or address_2). */
export const hasCheckoutField = ( field: string ): boolean => current.fields.includes( field );

/**
 * The server's steps, limited and ordered by the chosen list. A step that is not one of the managed ones (added by a
 * module) keeps its place; Confirmation is never touched.
 */
export function applyStepOptions< T extends { id: string } >( steps: T[] ): T[] {
	const chosen = current.steps;
	const managed = steps.filter( ( step ) => chosen.includes( step.id ) ).sort( ( a, b ) => chosen.indexOf( a.id ) - chosen.indexOf( b.id ) );
	let next = 0;

	return steps.flatMap( ( step ) => {
		if ( ! MANAGED_STEPS.includes( step.id ) ) {
			return [ step ];
		}

		return chosen.includes( step.id ) ? [ managed[ next++ ] ] : [];
	} );
}
