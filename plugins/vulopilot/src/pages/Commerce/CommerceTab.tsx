import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	PopupComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { scrollToId } from '@zyra/core';
import ShowProPopup from '../../components/Popup/Popup';
import { useFilterSlot } from '../../services/useFilterSlot';
import { useWooCommerceFindingGroups } from './useWooCommerceFindingGroups';
import StoreHealthBanner from './StoreHealthBanner';
import StoreOverviewCards from './StoreOverviewCards';
import CommerceCategoryGrid from './CommerceCategoryGrid';
import TopIssuesToWorkOn from './TopIssuesToWorkOn';
import AiSalesOptimizerCard from './AiSalesOptimizerCard';
import AiSalesAssistantCard from './AiSalesAssistantCard';
import StoreIntelligenceSummaryCard from './StoreIntelligenceSummaryCard';
import ProductsToLookAtCard from './ProductsToLookAtCard';
import CommerceIssuesTable, {
	CommerceIssueTab,
} from './CommerceIssuesTable';
import './Commerce.scss';

/**
 * Visible teaser for the bulk-optimize panel above — shown instead of it
 * when `WooCommerceAiPanel` isn't registered, so the feature is
 * discoverable rather than simply absent. Now only actually reachable by
 * genuinely unlicensed sites: `VuloPilotPro::seed_woocommerce_modules_active()`
 * auto-activates the real 'woo-commerce-ai' module for any licensed site
 * (it has no toggle card on the Modules page — see
 * src/components/Modules/index.ts's own docblock — so before that fix, no
 * admin, licensed or not, had any way to turn it on and this teaser showed
 * unconditionally). The popup below always renders the generic upgrade
 * pitch (no `moduleName`) even when `khali_dabba` is true — 'woo-commerce-ai'
 * has no Modules-page card to deep-link to (Popup.tsx's own catalog
 * deliberately dropped it, same "exactly 13 modules" decision), so passing
 * that moduleName would point "Enable Now" at a tab with nothing to click.
 */
const WooCommerceAiLockedCard = () => {
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);

	return (
		<>
			<CardComponent
				className="ai-card"
				title={__('Bulk AI optimization', 'vulopilot')}
				titleIcon="ai"
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
				<ShowProPopup />
			</PopupComponent>
		</>
	);
};

/**
 * Visible teaser for the panel above — same click-to-open pattern
 * WooCommerceAiLockedCard already uses, and the same fix applies: real
 * for genuinely unlicensed sites only, since
 * `VuloPilotPro::seed_woocommerce_modules_active()` now auto-activates
 * 'woo-commerce-intelligence' for any licensed site. Same generic-popup
 * fix as WooCommerceAiLockedCard above — 'woo-commerce-intelligence' has
 * no Modules-page card either.
 */
const WooCommerceIntelligenceLockedCard = () => {
	const [isProPopupOpen, setIsProPopupOpen] = useState(false);

	return (
		<>
			<CardComponent
				title={__('Store intelligence', 'vulopilot')}
				titleIcon="ai"
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
				<ShowProPopup />
			</PopupComponent>
		</>
	);
};

/**
 * "Commerce" page's own content — a real store-health overview
 * (CommerceCategoryGrid/StoreOverviewCards/StoreHealthBanner/
 * TopIssuesToWorkOn/AiSalesOptimizerCard/StoreIntelligenceSummaryCard/
 * CommerceIssuesTable, all real data — see each file's own docblock)
 * on top of the original page's two Pro panel slots and issues table,
 * kept unchanged below. StoreHealthBanner + CommerceCategoryGrid
 * (grid 8) and StoreOverviewCards/"At a Glance" (grid 4) sit side by side
 * in their own nested ContainerComponent, same "one real component reused
 * on two tabs" pattern OverviewTab.tsx already uses for StoreOverviewCards
 * — "View Full Report →" is repurposed here to scroll to this tab's own
 * issues table (goToIssuesTab) rather than navigate to itself, since this
 * already is the WooCommerce tab. TopIssuesToWorkOn ("What should I work
 * on first?") sits directly below that row. "Store Readiness"
 * (shop/cart/checkout/my-account page + HTTPS
 * status) used to be its own standalone card here; it's now the first
 * card inside CommerceCategoryGrid instead, matching that grid's card
 * style rather than sitting as a separate-looking section (its
 * `id="store-readiness"` scroll anchor moved there too — see
 * StoreHealthBanner's onViewSummary below). `groups` (`GET /findings/
 * groups?category=woocommerce`) is fetched once here and threaded down to
 * every section that needs it, rather than each one re-fetching the same
 * real data independently. ProductsToLookAtCard (real example products per
 * risk category) and AiSalesAssistantCard (moved here from OverviewTab.tsx
 * so its "Let AI Optimize My Store"/"Review Suggestions First" actions
 * point at destinations that actually live on this tab) sit right before
 * the real "Bulk AI optimization" panel (`#woocommerce-bulk-ai`) they both
 * lead into.
 */
const CommerceTab = () => {
	const [activeIssueTab, setActiveIssueTab] =
		useState<CommerceIssueTab>('all');
	const { groups, isLoading: isLoadingGroups } = useWooCommerceFindingGroups();

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

	const goToIssuesTab = (tab: CommerceIssueTab) => {
		setActiveIssueTab(tab);
		setTimeout(() => scrollToId('woocommerce-issues-table'), 50);
	};

	return (
		<>
			<ColumnComponent row>
				<StoreHealthBanner
					onReviewIssues={() => goToIssuesTab('important')}
					onViewSummary={() => scrollToId('store-readiness')}
				/>
				<StoreOverviewCards
					onNavigateToCommerceTab={() => goToIssuesTab('important')}
				/>
			</ColumnComponent>
			<ColumnComponent>
				<CommerceCategoryGrid
					groups={groups}
					isLoadingGroups={isLoadingGroups}
					onReviewTab={goToIssuesTab}
				/>
			</ColumnComponent>

			<ColumnComponent grid={8}> 
				<TopIssuesToWorkOn
					groups={groups}
					isLoading={isLoadingGroups}
					onViewAll={() => goToIssuesTab('important')}
				/>
			</ColumnComponent>

			<ColumnComponent fullHeight grid={4}>
				<AiSalesOptimizerCard
					onFindOpportunities={() => scrollToId('woocommerce-bulk-ai')}
				/>
			</ColumnComponent>
			<ColumnComponent fullHeight grid={6}>
				<StoreIntelligenceSummaryCard
					onExploreInsights={() =>
						scrollToId('store-intelligence-panel')
					}
					onReviewTab={goToIssuesTab}
					onFindOpportunities={() => scrollToId('woocommerce-bulk-ai')}
				/>
			</ColumnComponent>			
			
			<ProductsToLookAtCard />

			{/* AI Sales Assistant */}
			<AiSalesAssistantCard
				onOptimizeStore={() => scrollToId('woocommerce-bulk-ai')}
				onReviewIssues={() => goToIssuesTab('important')}
			/>

			<ColumnComponent>
				<CommerceIssuesTable
					groups={groups}
					activeTab={activeIssueTab}
					onTabChange={setActiveIssueTab}
				/>
			</ColumnComponent>
			<ColumnComponent grid={6}>
				<div id="woocommerce-bulk-ai">
					{WooCommerceAiPanel ? (
						<WooCommerceAiPanel />
					) : (
						<WooCommerceAiLockedCard />
					)}
				</div>
			</ColumnComponent>
			{WooCommerceIntelligencePanel ? (
				// Real panel — WooCommerceIntelligencePanel.tsx (Pro) owns its
				// own 3 `<ColumnComponent grid={6}>` cells (one per card:
				// RevenueInsightsCard/StoreTrendsChart/InventoryIntelligenceCard),
				// so it renders unwrapped here — a Column wrapping a Column
				// would size against the inner Column's own already-halved
				// width instead of this ContainerComponent's real width.
				<WooCommerceIntelligencePanel />
			) : (
				<ColumnComponent grid={6}>
					<div id="store-intelligence-panel">
						<WooCommerceIntelligenceLockedCard />
					</div>
				</ColumnComponent>
			)}
		</>
	);
};

export default CommerceTab;
