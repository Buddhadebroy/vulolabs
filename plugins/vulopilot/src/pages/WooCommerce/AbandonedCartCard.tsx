import { __ } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent } from '@zyra/components';

/**
 * "Abandoned Cart Recovery" — entirely fabricated in the mockup (count,
 * Recoverable/Lost/Recovering split, "$2,420 potential recovery"). Zero
 * backing anywhere reachable from this plugin: WooCommerce core has no
 * cart-abandonment tracking of its own, and the only abandoned-cart/
 * checkout-session code in this whole monorepo lives in the sibling
 * `vulocart`/`vulocart-pro` plugins — a structurally separate product
 * line with no shared REST namespace or cross-plugin data access (see
 * both plugins' own CLAUDE.md). One honest empty state for the whole
 * section, same treatment Improve Speed gave its own entirely-fabricated
 * Real-time Monitoring section.
 */
const AbandonedCartCard = () => {
	return (
		<CardComponent title={__('Abandoned Cart Recovery', 'vulopilot')} titleIcon="cart">
			<ModuleGuardComponent
				icon="info"
				title={__('Abandoned cart tracking isn’t built yet', 'vulopilot')}
				desc={__(
					'This plugin doesn’t track cart abandonment — flag if you want it scoped next.',
					'vulopilot'
				)}
			/>
		</CardComponent>
	);
};

export default AbandonedCartCard;
