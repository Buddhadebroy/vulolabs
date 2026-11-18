import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { ModuleRequired } from '../EngineScreen/EngineScreen';
import { ProSample, proLocked } from '../Popup/ProSample';

/** Made-up rates in the shape of vulocart-pro's rates list (Fulfillment/src/RatesPage.tsx): rate, zone, weight band, cost. */
const SAMPLE_RATES: Array< { rate: string; zone: string; weight: string; cost: string; free?: string } > = [
	{ rate: 'Standard', zone: 'Domestic', weight: '0 – 5 kg', cost: '$5.00' },
	{ rate: 'Express', zone: 'Domestic', weight: '0 – 5 kg', cost: '$12.00' },
	{ rate: 'Standard', zone: 'Europe', weight: '0 – 10 kg', cost: '$14.00', free: '$150' },
	{ rate: 'Heavy items', zone: 'Rest of world', weight: '10 kg – ∞', cost: '$22.00 + $2.00 / kg' },
];

/** Zone rates while vulocart-pro doesn't provide them (not installed, or no active license): sample rates, Pro popup. */
function ZoneRatesPreview() {
	return (
		<ProSample
			feature={ {
				title: __( 'Zone rates', 'vulocart' ),
				description: __( 'Different rates for each zone you ship to, by weight band, with a cost per kg and free shipping above an order total.', 'vulocart' ),
				icon: 'shipping',
			} }
			text={ __( 'Charge by zone and weight, on top of the flat rate.', 'vulocart' ) }
			cta={ __( 'Unlock zone rates', 'vulocart' ) }
		>
			<table>
				<thead>
					<tr>
						<th>{ __( 'Rate', 'vulocart' ) }</th>
						<th>{ __( 'Zone', 'vulocart' ) }</th>
						<th>{ __( 'Weight', 'vulocart' ) }</th>
						<th className="is-num">{ __( 'Cost', 'vulocart' ) }</th>
					</tr>
				</thead>
				<tbody>
					{ SAMPLE_RATES.map( ( row, index ) => (
						<tr key={ index }>
							<td>
								<strong>{ row.rate }</strong>
								{ row.free && <span className="vc-sample-hint">{ `${ __( 'Free above', 'vulocart' ) } ${ row.free }` }</span> }
							</td>
							<td>{ row.zone }</td>
							<td>{ row.weight }</td>
							<td className="is-num">{ row.cost }</td>
						</tr>
					) ) }
				</tbody>
			</table>
		</ProSample>
	);
}

/**
 * What follows the flat rate on Settings → Shipping & Tax → Shipping rates: vulocart-pro's zone rates, through
 * `vulocart_shipping_rates`. Without Pro (or its license) the section shows sample rates with the Pro popup; with a
 * licensed Pro whose module is off, the prompt to turn it on. Laid out as a settings section (title and hint on the
 * left, content on the right) like the fields above it.
 */
export default function ShippingRatesExtra() {
	const extra = applyFilters( 'vulocart_shipping_rates', null ) as ReactNode;
	let content: ReactNode = extra;

	if ( ! content ) {
		content = proLocked() ? (
			<ZoneRatesPreview />
		) : (
			<ModuleRequired
				view={ { title: __( 'Zone rates', 'vulocart' ), description: __( 'Rates by zone and weight, on top of the flat rate.', 'vulocart' ), icon: 'shipping', module: 'shipping', pro: true } }
			/>
		);
	}

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
					<div className="vulocart-engine-page">{ content }</div>
				</div>
			</div>
		</div>
	);
}
