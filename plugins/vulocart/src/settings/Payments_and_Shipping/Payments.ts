import { __ } from '@wordpress/i18n';
import PaymentsPanel from '../../components/Settings/PaymentsPanel';

/**
 * Commerce → Payments. The whole tab is the payment-methods panel
 * (`PanelComponent`, Settings.tsx's escape hatch for a tab that isn't a flat field list) - a list of
 * methods with Enable/Configure, like VuloMail's Connections. Its fields live in
 * `components/Settings/paymentsFields.ts`, and `vulocart-pro`'s gateways still append theirs through
 * the `vulocart_settings_fields` filter.
 */
export default {
	id: 'payments',
	priority: 3,
	headerTitle: __( 'Payments', 'vulocart' ),
	headerIcon: 'payment',
	hideSettingHeader: true,
	submitUrl: 'settings',
	PanelComponent: PaymentsPanel,
	modal: [],
};
