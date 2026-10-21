import { __ } from '@wordpress/i18n';
import { getTemplateData } from './services/templateService';
import MODULES_CATALOG, { isModuleCatalogEntry } from './modules-config';
import paymentsFields from './components/Settings/paymentsFields';

/**
 * The header search's index: the VuloCart tabs and menu pages, every Settings tab and the sections and
 * fields on it, and the modules. Built when a search runs, not at load, so settings tabs vulocart-pro adds
 * (Licensing, Product Templates) are included once its bundle has registered them.
 */
export type SearchItem = {
	id: string;
	/** Which option of the header's dropdown this result belongs to. */
	category: 'pages' | 'settings' | 'modules';
	name: string;
	desc?: string;
	/** `&tab=…` for a tab of the VuloCart app, or an `admin.php?…` URL for a menu page. */
	link: string;
	icon?: string;
};

const text = ( value: unknown ): string => ( 'string' === typeof value ? value : '' );

interface SettingTab {
	id: string;
	headerTitle: string;
	headerDescription?: string;
	headerIcon?: string;
	modal?: { key: string; type: string; label?: unknown; title?: unknown; desc?: unknown; settingDescription?: unknown }[];
}

interface SettingNode {
	type: 'folder' | 'file';
	content: unknown;
}

const flattenTabs = ( nodes: SettingNode[] ): SettingTab[] =>
	nodes.flatMap( ( node ) => ( 'folder' === node.type ? flattenTabs( node.content as SettingNode[] ) : [ node.content as SettingTab ] ) );

const PAGES: { id: string; name: string; desc: string; link: string; icon: string }[] = [
	{ id: 'dashboard', name: __( 'Dashboard', 'vulocart' ), desc: __( 'Sales and store overview.', 'vulocart' ), link: '&tab=dashboard', icon: 'analytics' },
	{ id: 'reviews', name: __( 'Reviews', 'vulocart' ), desc: __( 'Approve or reject customer reviews.', 'vulocart' ), link: '&tab=reviews', icon: 'review' },
	{ id: 'orders', name: __( 'Orders', 'vulocart' ), desc: __( 'Every order.', 'vulocart' ), link: 'admin.php?page=orders', icon: 'store' },
	{ id: 'orders-add', name: __( 'Add order', 'vulocart' ), desc: __( 'Create an order by hand.', 'vulocart' ), link: 'admin.php?page=orders&action=add', icon: 'plus' },
	{ id: 'subscriptions', name: __( 'Subscriptions', 'vulocart' ), desc: __( 'Recurring billing.', 'vulocart' ), link: 'admin.php?page=orders&view=subscriptions', icon: 'subscription' },
	{ id: 'products', name: __( 'Products', 'vulocart' ), desc: __( 'Everything you sell.', 'vulocart' ), link: 'admin.php?page=products', icon: 'catalog' },
	{ id: 'products-add', name: __( 'Add product', 'vulocart' ), desc: __( 'Create a new product.', 'vulocart' ), link: 'admin.php?page=products&action=add', icon: 'plus' },
	{ id: 'categories', name: __( 'Categories', 'vulocart' ), desc: __( 'Group products into categories.', 'vulocart' ), link: 'admin.php?page=products&view=categories', icon: 'category' },
	{ id: 'collections', name: __( 'Collections', 'vulocart' ), desc: __( 'Hand-picked groups of products.', 'vulocart' ), link: 'admin.php?page=products&view=collections', icon: 'folder-open' },
	{ id: 'brands', name: __( 'Brands', 'vulocart' ), desc: __( 'The brands your products come from.', 'vulocart' ), link: 'admin.php?page=products&view=brands', icon: 'product' },
	{ id: 'tags', name: __( 'Tags', 'vulocart' ), desc: __( 'Free-form labels for products.', 'vulocart' ), link: 'admin.php?page=products&view=tags', icon: 'tag' },
	{ id: 'attributes', name: __( 'Attributes', 'vulocart' ), desc: __( 'Properties such as colour and size.', 'vulocart' ), link: 'admin.php?page=products&view=attributes', icon: 'product-options' },
	{ id: 'customers', name: __( 'Customers', 'vulocart' ), desc: __( 'Everyone who has bought from you.', 'vulocart' ), link: 'admin.php?page=customers', icon: 'membership' },
	{ id: 'inventory', name: __( 'Stock Levels', 'vulocart' ), desc: __( 'Stock for every product.', 'vulocart' ), link: 'admin.php?page=inventory', icon: 'store-inventory' },
	{ id: 'suppliers', name: __( 'Suppliers', 'vulocart' ), desc: __( 'Who you source products from.', 'vulocart' ), link: 'admin.php?page=inventory&view=suppliers', icon: 'store' },
	{ id: 'warehouses', name: __( 'Warehouses', 'vulocart' ), desc: __( 'Stock locations.', 'vulocart' ), link: 'admin.php?page=inventory&view=warehouses', icon: 'store-inventory' },
	{ id: 'shipping', name: __( 'Shipment', 'vulocart' ), desc: __( 'Shipments, returns and local pickup.', 'vulocart' ), link: 'admin.php?page=shipping', icon: 'shipping' },
	{ id: 'marketing-coupons', name: __( 'Coupons', 'vulocart' ), desc: __( 'Discount codes.', 'vulocart' ), link: 'admin.php?page=marketing&view=coupons', icon: 'coupon' },
	{ id: 'marketing-gift-cards', name: __( 'Gift Cards', 'vulocart' ), desc: __( 'Stored-value codes.', 'vulocart' ), link: 'admin.php?page=marketing&view=gift-cards', icon: 'gift-card' },
	{ id: 'marketing-pricing-rules', name: __( 'Pricing Rules', 'vulocart' ), desc: __( 'Automatic discounts.', 'vulocart' ), link: 'admin.php?page=marketing&view=pricing-rules', icon: 'price' },
	{ id: 'marketing-checkout-links', name: __( 'Payment Links', 'vulocart' ), desc: __( 'Links that open checkout with products already in the cart.', 'vulocart' ), link: 'admin.php?page=marketing&view=checkout-links', icon: 'link' },
	{ id: 'marketing-checkout-builder', name: __( 'Checkout steps and fields', 'vulocart' ), desc: __( 'Choose which checkout steps and fields are shown.', 'vulocart' ), link: 'admin.php?page=vulocart#&tab=settings&subtab=checkout', icon: 'credit-card' },
	{ id: 'marketing-abandoned', name: __( 'Cart Abandoned', 'vulocart' ), desc: __( 'Checkouts that were never completed.', 'vulocart' ), link: 'admin.php?page=marketing&view=abandoned-checkouts', icon: 'cart' },
	{ id: 'ai', name: __( 'AI', 'vulocart' ), desc: __( 'Catalog, checkout, support and search AI.', 'vulocart' ), link: 'admin.php?page=ai', icon: 'ai' },
	{ id: 'workflows', name: __( 'Workflows', 'vulocart' ), desc: __( 'Automations that react to store events.', 'vulocart' ), link: 'admin.php?page=workflows', icon: 'automation' },
	{ id: 'analytics', name: __( 'Analytics', 'vulocart' ), desc: __( 'Sales, customers, funnels and forecasts.', 'vulocart' ), link: 'admin.php?page=vulocart#&tab=dashboard', icon: 'analytics' },
];

/** The VuloCart tabs, every settings tab with its fields, and the modules. */
export const buildSearchIndex = (): SearchItem[] => {
	const pages: SearchItem[] = PAGES.map( ( page ) => ( { ...page, id: `page-${ page.id }`, category: 'pages' as const } ) );

	const settings: SearchItem[] = flattenTabs( getTemplateData( 'settings' ) as SettingNode[] ).flatMap( ( tab ) => {
		const link = `&tab=settings&subtab=${ tab.id }`;
		// Payments is a panel whose fields live in paymentsFields.ts, not in the tab's own `modal`.
		const fields = 'payments' === tab.id ? paymentsFields : tab.modal ?? [];

		return [
			{ id: `settings-${ tab.id }`, category: 'settings' as const, name: tab.headerTitle, desc: tab.headerDescription, link, icon: tab.headerIcon },
			...fields.flatMap( ( field ) => {
				const name = text( field.label ) || text( field.title );

				return name
					? [
							{
								id: `settings-${ tab.id }-${ field.key }`,
								category: 'settings' as const,
								name,
								desc: text( field.settingDescription ) || text( field.desc ),
								link,
								icon: tab.headerIcon,
							},
					  ]
					: [];
			} ),
		];
	} );

	const modules: SearchItem[] = MODULES_CATALOG.modules.filter( isModuleCatalogEntry ).map( ( module ) => ( {
		id: `module-${ module.id }`,
		category: 'modules' as const,
		name: module.name,
		desc: module.desc,
		link: '&tab=settings&subtab=modules',
		icon: module.icon,
	} ) );

	return [ ...pages, ...settings, ...modules ];
};
