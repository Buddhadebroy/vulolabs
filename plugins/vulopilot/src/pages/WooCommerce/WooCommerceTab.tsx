/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import type { ComponentType } from 'react';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	PopupComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import FindingsTable from '../../components/FindingsTable';
import ShowProPopup from '../../components/Popup/Popup';

/**
 * Slot for vulopilot-pro's WooCommerceAi module — "AI Blog Generation" and
 * "Bulk AI Optimization" (readme.txt) are Pro business logic, so their
 * management UI is injected here rather than built into Free's own
 * bundle. Shows a locked placeholder (below, `WooCommerceAiLockedCard`)
 * that opens the Pro popup on click when Pro/WooCommerceAi isn't active,
 * rather than rendering nothing — same click-to-open pattern
 * AIAssistant.tsx's AiAnalyticsLockedCard/Automation.tsx already use,
 * consistent across every Pro-gated panel slot in this plugin.
 */
const WooCommerceAiPanel = applyFilters(
	'vulopilot_woocommerce_ai_panel',
	null
) as ComponentType | null;

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
					// pitching an upgrade the user already has.
					<ShowProPopup moduleName="woocommerce-intelligence" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</>
	);
};

/**
 * Slot for vulopilot-pro's WooCommerceIntelligence module —
 * "Inventory Intelligence" (stockout prediction), "Store Trends"
 * (revenue/order history), and "Revenue Insights" (current-period
 * breakdown) per WOOCOMMERCE-INTELLIGENCE-MODULE.md, bundled behind one
 * slot the same way WooCommerceAiPanel above is one slot for its whole
 * feature set rather than one slot per action.
 */
const WooCommerceIntelligencePanel = applyFilters(
	'vulopilot_woocommerce_intelligence_panel',
	null
) as ComponentType | null;

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
					<ShowProPopup moduleName="woocommerce-intelligence" />
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
