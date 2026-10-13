import { __ } from '@wordpress/i18n';
import { renderEngineView, type EngineView } from '../../components/EngineScreen/EngineScreen';

interface WorkflowsEngineProps {
	/** `list`|`edit`|`runs` (vulocart-pro's Workflow Builder module) - anything else shows `list`. */
	view: string | null;
}

const workflows: EngineView = {
	title: __( 'Workflows', 'vulocart' ),
	description: __(
		'Automate what happens after an order, payment, refund, low-stock alert, new customer, delivered shipment, or AI event.',
		'vulocart'
	),
	icon: 'automation',
	module: 'workflow-builder',
	pro: true,
};

const views: Record< string, EngineView > = { list: workflows, edit: workflows, runs: workflows };

/** Free owns the frame; the Workflow Builder module (vulocart-pro) registers every view into `vulocart_workflows_view`. */
export function WorkflowsEngine( { view }: WorkflowsEngineProps ) {
	const resolvedView = view && views[ view ] ? view : 'list';
	const id = new URLSearchParams( window.location.search ).get( 'id' );

	return renderEngineView( 'vulocart_workflows_view', views, resolvedView, { id: id ? Number( id ) : null } );
}

export default WorkflowsEngine;
