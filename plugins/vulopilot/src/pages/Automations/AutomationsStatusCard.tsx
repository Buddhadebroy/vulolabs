/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent } from '@zyra/components';
import type { AutomationRow } from './automationsTypes';

interface StatusCounts {
	enabled: number;
	disabled: number;
}

/** The 2 free built-in rows (Automations\BuiltinAutomationSeeder) — everything else in `GET /automations` is a custom automation. */
const BUILTIN_TRIGGERS = [ 'free_full_site_scan', 'free_visibility_report' ];

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

interface StatusTileProps {
	tone: 'green' | 'gray' | 'blue' | 'purple';
	icon: string;
	value: number | string;
	label: string;
	sub: string;
}

const StatusTile = ( { tone, icon, value, label, sub }: StatusTileProps ) => (
	<div className={ `automation-status-tile is-${ tone }` }>
		<span className="automation-status-tile-icon">
			<i className={ `adminfont-${ icon }` } />
		</span>
		<strong className="automation-status-tile-value">{ value }</strong>
		<div className="automation-status-tile-label">{ label }</div>
		<small className="automation-status-tile-sub">{ sub }</small>
	</div>
);

/**
 * "Automation status" — a quick 4-tile health overview (Active / Not active /
 * Errors / Custom automations), replacing the old "Your website is being
 * watched" and "This month" cards per the redesigned Automations mockup.
 * Every number is real: `GET /automations`' own `status_counts` and rows
 * (custom = every row that isn't one of the 2 built-ins), and
 * `GET /automation-dashboard-stats?period=month`'s own real failed-run count
 * for "Errors".
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
				`${ getApiLink( appLocalizer, 'automations' ) }?per_page=100`,
				nonceHeaders
			),
			getApiResponse<{ failed?: number }>(
				`${ getApiLink( appLocalizer, 'automation-dashboard-stats' ) }?period=month`,
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
	const dash = '—';

	return (
		<CardComponent
			title={ __( 'Automation status', 'vulopilot' ) }
			titleIcon="ai"
			desc={ __( 'A quick overview of your automation health.', 'vulopilot' ) }
		>
			<div className="automation-status-tiles">
				<StatusTile
					tone="green"
					icon="check"
					value={ isLoading ? dash : counts.enabled }
					label={ __( 'Active', 'vulopilot' ) }
					sub={
						isLoading
							? ''
							: sprintf(
									/* translators: %d is the total number of automations (built-in + custom). */
									_n( 'out of %d automation', 'out of %d automations', total, 'vulopilot' ),
									total
								)
					}
				/>
				<StatusTile
					tone="gray"
					icon="clock"
					value={ isLoading ? dash : counts.disabled }
					label={ __( 'Not active', 'vulopilot' ) }
					sub={ __( 'needs setup', 'vulopilot' ) }
				/>
				<StatusTile
					tone="blue"
					icon="error"
					value={ isLoading ? dash : errors }
					label={ __( 'Errors', 'vulopilot' ) }
					sub={ __( 'in the last 30 days', 'vulopilot' ) }
				/>
				<StatusTile
					tone="purple"
					icon="ai"
					value={ isLoading ? dash : custom }
					label={ __( 'Custom automations', 'vulopilot' ) }
					sub={ __( 'created', 'vulopilot' ) }
				/>
			</div>
		</CardComponent>
	);
};

export default AutomationsStatusCard;
