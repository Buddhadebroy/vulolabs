/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { addFilter } from '@wordpress/hooks';
import { ContainerComponent, NavigatorHeaderComponent, PopupComponent } from '@zyra/components';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import ShowProPopup from '../../components/Popup/Popup';
import { useFilterSlot } from '../../services/useFilterSlot';
import CommerceIssuesTable from './CommerceIssuesTable';
import AiSalesAssistantCard from './AiSalesAssistantCard';
import AiSalesOptimizerCard from './AiSalesOptimizerCard';
import CommerceProDummies from './CommerceProDummies';
import BannerCard from '../../components/BannerCard';
// Real CSS classes both Pro's moved CommerceCategoryGrid.tsx (`.woocommerce-category-rows` etc.) and Free's own CommerceIssuesTable.tsx (`.woocommerce-issues-table`) still use — kept here (Free's bundle, always loaded on this page whether Pro resolves or not) rather than duplicated into Pro, same "CSS classnames don't care which plugin's JS injected them, only that the stylesheet is on the page" reasoning that lets this file stay put.
import './Commerce.scss';

const COMMERCE_MODULE_ID = 'commerce';

/**
 * The Commerce tab's real body content (CommerceTab.tsx and most of its
 * children) moved to vulopilot-pro's own Commerce module per direct
 * instruction — but these 3 components stayed here: they depend on large,
 * genuinely shared Free infrastructure (useFindingsTable.tsx's 700+ lines,
 * the AI chat widget under components/ChatComposerCard/, AiCopilotGuard)
 * used by many other free pages (GEO, Accessibility, Reports, …), so
 * duplicating that logic into Pro just for this one tab would bloat that
 * plugin and create drift risk — see modules/Commerce/Module.php's own
 * docblock (Pro side) for the full reasoning.
 *
 * Registered here into 4 small filter slots so Pro's own (moved)
 * CommerceTab.tsx can still compose them into the exact same page layout —
 * the SAME `@wordpress/hooks` mechanism every other cross-plugin slot in
 * this app already uses, just in the opposite direction (Free registers,
 * Pro consumes). No script-load-order race to guard against on this side
 * (unlike `useFilterSlot()`'s own Pro-into-Free direction): Free's bundle
 * is a hard script dependency of Pro's (FrontendScriptsPro.php) and always
 * finishes evaluating first, so a plain `addFilter()` here is always
 * registered before Pro's own `applyFilters()` read ever runs.
 *
 * Runs once, unconditionally, at this module's own top-level scope — this
 * file (Commerce.tsx) is this route's own entry point, itself always
 * eagerly imported by routes.ts — so these 3 registrations exist on every
 * VuloPilot admin page load, not just while the Commerce tab is actually
 * open.
 */
addFilter(
	'vulopilot_commerce_issues_table',
	'vulopilot/commerce',
	() => CommerceIssuesTable
);

addFilter(
	'vulopilot_commerce_ai_sales_assistant',
	'vulopilot/commerce',
	() => AiSalesAssistantCard
);

addFilter(
	'vulopilot_commerce_ai_sales_optimizer',
	'vulopilot/commerce',
	() => AiSalesOptimizerCard
);

// Shared promo banner (components/BannerCard.tsx) — read back by
// vulopilot-pro's StoreHealthBanner, which can't import Free's src/ tree.
addFilter('vulopilot_banner_card', 'vulopilot/commerce', () => BannerCard);

/**
 * "Commerce" page's real body — moved wholesale to vulopilot-pro's own
 * Commerce module per direct instruction ("the commerce tab whole thing
 * shift to pro the all code come from pro"). Reads the real content back
 * via the `vulopilot_commerce_panel` filter slot (same `useFilterSlot()`
 * shape `vulopilot_automations_panel` already establishes for
 * Automations); when it hasn't resolved, renders CommerceProDummies — a
 * fabricated card-per-section preview of the real page, each behind the
 * shared blurred "Upgrade to Pro" overlay. Clicking anywhere opens the
 * upgrade popup — same real 2-tier Pro-then-module order
 * (`isProInstalled` checked first) every other gate in this plugin uses:
 * plain upgrade pitch when Pro isn't installed at all, vs. this module's
 * own "Activate {name}" popup when Pro is installed but this module isn't
 * active yet.
 *
 * Was previously its own CommercePanel.tsx file, imported only here —
 * merged into this route's own entry point (its one real consumer), same
 * "single-consumer wrapper" cleanup already applied to
 * pages/Content/OverviewTab.tsx and pages/AIAssistant/ChatTab.tsx.
 */
const CommercePanel = () => {
	const RealPanel = useFilterSlot('vulopilot_commerce_panel');
	const isProInstalled = Boolean(appLocalizer.khali_dabba);
	const [isPopupOpen, setIsPopupOpen] = useState(false);

	if (RealPanel) {
		return <RealPanel />;
	}

	return (
		<>
			<CommerceProDummies onClick={() => setIsPopupOpen(true)} />
			<PopupComponent
				open={isPopupOpen}
				onClose={() => setIsPopupOpen(false)}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{isProInstalled ? (
					<ShowProPopup moduleName={COMMERCE_MODULE_ID} />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</>
	);
};

/**
 * "Commerce" (WP menu slug `commerce`) — used to be a tab shell over
 * two views (a mockup "Overview" tab plus this real category-'woocommerce'
 * findings scanner + Pro panels view). The Overview tab (and its
 * exclusively-Overview-only sub-components — AiInsightBanner.tsx,
 * WooCommerceMetricsGrid.tsx, TopSellingProductsCard.tsx,
 * AbandonedCartCard.tsx, ProTipBanner.tsx) has been removed: this route
 * now renders its real body directly, no tab bar, so "Commerce" shows
 * that content immediately rather than requiring a second click.
 *
 * The header here (and the menu item itself — see Admin.php's own
 * `commerce` submenu, gated on `class_exists('WooCommerce')`) is
 * unconditional; only the body (`CommercePanel` above) is Pro-then-module
 * gated — see that component's own docblock for the real "the whole
 * Commerce tab moved to Pro" story.
 */
const Commerce = () => {
	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="cart"
				headerTitle={__('Commerce', 'vulopilot')}
				headerDescription={__(
					'AI-powered WooCommerce intelligence to help you increase sales and grow revenue.',
					'vulopilot'
				)}
				headerCustomContent={
					<RunScanHeaderExtra
						categories={['woocommerce']}
						settingsSubtab="woocommerce"
					/>
				}
			/>
			<ContainerComponent general>
				<CommercePanel />
			</ContainerComponent>
		</>
	);
};

export default Commerce;
