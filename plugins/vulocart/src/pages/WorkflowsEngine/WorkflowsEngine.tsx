import { applyFilters } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';

interface WorkflowsEngineProps {
	/** `list`|`edit`|`runs` (vulocart-pro's own WorkflowBuilder module) — anything else falls back to the empty state below. */
	view: string | null;
}

/**
 * Free owns this top-level menu's chrome only — same "Pro fills it in via
 * a filtered router" shape `ShippingEngine.tsx`/`AiEngine.tsx` already
 * establish. Unlike AI's own menu, Free has no view of its own here at
 * all (no BYOK-style config Free itself owns) — every real view is
 * registered by vulocart-pro's WorkflowBuilder module.
 */
export function WorkflowsEngine( { view }: WorkflowsEngineProps ) {
	const resolvedView = view || 'list';
	const id = new URLSearchParams( window.location.search ).get( 'id' );
	const extra = applyFilters( 'vulocart_workflows_view', null, { view: resolvedView, id: id ? Number( id ) : null } );

	if ( extra ) {
		return <>{ extra }</>;
	}

	return (
		<div className="vulocart-workflows-empty-state">
			<h1>{ __( 'Workflows', 'vulocart' ) }</h1>
			<p>
				{ __(
					'Automate what happens after an order, payment, refund, low-stock alert, new customer, delivered shipment, or AI event — activate the Workflow Builder module to use this page.',
					'vulocart'
				) }
			</p>
		</div>
	);
}

export default WorkflowsEngine;
