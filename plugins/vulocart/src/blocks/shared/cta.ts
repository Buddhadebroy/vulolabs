import { __ } from '@wordpress/i18n';

/** The storefront button reads like what is being sold: Book now, Donate, Enroll… (everything else: Add to cart). */
export function ctaLabel( type: string | undefined ): string {
	switch ( type ) {
		case 'booking':
			return __( 'Book now', 'vulocart' );
		case 'donation':
			return __( 'Donate', 'vulocart' );
		case 'course':
			return __( 'Enroll', 'vulocart' );
		case 'subscription':
		case 'membership':
			return __( 'Subscribe', 'vulocart' );
		case 'service':
			return __( 'Request this service', 'vulocart' );
		case 'rental':
			return __( 'Rent now', 'vulocart' );
		case 'gift_card':
			return __( 'Buy gift card', 'vulocart' );
		default:
			return __( 'Add to cart', 'vulocart' );
	}
}
