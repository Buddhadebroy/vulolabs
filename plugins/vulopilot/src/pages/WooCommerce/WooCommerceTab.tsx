import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	PopupComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import ShowProPopup from '../../components/Popup/Popup';
import { useFilterSlot } from '../../services/useFilterSlot';
import { useWooCommerceFindingGroups } from './useWooCommerceFindingGroups';
import StoreHealthBanner from './StoreHealthBanner';
import StoreOverviewCards from './StoreOverviewCards';
import WooCommerceCategoryGrid from './WooCommerceCategoryGrid';
import TopIssuesToWorkOn from './TopIssuesToWorkOn';
import AiSalesOptimizerCard from './AiSalesOptimizerCard';
import AiSalesAssistantCard from './AiSalesAssistantCard';
import StoreIntelligenceSummaryCard from './StoreIntelligenceSummaryCard';
import ProductsToLookAtCard from './ProductsToLookAtCard';
import WooCommerceIssuesTable, {
	WooCommerceIssueTab,
} from './WooCommerceIssuesTable';
import './SellMore.scss';

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

/** Smooth-scrolls to an id, same OpenIssuesGlimpse-style highlight flash OverviewTab.tsx's own scrollToFindings() already uses on Improve Speed. */
const scrollToId = (id: string) => {
	const el = document.getElementById(id);

	if (!el) {
		return;
	}

	el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	el.classList.add('vulopilot-glimpse-highlight');
	setTimeout(() => el.classList.remove('vulopilot-glimpse-highlight'), 1200);
};

/**
 * "WooCommerce" tab of "Sell More" — a real store-health overview
 * (WooCommerceCategoryGrid/StoreOverviewCards/StoreHealthBanner/
 * TopIssuesToWorkOn/AiSalesOptimizerCard/StoreIntelligenceSummaryCard/
 * WooCommerceIssuesTable, all real data — see each file's own docblock)
 * on top of the original page's two Pro panel slots and issues table,
 * kept unchanged below. StoreHealthBanner + WooCommerceCategoryGrid
 * (grid 8) and StoreOverviewCards/"At a Glance" (grid 4) sit side by side
 * in their own nested ContainerComponent, same "one real component reused
 * on two tabs" pattern OverviewTab.tsx already uses for StoreOverviewCards
 * — "View Full Report →" is repurposed here to scroll to this tab's own
 * issues table (goToIssuesTab) rather than navigate to itself, since this
 * already is the WooCommerce tab. TopIssuesToWorkOn ("What should I work
 * on first?") sits directly below that row. "Store Readiness"
 * (shop/cart/checkout/my-account page + HTTPS
 * status) used to be its own standalone card here; it's now the first
 * card inside WooCommerceCategoryGrid instead, matching that grid's card
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
const WooCommerceTab = () => {
	const [activeIssueTab, setActiveIssueTab] =
		useState<WooCommerceIssueTab>('all');
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

	const goToIssuesTab = (tab: WooCommerceIssueTab) => {
		setActiveIssueTab(tab);
		setTimeout(() => scrollToId('woocommerce-issues-table'), 50);
	};

	return (
		<ContainerComponent general>
			<ColumnComponent>
				<ContainerComponent>
					<ColumnComponent grid={8}>
						<StoreHealthBanner
							onReviewIssues={() => goToIssuesTab('important')}
							onViewSummary={() => scrollToId('store-readiness')}
						/>
						<WooCommerceCategoryGrid
							groups={groups}
							isLoadingGroups={isLoadingGroups}
							onReviewTab={goToIssuesTab}
						/>
					</ColumnComponent>
					<ColumnComponent grid={4}>
						<StoreOverviewCards
							onNavigateToWooCommerceTab={() => goToIssuesTab('important')}
						/>
					</ColumnComponent>
				</ContainerComponent>

				<TopIssuesToWorkOn
					groups={groups}
					isLoading={isLoadingGroups}
					onViewAll={() => goToIssuesTab('important')}
				/>

				<ContainerComponent>
					<ColumnComponent grid={6}>
						<AiSalesOptimizerCard
							onFindOpportunities={() => scrollToId('woocommerce-bulk-ai')}
						/>
					</ColumnComponent>
					<ColumnComponent grid={6}>
						<StoreIntelligenceSummaryCard
							onExploreInsights={() =>
								scrollToId('store-intelligence-panel')
							}
							onReviewTab={goToIssuesTab}
							onFindOpportunities={() => scrollToId('woocommerce-bulk-ai')}
						/>
					</ColumnComponent>
				</ContainerComponent>

				<ProductsToLookAtCard />

				<AiSalesAssistantCard
					onOptimizeStore={() => scrollToId('woocommerce-bulk-ai')}
					onReviewIssues={() => goToIssuesTab('important')}
				/>

				<WooCommerceIssuesTable
					groups={groups}
					activeTab={activeIssueTab}
					onTabChange={setActiveIssueTab}
				/>

				<div id="woocommerce-bulk-ai">
					{WooCommerceAiPanel ? (
						<WooCommerceAiPanel />
					) : (
						<WooCommerceAiLockedCard />
					)}
				</div>
				<div id="store-intelligence-panel">
					{WooCommerceIntelligencePanel ? (
						<WooCommerceIntelligencePanel />
					) : (
						<WooCommerceIntelligenceLockedCard />
					)}
				</div>
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default WooCommerceTab;
