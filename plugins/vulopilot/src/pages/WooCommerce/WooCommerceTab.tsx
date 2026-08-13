/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	PopupComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import FindingsTable from '../../components/FindingsTable';
import ShowProPopup from '../../components/Popup/Popup';
import { useFilterSlot } from '../../services/useFilterSlot';

/**
 * Visible teaser for the bulk-optimize panel above — shown instead of it
 * when `WooCommerceAiPanel` isn't registered, so the feature is
 * discoverable rather than simply absent.
 */
const WooCommerceAiLockedCard = () => {
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);

	return (
		<>
			<CardComponent
				title={__('Bulk AI optimization', 'vulopilot')}
				desc={__(
					'Rewrite titles, generate descriptions/FAQ/schema, and suggest cross-sell/upsell/bundles across a batch of products at once.',
					'vulopilot'
				)}
			>
				<ButtonInput
					buttons={{
						text: __('Unlock with Pro', 'vulopilot'),
						icon: 'lock',
						onClick: () => setIsProPopupOpen(true),
					}}
				/>
			</CardComponent>
			<PopupComponent
				open={isProPopupOpen}
				onClose={() => setIsProPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{appLocalizer.khali_dabba ? (
					// Pro is active — this specific module just isn't
					// toggled on yet, so point at Modules rather than
					// pitching an upgrade the user already has. Real
					// backend id (WooCommerceAi's folder kebab-cased —
					// see src/components/Modules/index.ts's own
					// 'woo-commerce-ai' entry) — this previously pointed
					// at 'woocommerce-intelligence', both the wrong module
					// AND an id no real module resolves to.
					<ShowProPopup moduleName="woo-commerce-ai" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</>
	);
};

/**
 * Visible teaser for the panel above — same click-to-open pattern
 * WooCommerceAiLockedCard already uses.
 */
const WooCommerceIntelligenceLockedCard = () => {
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);

	return (
		<>
			<CardComponent
				title={__('Store intelligence', 'vulopilot')}
				desc={__(
					'Stockout prediction, revenue trend history, and a current-period revenue breakdown for your store.',
					'vulopilot'
				)}
			>
				<ButtonInput
					buttons={{
						text: __('Unlock with Pro', 'vulopilot'),
						icon: 'lock',
						onClick: () => setIsProPopupOpen(true),
					}}
				/>
			</CardComponent>
			<PopupComponent
				open={isProPopupOpen}
				onClose={() => setIsProPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{appLocalizer.khali_dabba ? (
					// Real backend id (see the ShowProPopup usage above for
					// why this can't be 'woocommerce-intelligence').
					<ShowProPopup moduleName="woo-commerce-intelligence" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</>
	);
};

/**
 * "WooCommerce" tab of "Sell More" — body extracted verbatim from the
 * former standalone WooCommerce.tsx page (same "extract body, drop the
 * header" move every other tab on this page already made) — its own
 * NavigatorHeaderComponent now lives once on WooCommerce.tsx's shared
 * tab-shell header.
 */
const WooCommerceTab = () => {
	/**
	 * Both Pro panel slots — read via useFilterSlot(), not a plain
	 * module-scope applyFilters() call (that hook's own docblock explains
	 * why: Pro's addFilter() calls always run strictly after this page's
	 * own code on a fresh load, so a one-time read here would permanently
	 * miss them — confirmed live: both slots stayed stuck on their locked
	 * teaser even with WooCommerceAi/WooCommerceIntelligence genuinely
	 * active, exactly as that hook's docblock describes for GeoTab.tsx's
	 * own slots).
	 */
	const WooCommerceAiPanel = useFilterSlot('vulopilot_woocommerce_ai_panel');
	const WooCommerceIntelligencePanel = useFilterSlot(
		'vulopilot_woocommerce_intelligence_panel'
	);

	return (
		<ContainerComponent general>
			<ColumnComponent>
				{WooCommerceAiPanel ? (
					<WooCommerceAiPanel />
				) : (
					<WooCommerceAiLockedCard />
				)}
				{WooCommerceIntelligencePanel ? (
					<WooCommerceIntelligencePanel />
				) : (
					<WooCommerceIntelligenceLockedCard />
				)}
				<FindingsTable
					title={__('WooCommerce', 'vulopilot')}
					description={__(
						'No WooCommerce findings yet — run a scan to check store settings, product data, and checkout health.',
						'vulopilot'
					)}
					category="woocommerce"
				/>
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default WooCommerceTab;
