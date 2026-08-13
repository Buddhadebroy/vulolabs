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
import ShowProPopup from '../../components/Popup/Popup';
import { useFilterSlot } from '../../services/useFilterSlot';
import { useWooCommerceFindingGroups } from './useWooCommerceFindingGroups';
import StoreHealthBanner from './StoreHealthBanner';
import StoreReadinessCard from './StoreReadinessCard';
import WooCommerceCategoryGrid from './WooCommerceCategoryGrid';
import TopIssuesToWorkOn from './TopIssuesToWorkOn';
import AiSalesOptimizerCard from './AiSalesOptimizerCard';
import StoreIntelligenceSummaryCard from './StoreIntelligenceSummaryCard';
import WooCommerceIssuesTable, {
	WooCommerceIssueTab,
} from './WooCommerceIssuesTable';

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
 * (StoreHealthBanner/StoreReadinessCard/WooCommerceCategoryGrid/
 * TopIssuesToWorkOn/AiSalesOptimizerCard/StoreIntelligenceSummaryCard/
 * WooCommerceIssuesTable, all real data — see each file's own docblock)
 * on top of the original page's two Pro panel slots and issues table,
 * kept unchanged below. `groups` (`GET /findings/groups?category=woocommerce`)
 * is fetched once here and threaded down to every section that needs it,
 * rather than each one re-fetching the same real data independently.
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
				<StoreHealthBanner
					onReviewIssues={() => goToIssuesTab('important')}
					onViewSummary={() => scrollToId('store-readiness')}
				/>

				<StoreReadinessCard />

				<WooCommerceCategoryGrid
					groups={groups}
					isLoadingGroups={isLoadingGroups}
					onReviewTab={goToIssuesTab}
				/>

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
						/>
					</ColumnComponent>
				</ContainerComponent>

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
