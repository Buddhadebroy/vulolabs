import { applyFilters } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';

interface AnalyticsEngineProps {
	/** vulocart-pro's own Analytics module registers the one real view here. */
	view: string | null;
}

/**
 * Free owns this top-level menu's chrome only — same "Pro fills it in
 * via a filtered router" shape `WorkflowsEngine.tsx`'s own docblock
 * documents. Free has no view of its own here (same as Workflows) —
 * every section is vulocart-pro's own Analytics module.
 */
export function AnalyticsEngine( { view }: AnalyticsEngineProps ) {
	const extra = applyFilters( 'vulocart_analytics_view', null, { view: view || 'dashboard' } );

	if ( extra ) {
		return <>{ extra }</>;
	}

	return (
		<div className="vulocart-analytics-empty-state">
			<h1>{ __( 'Analytics', 'vulocart' ) }</h1>
			<p>
				{ __(
					'Sales, revenue, customers, offerings, funnels, abandonment, conversion, LTV, retention, inventory, AI insights, and forecasts — activate the Analytics module to use this page.',
					'vulocart'
				) }
			</p>
		</div>
	);
}

export default AnalyticsEngine;
