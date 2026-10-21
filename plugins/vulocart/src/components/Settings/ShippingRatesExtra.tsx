import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { ModuleRequired } from '../EngineScreen/EngineScreen';

/**
 * What follows the flat rate on Settings → Shipping & Tax → Shipping rates: vulocart-pro's zone rates, through
 * `vulocart_shipping_rates`. Without them the section is still listed, with the prompt to turn them on. Laid out as a
 * settings section (title and hint on the left, content on the right) like the fields above it.
 */
export default function ShippingRatesExtra() {
	const extra = applyFilters( 'vulocart_shipping_rates', null ) as ReactNode;

	return (
		<div className="form-group-wrapper vulocart-zone-rates">
			<div className="settings-section-group">
				<div className="settings-left-section">
					<div className="divider-section">
						<div className="title-wrapper">
							<div className="typography typography-title">
								<i className="adminfont-shipping" />
								<span>{ __( 'Zone rates', 'vulocart' ) }</span>
							</div>
						</div>
						<span className="typography typography-desc">{ __( 'Rates for the zones you ship to. They layer on top of the flat rate above - they never replace it.', 'vulocart' ) }</span>
					</div>
				</div>
				<div className="settings-right-section">
					<div className="vulocart-engine-page">
						{ extra || (
							<ModuleRequired
								view={ { title: __( 'Zone rates', 'vulocart' ), description: __( 'Rates by zone and weight, on top of the flat rate.', 'vulocart' ), icon: 'shipping', module: 'shipping', pro: true } }
							/>
						) }
					</div>
				</div>
			</div>
		</div>
	);
}
