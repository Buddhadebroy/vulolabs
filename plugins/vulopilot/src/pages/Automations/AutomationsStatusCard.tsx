/* global vulopilotAppLocalizer */
import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { AnalyticsComponent, CardComponent } from '@zyra/components';
import type { AutomationRow } from './automationsTypes';

interface StatusCounts {
	enabled: number;
	disabled: number;
}

/** The 2 free built-in rows (Automations\BuiltinAutomationSeeder) - everything else in `GET /automations` is a custom automation. */
const BUILTIN_TRIGGERS = [ 'free_full_site_scan', 'free_visibility_report' ];

const nonceHeaders = { headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } };

/**
 * "Automation status" - a quick 4-tile health overview (Active / Not active / Errors / Custom
 * automations), using `AnalyticsComponent`'s own `variant="dashboard"` (zyra Storybook's
 * `Components/AnalyticsComponent/Dashboard` story) - each tile's smaller caption renders in the
 * `extra` report row under the number, same as that story, rather than folded into `text` by hand.
 */
const AutomationsStatusCard = ( { refetchSignal }: { refetchSignal: number } ) => {
	const [ counts, setCounts ] = useState<StatusCounts>( { enabled: 0, disabled: 0 } );
	const [ custom, setCustom ] = useState( 0 );
	const [ errors, setErrors ] = useState( 0 );
	const [ isLoading, setIsLoading ] = useState( true );

	useEffect( () => {
		let cancelled = false;

		Promise.all( [
			getApiResponse<{ status_counts?: StatusCounts; data?: AutomationRow[] }>(
				`${ getApiLink( vulopilotAppLocalizer, 'automations' ) }?per_page=100`,
				nonceHeaders
			),
			getApiResponse<{ failed?: number }>(
				`${ getApiLink( vulopilotAppLocalizer, 'automation-dashboard-stats' ) }?period=month`,
				nonceHeaders
			),
		] )
			.then( ( [ automations, stats ] ) => {
				if ( cancelled ) {
					return;
				}

				if ( automations?.status_counts ) {
					setCounts( automations.status_counts );
				}

				const rows = Array.isArray( automations?.data ) ? automations.data : [];
				setCustom( rows.filter( ( row ) => ! BUILTIN_TRIGGERS.includes( row.trigger_type ) ).length );
				setErrors( stats?.failed ?? 0 );
			} )
			.finally( () => {
				if ( ! cancelled ) {
					setIsLoading( false );
				}
			} );

		return () => {
			cancelled = true;
		};
	}, [ refetchSignal ] );

	const total = counts.enabled + counts.disabled;
	const dash = '-';

	return (
		<CardComponent
			title={ __( 'Automation status', 'vulopilot' ) }
			titleIcon="ai"
			desc={ __( 'A quick overview of your automation health.', 'vulopilot' ) }
		>
			<AnalyticsComponent
				variant="dashboard"
				cols={ 2 }
				data={ [
					{
						icon: 'check green',
						number: isLoading ? dash : counts.enabled,
						text: __( 'Active', 'vulopilot' ),
						extra: isLoading ? '' : (
							<div>
								{ sprintf(
									/* translators: %d is the total number of automations (built-in + custom). */
									_n( 'out of %d automation', 'out of %d automations', total, 'vulopilot' ),
									total
								) }
							</div>
						),
					},
					{
						icon: 'clock orange',
						number: isLoading ? dash : counts.disabled,
						text: __( 'Not active', 'vulopilot' ),
						extra: <div>{ __( 'needs setup', 'vulopilot' ) }</div>,
					},
					{
						icon: 'error red',
						number: isLoading ? dash : errors,
						text: __( 'Errors', 'vulopilot' ),
						extra: <div>{ __( 'in the last 30 days', 'vulopilot' ) }</div>,
					},
					{
						icon: 'ai purple',
						number: isLoading ? dash : custom,
						text: __( 'Custom automations', 'vulopilot' ),
						extra: <div>{ __( 'created', 'vulopilot' ) }</div>,
					},
				] }
			/>
		</CardComponent>
	);
};

export default AutomationsStatusCard;
