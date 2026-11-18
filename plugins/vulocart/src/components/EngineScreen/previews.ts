import { __ } from '@wordpress/i18n';

/**
 * Sample screens for every page a module provides, shown (dimmed, not clickable) behind the "unlock" card while that
 * module is missing: Pro not installed, no active license, or the module turned off. Each one copies the real page's
 * columns, status tabs and row actions, so a store owner sees exactly what they get.
 *
 * The rows are made-up sample data, labelled as such on screen. Keep a preview in step with its page when the page's
 * columns change (the pages live in vulocart-pro's `modules/<Module>/src/`).
 */

/** Status colours zyra defines as `.badge-{tone}`. */
export type PreviewTone = 'active' | 'inactive' | 'pending' | 'completed' | 'processing' | 'cancelled' | 'refunded' | 'expired' | 'draft' | 'approved' | 'confirmed' | 'unpaid' | 'failed';

/** A table cell: plain text, or a title with status badges and icon + text details underneath. */
export type PreviewCell =
	| string
	| {
			title?: string;
			badges?: Array< [ string, PreviewTone ] >;
			details?: Array< [ string, string ] >;
	  };

export interface PreviewStat {
	icon: string;
	label: string;
	value: string;
	hint: string;
}

export interface PagePreview {
	stats?: PreviewStat[];
	/** Status tabs above the table, with their counts. The first is the active one. */
	tabs?: Array< [ string, number ] >;
	search?: string;
	/** Column key → label. */
	columns: Record< string, string >;
	/** Columns drawn right-aligned (amounts, counts). */
	numeric?: string[];
	rows: Array< Record< string, PreviewCell > >;
	/** Row actions shown as words (workflow steps) and as icons (icon, tooltip), in the page's order. */
	verbs?: string[];
	icons?: Array< [ string, string ] >;
}

const EDIT_DELETE: Array< [ string, string ] > = [
	[ 'edit', __( 'Edit', 'vulocart' ) ],
	[ 'delete', __( 'Delete', 'vulocart' ) ],
];

const all = __( 'All', 'vulocart' );
const active = __( 'Active', 'vulocart' );
const inactive = __( 'Inactive', 'vulocart' );

/** Keyed by the view id in the page's URL (`&view=`) or the settings tab id; `byModule` covers pages without one. */
export const PREVIEWS: Record< string, PagePreview > = {
	coupons: {
		tabs: [ [ all, 4 ], [ active, 3 ], [ inactive, 1 ] ],
		search: __( 'Search coupons…', 'vulocart' ),
		columns: { code: __( 'Coupon', 'vulocart' ), discount: __( 'Discount', 'vulocart' ), used: __( 'Used', 'vulocart' ) },
		rows: [
			{ code: { title: 'WELCOME10', badges: [ [ active, 'active' ] ], details: [ [ 'calendar', 'Expires Dec 31, 2026' ] ] }, discount: '10%', used: '128 / 500' },
			{ code: { title: 'FREESHIP', badges: [ [ active, 'active' ] ] }, discount: '$5.00', used: '64' },
			{ code: { title: 'BLACKFRIDAY', badges: [ [ active, 'active' ] ], details: [ [ 'calendar', 'Expires Nov 30, 2026' ] ] }, discount: '25%', used: '311 / 1000' },
			{ code: { title: 'SUMMER15', badges: [ [ inactive, 'inactive' ] ], details: [ [ 'calendar', 'Expired Aug 31, 2026' ] ] }, discount: '15%', used: '89' },
		],
		icons: EDIT_DELETE,
	},
	'pricing-rules': {
		tabs: [ [ all, 3 ], [ active, 3 ] ],
		search: __( 'Search pricing rules…', 'vulocart' ),
		columns: { rule: __( 'Rule', 'vulocart' ), applies: __( 'Applies to', 'vulocart' ), discount: __( 'Discount', 'vulocart' ) },
		rows: [
			{ rule: { title: 'Buy 3, save 10%', badges: [ [ active, 'active' ] ] }, applies: 'Every product', discount: '10%' },
			{ rule: { title: 'Mugs bundle', badges: [ [ active, 'active' ] ] }, applies: 'Category: Kitchen', discount: '$4.00' },
			{ rule: { title: 'Wholesale tees', badges: [ [ active, 'active' ] ] }, applies: 'Organic Cotton Tee', discount: '20%' },
		],
		icons: EDIT_DELETE,
	},
	'gift-cards': {
		stats: [
			{ icon: 'gift-card', label: __( 'Outstanding balance', 'vulocart' ), value: '$1,240.00', hint: __( 'across 18 cards', 'vulocart' ) },
			{ icon: 'cart', label: __( 'Redeemed this month', 'vulocart' ), value: '$385.00', hint: __( '12 orders', 'vulocart' ) },
			{ icon: 'calendar', label: __( 'Expiring soon', 'vulocart' ), value: '3', hint: __( 'in the next 30 days', 'vulocart' ) },
		],
		tabs: [ [ all, 4 ], [ active, 3 ], [ inactive, 1 ] ],
		search: __( 'Search gift cards…', 'vulocart' ),
		columns: { code: __( 'Gift card', 'vulocart' ), balance: __( 'Balance', 'vulocart' ) },
		numeric: [ 'balance' ],
		rows: [
			{ code: { title: 'GC-7KQ2-M9XA', badges: [ [ active, 'active' ] ], details: [ [ 'calendar', 'Expires Nov 18, 2027' ] ] }, balance: '$50.00 of $50.00' },
			{ code: { title: 'GC-P4RT-82LZ', badges: [ [ active, 'active' ] ] }, balance: '$12.50 of $25.00' },
			{ code: { title: 'GC-H6WN-3VDE', badges: [ [ active, 'active' ] ], details: [ [ 'calendar', 'Expires Mar 1, 2027' ] ] }, balance: '$100.00 of $100.00' },
			{ code: { title: 'GC-Z9BC-1QTS', badges: [ [ inactive, 'inactive' ] ] }, balance: '$0.00 of $40.00' },
		],
		icons: EDIT_DELETE,
	},
	'abandoned-checkouts': {
		stats: [
			{ icon: 'cart', label: __( 'Abandoned carts', 'vulocart' ), value: '42', hint: __( 'last 7 days', 'vulocart' ) },
			{ icon: 'mail', label: __( 'Recovered', 'vulocart' ), value: '11', hint: __( '26% recovery rate', 'vulocart' ) },
			{ icon: 'wallet', label: __( 'Revenue recovered', 'vulocart' ), value: '$684.00', hint: __( 'from reminder emails', 'vulocart' ) },
		],
		tabs: [ [ '15m', 3 ], [ '1h', 9 ], [ '24h', 26 ], [ '7d', 42 ] ],
		search: __( 'Search by email…', 'vulocart' ),
		columns: { customer: __( 'Customer', 'vulocart' ), step: __( 'Stalled at step', 'vulocart' ), started: __( 'Started', 'vulocart' ), activity: __( 'Last activity', 'vulocart' ) },
		rows: [
			{ customer: { title: 'Grace Hopper', details: [ [ 'mail', 'grace@example.com' ] ] }, step: { badges: [ [ 'Payment', 'pending' ] ] }, started: '12 min ago', activity: '4 min ago' },
			{ customer: { title: 'Linus Pauling', details: [ [ 'mail', 'linus@example.com' ] ] }, step: { badges: [ [ 'Shipping', 'processing' ] ] }, started: '48 min ago', activity: '31 min ago' },
			{ customer: { title: 'Marie Curie', details: [ [ 'mail', 'marie@example.com' ] ] }, step: { badges: [ [ 'Address', 'draft' ] ] }, started: '3 h ago', activity: '2 h ago' },
			{ customer: { title: 'Alan Turing', details: [ [ 'mail', 'alan@example.com' ] ] }, step: { badges: [ [ 'Payment', 'pending' ] ] }, started: 'Yesterday', activity: 'Yesterday' },
		],
		verbs: [ __( 'Send reminder', 'vulocart' ) ],
	},
	'checkout-links': {
		tabs: [ [ all, 3 ], [ active, 2 ], [ inactive, 1 ] ],
		search: __( 'Search payment links…', 'vulocart' ),
		columns: { link: __( 'Link', 'vulocart' ), share: __( 'Share', 'vulocart' ), usage: __( 'Usage', 'vulocart' ) },
		rows: [
			{ link: { title: 'Coffee subscription – 3 months', badges: [ [ active, 'active' ] ] }, share: 'store.example/pay/coffee-3m', usage: '57 paid' },
			{ link: { title: 'Workshop deposit', badges: [ [ active, 'active' ] ] }, share: 'store.example/pay/workshop', usage: '18 paid' },
			{ link: { title: 'Holiday gift box', badges: [ [ inactive, 'inactive' ] ] }, share: 'store.example/pay/gift-box', usage: '203 paid' },
		],
		icons: [ [ 'eye-blocked', __( 'Disable', 'vulocart' ) ], [ 'link', __( 'Copy link', 'vulocart' ) ], ...EDIT_DELETE ],
	},
	subscriptions: {
		stats: [
			{ icon: 'wallet', label: __( 'Monthly recurring revenue', 'vulocart' ), value: '$2,184.00', hint: __( '+8% vs last month', 'vulocart' ) },
			{ icon: 'cohort', label: __( 'Active subscribers', 'vulocart' ), value: '96', hint: __( '4 paused', 'vulocart' ) },
			{ icon: 'calendar', label: __( 'Renewing this week', 'vulocart' ), value: '23', hint: __( '$512.00 to collect', 'vulocart' ) },
		],
		tabs: [ [ all, 4 ], [ active, 2 ], [ __( 'Paused', 'vulocart' ), 1 ], [ __( 'Past due', 'vulocart' ), 1 ] ],
		search: __( 'Search subscriptions…', 'vulocart' ),
		columns: { customer: __( 'Customer', 'vulocart' ), billing: __( 'Billing', 'vulocart' ), next: __( 'Next billing', 'vulocart' ) },
		rows: [
			{ customer: { title: 'Ada Lovelace', badges: [ [ active, 'active' ] ], details: [ [ 'mail', 'ada@example.com' ] ] }, billing: '$29.00 / month', next: 'Nov 24, 2026' },
			{ customer: { title: 'Katherine Johnson', badges: [ [ active, 'active' ] ], details: [ [ 'mail', 'katherine@example.com' ] ] }, billing: '$79.00 / quarter', next: 'Dec 2, 2026' },
			{ customer: { title: 'Marie Curie', badges: [ [ __( 'Paused', 'vulocart' ), 'draft' ] ], details: [ [ 'mail', 'marie@example.com' ] ] }, billing: '$29.00 / month', next: '—' },
			{ customer: { title: 'Linus Pauling', badges: [ [ __( 'Past due', 'vulocart' ), 'failed' ] ], details: [ [ 'mail', 'linus@example.com' ] ] }, billing: '$15.00 / month', next: 'Retrying Nov 19' },
		],
		verbs: [ __( 'Pause', 'vulocart' ) ],
		icons: [ [ 'eye', __( 'View', 'vulocart' ) ], [ 'close-delete', __( 'Cancel', 'vulocart' ) ] ],
	},
	bookings: {
		tabs: [ [ all, 4 ], [ __( 'Confirmed', 'vulocart' ), 2 ], [ __( 'Pending', 'vulocart' ), 1 ], [ __( 'Completed', 'vulocart' ), 1 ] ],
		search: __( 'Search bookings…', 'vulocart' ),
		columns: { when: __( 'When', 'vulocart' ), product: __( 'Product', 'vulocart' ), customer: __( 'Customer', 'vulocart' ), places: __( 'Places', 'vulocart' ) },
		numeric: [ 'places' ],
		rows: [
			{ when: { title: 'Thu, Nov 20 · 10:00', badges: [ [ __( 'Confirmed', 'vulocart' ), 'confirmed' ] ] }, product: 'Pottery workshop', customer: 'Grace Hopper', places: '2' },
			{ when: { title: 'Thu, Nov 20 · 14:30', badges: [ [ __( 'Pending', 'vulocart' ), 'pending' ] ] }, product: 'Coffee tasting', customer: 'Alan Turing', places: '1' },
			{ when: { title: 'Sat, Nov 22 · 09:00', badges: [ [ __( 'Confirmed', 'vulocart' ), 'confirmed' ] ] }, product: 'Candle making class', customer: 'Ada Lovelace', places: '4' },
			{ when: { title: 'Mon, Nov 17 · 16:00', badges: [ [ __( 'Completed', 'vulocart' ), 'completed' ] ] }, product: 'Pottery workshop', customer: 'Marie Curie', places: '1' },
		],
		verbs: [ __( 'Confirm', 'vulocart' ) ],
		icons: [ [ 'eye', __( 'Customer page', 'vulocart' ) ], [ 'close-delete', __( 'Cancel', 'vulocart' ) ] ],
	},
	groups: {
		search: __( 'Search customer groups…', 'vulocart' ),
		columns: { group: __( 'Group', 'vulocart' ), members: __( 'Members', 'vulocart' ) },
		numeric: [ 'members' ],
		rows: [
			{ group: { title: 'Wholesale', details: [ [ 'price', '15% off every order' ] ] }, members: '24' },
			{ group: { title: 'VIP', details: [ [ 'price', 'Free shipping' ] ] }, members: '58' },
			{ group: { title: 'Staff', details: [ [ 'price', '30% off' ] ] }, members: '7' },
		],
		icons: EDIT_DELETE,
	},
	segments: {
		search: __( 'Search segments…', 'vulocart' ),
		columns: { segment: __( 'Segment', 'vulocart' ), members: __( 'Members', 'vulocart' ) },
		numeric: [ 'members' ],
		rows: [
			{ segment: { title: 'Big spenders', details: [ [ 'filter', 'Total spent over $500' ] ] }, members: '31' },
			{ segment: { title: 'Repeat buyers', details: [ [ 'filter', '3 or more orders' ] ] }, members: '142' },
			{ segment: { title: 'Lapsed', details: [ [ 'filter', 'No order in 90 days' ] ] }, members: '87' },
		],
		icons: [ [ 'eye', __( 'View members', 'vulocart' ) ], ...EDIT_DELETE ],
	},
	suppliers: {
		search: __( 'Search suppliers…', 'vulocart' ),
		columns: { supplier: __( 'Supplier', 'vulocart' ), contact: __( 'Contact', 'vulocart' ), address: __( 'Address', 'vulocart' ) },
		rows: [
			{ supplier: { title: 'Northwind Paper Co.', details: [ [ 'mail', 'orders@northwind.example' ] ] }, contact: 'Priya Shah', address: 'Portland, US' },
			{ supplier: { title: 'Clayworks Ceramics', details: [ [ 'mail', 'hello@clayworks.example' ] ] }, contact: 'Tom Becker', address: 'Stoke-on-Trent, GB' },
			{ supplier: { title: 'Green Thread Textiles', details: [ [ 'mail', 'sales@greenthread.example' ] ] }, contact: 'Ana Ruiz', address: 'Porto, PT' },
		],
		icons: EDIT_DELETE,
	},
	'product-templates': {
		search: __( 'Search templates…', 'vulocart' ),
		columns: { template: __( 'Template', 'vulocart' ), type: __( 'Product type', 'vulocart' ), price: __( 'Price', 'vulocart' ) },
		numeric: [ 'price' ],
		rows: [
			{ template: { title: 'Standard T-shirt', details: [ [ 'calendar', 'Created Nov 2, 2026' ] ] }, type: 'Physical', price: '$32.00' },
			{ template: { title: 'Digital wallpaper pack', details: [ [ 'calendar', 'Created Oct 21, 2026' ] ] }, type: 'Digital', price: '$6.00' },
			{ template: { title: 'Monthly coffee box', details: [ [ 'calendar', 'Created Oct 9, 2026' ] ] }, type: 'Subscription', price: '$29.00' },
		],
		verbs: [ __( 'Use', 'vulocart' ) ],
		icons: [ [ 'copy', __( 'Duplicate', 'vulocart' ) ], ...EDIT_DELETE ],
	},
	warehouses: {
		search: __( 'Search warehouses…', 'vulocart' ),
		columns: { warehouse: __( 'Warehouse', 'vulocart' ), location: __( 'Location', 'vulocart' ), stock: __( 'Units on hand', 'vulocart' ) },
		numeric: [ 'stock' ],
		rows: [
			{ warehouse: { title: 'Main warehouse', badges: [ [ __( 'Default', 'vulocart' ), 'active' ] ], details: [ [ 'store-inventory', 'WH-MAIN' ] ] }, location: 'Portland, US', stock: '1,284' },
			{ warehouse: { title: 'East coast', details: [ [ 'store-inventory', 'WH-EAST' ] ] }, location: 'Newark, US', stock: '642' },
			{ warehouse: { title: 'EU fulfilment', details: [ [ 'store-inventory', 'WH-EU' ] ] }, location: 'Rotterdam, NL', stock: '318' },
		],
		icons: [ [ 'store-inventory', __( 'Locations', 'vulocart' ) ], ...EDIT_DELETE ],
	},
	'purchase-orders': {
		tabs: [ [ all, 3 ], [ __( 'Ordered', 'vulocart' ), 2 ], [ __( 'Received', 'vulocart' ), 1 ] ],
		search: __( 'Search purchase orders…', 'vulocart' ),
		columns: { po: __( 'Purchase order', 'vulocart' ), warehouse: __( 'Warehouse', 'vulocart' ), total: __( 'Total', 'vulocart' ) },
		numeric: [ 'total' ],
		rows: [
			{ po: { title: 'PO-1042', badges: [ [ __( 'Ordered', 'vulocart' ), 'processing' ] ], details: [ [ 'store-inventory', 'Northwind Paper Co. · 200 units' ] ] }, warehouse: 'Main warehouse', total: '$1,180.00' },
			{ po: { title: 'PO-1041', badges: [ [ __( 'Ordered', 'vulocart' ), 'processing' ] ], details: [ [ 'store-inventory', 'Clayworks Ceramics · 120 units' ] ] }, warehouse: 'East coast', total: '$960.00' },
			{ po: { title: 'PO-1039', badges: [ [ __( 'Received', 'vulocart' ), 'completed' ] ], details: [ [ 'store-inventory', 'Green Thread Textiles · 300 units' ] ] }, warehouse: 'EU fulfilment', total: '$2,450.00' },
		],
		verbs: [ __( 'Receive stock', 'vulocart' ) ],
		icons: EDIT_DELETE,
	},
	transfers: {
		tabs: [ [ all, 3 ], [ __( 'In transit', 'vulocart' ), 2 ], [ __( 'Completed', 'vulocart' ), 1 ] ],
		search: __( 'Search transfers…', 'vulocart' ),
		columns: { transfer: __( 'Transfer', 'vulocart' ), from: __( 'From warehouse', 'vulocart' ), to: __( 'To warehouse', 'vulocart' ) },
		rows: [
			{ transfer: { title: 'TR-208 · 40 × Ceramic Coffee Mug', badges: [ [ __( 'In transit', 'vulocart' ), 'processing' ] ] }, from: 'Main warehouse', to: 'East coast' },
			{ transfer: { title: 'TR-207 · 60 × Linen Tote Bag', badges: [ [ __( 'In transit', 'vulocart' ), 'processing' ] ] }, from: 'Main warehouse', to: 'EU fulfilment' },
			{ transfer: { title: 'TR-205 · 25 × Recycled Notebook', badges: [ [ __( 'Completed', 'vulocart' ), 'completed' ] ] }, from: 'East coast', to: 'Main warehouse' },
		],
		verbs: [ __( 'Complete', 'vulocart' ) ],
	},
	reservations: {
		tabs: [ [ all, 3 ], [ active, 2 ], [ __( 'Released', 'vulocart' ), 1 ] ],
		search: __( 'Search reservations…', 'vulocart' ),
		columns: { reservation: __( 'Reservation', 'vulocart' ), warehouse: __( 'Warehouse', 'vulocart' ), reason: __( 'Reason', 'vulocart' ) },
		rows: [
			{ reservation: { title: '12 × Organic Cotton Tee', badges: [ [ active, 'active' ] ] }, warehouse: 'Main warehouse', reason: 'Wholesale order #VC-000031' },
			{ reservation: { title: '6 × Hand-poured Soy Candle', badges: [ [ active, 'active' ] ] }, warehouse: 'East coast', reason: 'Pop-up market' },
			{ reservation: { title: '20 × Linen Tote Bag', badges: [ [ __( 'Released', 'vulocart' ), 'inactive' ] ] }, warehouse: 'EU fulfilment', reason: 'Photo shoot' },
		],
		verbs: [ __( 'Release', 'vulocart' ) ],
	},
	history: {
		search: __( 'Search stock history…', 'vulocart' ),
		columns: { product: __( 'Product', 'vulocart' ), reference: __( 'Reference', 'vulocart' ), change: __( 'Change', 'vulocart' ), balance: __( 'Balance after', 'vulocart' ), when: __( 'When', 'vulocart' ) },
		numeric: [ 'change', 'balance' ],
		rows: [
			{ product: { title: 'Ceramic Coffee Mug', details: [ [ 'pro-tag', 'SKU MUG-01' ] ] }, reference: 'Order #VC-000020', change: '−2', balance: '42', when: 'Today, 09:14' },
			{ product: { title: 'Recycled Notebook', details: [ [ 'pro-tag', 'SKU NOTE-07' ] ] }, reference: 'PO-1039 received', change: '+200', balance: '207', when: 'Yesterday' },
			{ product: { title: 'Linen Tote Bag', details: [ [ 'pro-tag', 'SKU TOTE-02' ] ] }, reference: 'Manual adjustment', change: '−1', balance: '3', when: 'Nov 15, 2026' },
			{ product: { title: 'Organic Cotton Tee', details: [ [ 'pro-tag', 'SKU TEE-03' ] ] }, reference: 'Return #R-118', change: '+1', balance: '0', when: 'Nov 14, 2026' },
		],
	},
	shipments: {
		tabs: [ [ all, 4 ], [ __( 'In transit', 'vulocart' ), 2 ], [ __( 'Delivered', 'vulocart' ), 2 ] ],
		search: __( 'Search shipments…', 'vulocart' ),
		columns: { shipment: __( 'Shipment', 'vulocart' ), carrier: __( 'Carrier', 'vulocart' ), tracking: __( 'Tracking', 'vulocart' ) },
		rows: [
			{ shipment: { title: 'Order #VC-000020', badges: [ [ __( 'In transit', 'vulocart' ), 'processing' ] ], details: [ [ 'person', 'Alan Turing' ] ] }, carrier: 'UPS Ground', tracking: '1Z 999 AA1 0123 4567 84' },
			{ shipment: { title: 'Order #VC-000018', badges: [ [ __( 'In transit', 'vulocart' ), 'processing' ] ], details: [ [ 'person', 'Ada Lovelace' ] ] }, carrier: 'USPS Priority', tracking: '9400 1000 0000 0000 0000 00' },
			{ shipment: { title: 'Order #VC-000016', badges: [ [ __( 'Delivered', 'vulocart' ), 'completed' ] ], details: [ [ 'person', 'Marie Curie' ] ] }, carrier: 'DHL Express', tracking: '1234 5678 90' },
			{ shipment: { title: 'Order #VC-000014', badges: [ [ __( 'Delivered', 'vulocart' ), 'completed' ] ], details: [ [ 'person', 'Katherine Johnson' ] ] }, carrier: 'FedEx Home', tracking: '7489 2210 6631' },
		],
		icons: [ [ 'eye', __( 'Track', 'vulocart' ) ], [ 'edit', __( 'Edit', 'vulocart' ) ] ],
	},
	returns: {
		tabs: [ [ all, 3 ], [ __( 'Requested', 'vulocart' ), 1 ], [ __( 'Approved', 'vulocart' ), 1 ], [ __( 'Refunded', 'vulocart' ), 1 ] ],
		search: __( 'Search returns…', 'vulocart' ),
		columns: { return: __( 'Return', 'vulocart' ), reason: __( 'Reason', 'vulocart' ), refunded: __( 'Refunded', 'vulocart' ) },
		numeric: [ 'refunded' ],
		rows: [
			{ return: { title: 'R-121 · Order #VC-000019', badges: [ [ __( 'Requested', 'vulocart' ), 'pending' ] ], details: [ [ 'person', 'Grace Hopper' ] ] }, reason: 'Wrong size', refunded: '—' },
			{ return: { title: 'R-120 · Order #VC-000015', badges: [ [ __( 'Approved', 'vulocart' ), 'approved' ] ], details: [ [ 'person', 'Linus Pauling' ] ] }, reason: 'Arrived damaged', refunded: '—' },
			{ return: { title: 'R-118 · Order #VC-000012', badges: [ [ __( 'Refunded', 'vulocart' ), 'refunded' ] ], details: [ [ 'person', 'Grace Hopper' ] ] }, reason: 'Changed mind', refunded: '$32.00' },
		],
		verbs: [ __( 'Approve', 'vulocart' ) ],
		icons: [ [ 'close-delete', __( 'Reject', 'vulocart' ) ] ],
	},
	pickup: {
		tabs: [ [ all, 3 ], [ __( 'Scheduled', 'vulocart' ), 2 ], [ __( 'Ready', 'vulocart' ), 1 ] ],
		search: __( 'Search pickups…', 'vulocart' ),
		columns: { order: __( 'Order', 'vulocart' ), location: __( 'Location', 'vulocart' ), scheduled: __( 'Scheduled', 'vulocart' ) },
		rows: [
			{ order: { title: 'Order #VC-000021', badges: [ [ __( 'Scheduled', 'vulocart' ), 'pending' ] ], details: [ [ 'person', 'Ada Lovelace' ] ] }, location: 'Downtown store', scheduled: 'Today, 17:00' },
			{ order: { title: 'Order #VC-000017', badges: [ [ __( 'Ready', 'vulocart' ), 'confirmed' ] ], details: [ [ 'person', 'Alan Turing' ] ] }, location: 'Main warehouse', scheduled: 'Tomorrow, 10:00' },
			{ order: { title: 'Order #VC-000013', badges: [ [ __( 'Scheduled', 'vulocart' ), 'pending' ] ], details: [ [ 'person', 'Grace Hopper' ] ] }, location: 'Downtown store', scheduled: 'Fri, 12:30' },
		],
		verbs: [ __( 'Mark ready', 'vulocart' ) ],
	},
	'shipping-zones': {
		search: __( 'Search zones…', 'vulocart' ),
		columns: { zone: __( 'Zone', 'vulocart' ), countries: __( 'Countries', 'vulocart' ), rates: __( 'Rates', 'vulocart' ) },
		rows: [
			{ zone: { title: 'Domestic', details: [ [ 'delivery', 'Priority 1' ] ] }, countries: 'United States', rates: 'Standard $5.00 · Express $12.00' },
			{ zone: { title: 'Europe', details: [ [ 'delivery', 'Priority 2' ] ] }, countries: '27 countries', rates: 'Standard $14.00' },
			{ zone: { title: 'Rest of world', details: [ [ 'delivery', 'Priority 3' ] ] }, countries: 'Everywhere else', rates: 'Standard $22.00' },
		],
		icons: EDIT_DELETE,
	},
	'shipping-packaging': {
		search: __( 'Search packages…', 'vulocart' ),
		columns: { package: __( 'Package', 'vulocart' ), size: __( 'Size (L × W × H)', 'vulocart' ), weight: __( 'Max weight', 'vulocart' ) },
		rows: [
			{ package: { title: 'Small box', badges: [ [ __( 'Default', 'vulocart' ), 'active' ] ] }, size: '20 × 15 × 10 cm', weight: '2 kg' },
			{ package: { title: 'Mug box', details: [] }, size: '14 × 14 × 12 cm', weight: '1 kg' },
			{ package: { title: 'Poly mailer', details: [] }, size: '35 × 25 × 3 cm', weight: '0.5 kg' },
		],
		verbs: [ __( 'Make default', 'vulocart' ) ],
		icons: EDIT_DELETE,
	},
};

/** Pages whose view id is generic (`list`) or that several URLs share, keyed by the module that provides them. */
export const PREVIEWS_BY_MODULE: Record< string, PagePreview > = {
	'workflow-builder': {
		tabs: [ [ all, 4 ], [ active, 3 ], [ __( 'Paused', 'vulocart' ), 1 ] ],
		search: __( 'Search workflows…', 'vulocart' ),
		columns: { workflow: __( 'Workflow', 'vulocart' ), trigger: __( 'Trigger', 'vulocart' ), steps: __( 'Steps', 'vulocart' ) },
		numeric: [ 'steps' ],
		rows: [
			{ workflow: { title: 'Thank first-time buyers', badges: [ [ active, 'active' ] ], details: [ [ 'clock', 'Ran 14 times this week' ] ] }, trigger: 'Order completed', steps: '3' },
			{ workflow: { title: 'Low stock alert to supplier', badges: [ [ active, 'active' ] ], details: [ [ 'clock', 'Ran 2 times this week' ] ] }, trigger: 'Stock below threshold', steps: '2' },
			{ workflow: { title: 'Win back lapsed customers', badges: [ [ active, 'active' ] ], details: [ [ 'clock', 'Ran 31 times this week' ] ] }, trigger: 'No order in 90 days', steps: '4' },
			{ workflow: { title: 'Tag wholesale orders', badges: [ [ __( 'Paused', 'vulocart' ), 'inactive' ] ] }, trigger: 'Order created', steps: '1' },
		],
		icons: [ [ 'edit', __( 'Edit', 'vulocart' ) ], [ 'eye', __( 'Runs', 'vulocart' ) ], [ 'toggle', __( 'Turn off', 'vulocart' ) ] ],
	},
};

/** The sample screen for a view, if one is drawn: by its view id first, then by its module. */
export const previewFor = ( key: string | undefined, module: string ): PagePreview | undefined =>
	( key ? PREVIEWS[ key ] : undefined ) ?? PREVIEWS_BY_MODULE[ module ];
