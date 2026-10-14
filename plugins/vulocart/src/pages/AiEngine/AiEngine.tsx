import { __ } from '@wordpress/i18n';
import type { EngineView } from '../../components/EngineScreen/EngineScreen';
import { EngineTabs } from '../../components/EngineScreen/EngineTabs';

interface AiEngineProps {
	/** One of `catalog`|`checkout`|`support`|`search` (vulocart-pro's AI feature modules) - anything else shows Catalog AI. */
	view: string | null;
}

const views: Record< string, EngineView > = {
	catalog: {
		title: __( 'Catalog', 'vulocart' ),
		description: __( 'Describe a product and Catalog AI drafts a new product (title, description, price) - nothing is published automatically.', 'vulocart' ),
		icon: 'ai',
		module: 'catalog-ai',
		pro: true,
	},
	checkout: {
		title: __( 'Checkout', 'vulocart' ),
		description: __( 'Scores every checkout for fraud risk and queues the risky ones for review.', 'vulocart' ),
		icon: 'ai',
		module: 'checkout-ai',
		pro: true,
	},
	support: {
		title: __( 'Support', 'vulocart' ),
		description: __( 'Drafts replies to customer questions from your catalog and order data.', 'vulocart' ),
		icon: 'ai',
		module: 'support-ai',
		pro: true,
	},
	search: {
		title: __( 'Search', 'vulocart' ),
		description: __( 'Semantic search over your catalog - finds products by meaning, not just exact keyword matches.', 'vulocart' ),
		icon: 'ai',
		module: 'vector-search',
		pro: true,
	},
};

/** The page's own header - the four AI features are tabs under it, not separate menu pages. */
const pageHeader: EngineView = {
	title: __( 'AI', 'vulocart' ),
	description: __( 'AI tools for your catalog, checkout, support and search. Connecting AI (VuloCloud) is under Settings → Integrations.', 'vulocart' ),
	icon: 'ai',
	module: 'ai',
};

/** One AI page with a tab per feature - the modules' content comes from `vulocart_ai_view`. */
export function AiEngine( { view }: AiEngineProps ) {
	return <EngineTabs header={ pageHeader } views={ views } filterName="vulocart_ai_view" view={ view } />;
}

export default AiEngine;
