/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { ColumnComponent, PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import ShowProPopup, { resolveModuleDisplayName } from '../../components/Popup/Popup';
import { useFilterSlot } from '../../services/useFilterSlot';
import './registerCommerceLeafSlots';
// Real CSS classes both Pro's moved CommerceCategoryGrid.tsx (`.woocommerce-category-rows` etc.) and Free's own CommerceIssuesTable.tsx (`.woocommerce-issues-table`) still use — kept here (Free's bundle, always loaded on this page whether Pro resolves or not) rather than duplicated into Pro, same "CSS classnames don't care which plugin's JS injected them, only that the stylesheet is on the page" reasoning that lets this file stay put.
import './Commerce.scss';

const COMMERCE_MODULE_ID = 'commerce';

/**
 * Fabricated, inert preview tiles — real card titles from Pro's own
 * CommerceCategoryGrid.tsx, no real numbers behind any of them. A fuller
 * set (8, not 4) so this preview actually fills the page at the same
 * visual density the real, unlocked grid has, rather than reading as a
 * small, half-empty placeholder next to a mostly-blank page.
 */
const DUMMY_TILES: { icon: string; title: string; desc: string }[] = [
	{ icon: 'security', title: __('Store Readiness', 'vulopilot'), desc: __('Shop, cart, checkout & my account pages.', 'vulopilot') },
	{ icon: 'cash', title: __('Checkout & Payments', 'vulopilot'), desc: __('Payment methods & failed orders.', 'vulopilot') },
	{ icon: 'cart', title: __('Products', 'vulopilot'), desc: __('Pricing, stock, images & product info.', 'vulopilot') },
	{ icon: 'database', title: __('Inventory', 'vulopilot'), desc: __('Out of stock & running low.', 'vulopilot') },
	{ icon: 'order', title: __('Orders', 'vulopilot'), desc: __('Failed, on hold & pending too long.', 'vulopilot') },
	{ icon: 'price', title: __('Coupons', 'vulopilot'), desc: __('Active & expiring soon.', 'vulopilot') },
	{ icon: 'person', title: __('Customer Insights', 'vulopilot'), desc: __('Total customers.', 'vulopilot') },
	{ icon: 'bar-chart', title: __('Revenue Reports', 'vulopilot'), desc: __('Today, this week, and this month.', 'vulopilot') },
];

/**
 * "Commerce" page's real body — moved wholesale to vulopilot-pro's own
 * Commerce module per direct instruction ("the commerce tab whole thing
 * shift to pro the all code come from pro"). Reads the real content back
 * via the `vulopilot_commerce_panel` filter slot (same `useFilterSlot()`
 * shape `vulopilot_automations_panel` already establishes for
 * Automations); when it hasn't resolved, renders a blurred/fabricated
 * preview with a Pro/module tag and an "Unlock with Pro" overlay —
 * clicking anywhere opens the upgrade popup — same real 2-tier
 * Pro-then-module order (`isProInstalled` checked first, then the
 * module's own active state) every other gate in this plugin already
 * uses: generic "PRO" tag + plain upgrade pitch when Pro isn't installed
 * at all, vs. this module's own real display name + "Activate {name}"
 * popup when Pro is installed but this specific module isn't active yet.
 *
 * The menu item itself (Admin.php's own `commerce` submenu) only depends
 * on WooCommerce being installed/active — unrelated to this gate, which
 * is about whether the module's real *content* renders once a WooCommerce
 * store owner actually opens the tab.
 */
const CommercePanel = () => {
	const RealPanel = useFilterSlot('vulopilot_commerce_panel');
	const isProInstalled = Boolean(appLocalizer.khali_dabba);
	const [isPopupOpen, setIsPopupOpen] = useState(false);

	if (RealPanel) {
		return <RealPanel />;
	}

	const badgeText = isProInstalled
		? resolveModuleDisplayName(COMMERCE_MODULE_ID)
		: __('PRO', 'vulopilot');

	return (
		<ColumnComponent grid={12}>
			<div className="commerce-locked">
				<div className="commerce-locked-tag">
					<span className="admin-tag pro-tag">
						<i className="adminfont-lock" />
						{badgeText}
					</span>
				</div>
				<div className="commerce-locked-preview" aria-hidden="true">
					{DUMMY_TILES.map((tile) => (
						<div className="commerce-locked-tile" key={tile.title}>
							<i className={`adminfont-${tile.icon}`} />
							<div className="commerce-locked-tile-title">{tile.title}</div>
							<div className="commerce-locked-tile-desc">{tile.desc}</div>
						</div>
					))}
				</div>
				<div
					className="commerce-locked-overlay"
					role="button"
					tabIndex={0}
					aria-label={__('Unlock with Pro', 'vulopilot')}
					onClick={() => setIsPopupOpen(true)}
					onKeyDown={(event) => {
						if ('Enter' === event.key || ' ' === event.key) {
							setIsPopupOpen(true);
						}
					}}
				>
					<ButtonInput
						buttons={{
							text: __('Unlock with Pro', 'vulopilot'),
							icon: 'lock',
							onClick: () => setIsPopupOpen(true),
						}}
					/>
				</div>
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
			</div>
		</ColumnComponent>
	);
};

export default CommercePanel;
