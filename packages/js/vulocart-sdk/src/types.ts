/**
 * Shapes shared across the SDK — deliberately loose/partial (only the
 * fields this package actually reads), the same "don't restate the whole
 * server-side domain shape" posture the WordPress-side Checkout Engine's
 * own `CheckoutRunData` already takes (registry.ts, vulocart's own
 * checkout-engine).
 */

export interface SdkConfig {
	siteUrl: string;
	restUrl: string;
	currency: string;
	proActive: boolean;
	proSdkUrl: string | null;
	features: {
		buyButton: boolean;
		embeddedCart: boolean;
		embeddedCheckout: boolean;
		popupCheckout: boolean;
		drawerCheckout: boolean;
		checkoutLinks: boolean;
		hostedCheckout: boolean;
	};
}

export interface CartItem {
	id: number;
	offering_id: number;
	title: string;
	type: string;
	quantity: number;
	unit_price: number;
	currency: string | null;
	subtotal: number;
}

export interface Cart {
	token: string;
	currency: string;
	item_count: number;
	items: CartItem[];
	totals: {
		currency: string;
		item_count: number;
		subtotal: number;
		total: number;
	};
}

export interface AddressFields {
	full_name: string;
	phone?: string;
	address_1: string;
	address_2?: string;
	city: string;
	state: string;
	postcode: string;
	country: string;
}

export interface ShippingMethod {
	id: string;
	label: string;
	cost: number;
}

export interface Order {
	id: number;
	order_number: string;
	total: number;
	currency: string;
	access_token: string;
	[ key: string ]: unknown;
}

export interface PlaceOrderPayload {
	cart_token: string;
	customer_email: string;
	customer_name: string;
	customer_phone?: string;
	billing_address: AddressFields;
	shipping_address?: AddressFields;
	shipping_method: string;
	payment_method: string;
}
