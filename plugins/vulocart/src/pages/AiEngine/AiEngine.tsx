import { __ } from '@wordpress/i18n';
import { renderEngineView, type EngineView } from '../../components/EngineScreen/EngineScreen';

interface AiEngineProps {
	/** One of `catalog`|`checkout`|`support`|`search` (vulocart-pro's AI feature modules) - anything else shows Catalog AI. */
	view: string | null;
}

const views: Record< string, EngineView > = {
	catalog: {
		title: __( 'Catalog AI', 'vulocart' ),
		description: __( 'Describe a product and Catalog AI drafts a new offering (title, description, price) - nothing is published automatically.', 'vulocart' ),
		icon: 'ai',
		module: 'catalog-ai',
		pro: true,
	},
	checkout: {
		title: __( 'Checkout AI', 'vulocart' ),
		description: __( 'Scores every checkout for fraud risk and queues the risky ones for review.', 'vulocart' ),
		icon: 'ai',
		module: 'checkout-ai',
		pro: true,
	},
	support: {
		title: __( 'Support AI', 'vulocart' ),
		description: __( 'Drafts replies to customer questions from your catalog and order data.', 'vulocart' ),
		icon: 'ai',
		module: 'support-ai',
		pro: true,
	},
	search: {
		title: __( 'Vector Search', 'vulocart' ),
		description: __( 'Semantic search over your catalog - finds offerings by meaning, not just exact keyword matches.', 'vulocart' ),
		icon: 'ai',
		module: 'vector-search',
		pro: true,
	},
};

/**
 * Free owns this menu's frame only; the AI feature views are registered by vulocart-pro's modules
 * into `vulocart_ai_view`. Connecting AI (VuloCloud) is configured under Settings → Integrations,
 * not here.
 */
export function AiEngine( { view }: AiEngineProps ) {
	const resolvedView = view && views[ view ] ? view : 'catalog';

	return renderEngineView( 'vulocart_ai_view', views, resolvedView );
}

export default AiEngine;
