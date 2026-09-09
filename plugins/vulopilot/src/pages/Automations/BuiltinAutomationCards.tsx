/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import { CardComponent, FormGroupComponent, FormGroupWrapperComponent } from '@zyra/components';
import { ButtonInput, MultiCheckboxInput, SelectInput } from '@zyra/inputs';
import type { AutomationRow } from './ManageAutomationsSection';
import './BuiltinAutomationCards.scss';

/** Automations\BuiltinAutomationSeeder's own two TRIGGER_* constants — the only trigger_type values this component ever renders a card for. */
const FULL_SITE_SCAN_TRIGGER = 'free_full_site_scan';
const VISIBILITY_REPORT_TRIGGER = 'free_visibility_report';

interface BuiltinTriggerConfig {
	frequency: string;
	day_of_week?: number;
}

interface BuiltinRow extends AutomationRow {
	trigger_config: string | null;
}

const DAY_OPTIONS = [
	{ label: __( 'Monday', 'vulopilot' ), value: '1' },
	{ label: __( 'Tuesday', 'vulopilot' ), value: '2' },
	{ label: __( 'Wednesday', 'vulopilot' ), value: '3' },
	{ label: __( 'Thursday', 'vulopilot' ), value: '4' },
	{ label: __( 'Friday', 'vulopilot' ), value: '5' },
	{ label: __( 'Saturday', 'vulopilot' ), value: '6' },
	{ label: __( 'Sunday', 'vulopilot' ), value: '7' },
];

const parseTriggerConfig = ( row: BuiltinRow ): BuiltinTriggerConfig => {
	try {
		const parsed = JSON.parse( row.trigger_config || '{}' );
		return { frequency: 'disabled', ...parsed };
	} catch ( error ) {
		return { frequency: 'disabled' };
	}
};

interface BuiltinAutomationCardProps {
	row: BuiltinRow;
	title: string;
	description: string;
	frequencyOptions: { label: string; value: string }[];
	onChanged: () => void;
}

const BuiltinAutomationCard = ( {
	row,
	title,
	description,
	frequencyOptions,
	onChanged,
}: BuiltinAutomationCardProps ) => {
	const [ isRunning, setIsRunning ] = useState( false );
	const config = parseTriggerConfig( row );

	const patch = ( data: Record<string, unknown> ) => {
		sendApiResponse( appLocalizer, getApiLink( appLocalizer, `automations/${ row.id }` ), data ).then(
			( response ) => {
				if ( response ) {
					onChanged();
				}
			}
		);
	};

	const handleToggle = () => {
		patch( { status: 'enabled' === row.status ? 'disabled' : 'enabled' } );
	};

	const handleFrequencyChange = ( value: string ) => {
		const nextConfig: BuiltinTriggerConfig = { frequency: value };

		if ( 'weekly' === value ) {
			nextConfig.day_of_week = config.day_of_week ?? 1;
		}

		patch( { trigger_config: nextConfig } );
	};

	const handleDayChange = ( value: string ) => {
		patch( { trigger_config: { frequency: config.frequency, day_of_week: Number( value ) } } );
	};

	const handleRunNow = () => {
		setIsRunning( true );

		sendApiResponse( appLocalizer, getApiLink( appLocalizer, `automations/${ row.id }/run` ), {} )
			.then( ( response ) => {
				if ( response ) {
					onChanged();
				}
			} )
			.finally( () => setIsRunning( false ) );
	};

	return (
		<CardComponent title={ title } titleIcon="automation" desc={ description }>
			<FormGroupWrapperComponent>
				<FormGroupComponent row label={ __( 'Enable this automation', 'vulopilot' ) }>
					<MultiCheckboxInput
						look="toggle"
						options={ [ { key: `automation-${ row.id }-enabled`, value: 'enabled', label: '' } ] }
						value={ 'enabled' === row.status ? [ 'enabled' ] : [] }
						onChange={ handleToggle }
						modules={ [] }
					/>
				</FormGroupComponent>
				<FormGroupComponent row label={ __( 'When should this automation run?', 'vulopilot' ) }>
					<SelectInput
						value={ config.frequency }
						size={ 15 }
						onChange={ ( value ) => handleFrequencyChange( value as string ) }
						options={ frequencyOptions }
					/>
				</FormGroupComponent>
				{ 'weekly' === config.frequency && (
					<FormGroupComponent row label={ __( 'Run on', 'vulopilot' ) }>
						<SelectInput
							value={ String( config.day_of_week ?? 1 ) }
							size={ 15 }
							onChange={ ( value ) => handleDayChange( value as string ) }
							options={ DAY_OPTIONS }
						/>
					</FormGroupComponent>
				) }
				{ 'monthly' === config.frequency && (
					<FormGroupComponent row label={ __( 'Run on', 'vulopilot' ) }>
						<span className="builtin-automation-fixed-day">
							{ __( '1st day of every month', 'vulopilot' ) }
						</span>
					</FormGroupComponent>
				) }
			</FormGroupWrapperComponent>
			<ButtonInput
				position="left"
				buttons={ {
					text: isRunning ? __( 'Running…', 'vulopilot' ) : __( 'Run now', 'vulopilot' ),
					disabled: isRunning,
					onClick: handleRunNow,
				} }
			/>
		</CardComponent>
	);
};

interface BuiltinAutomationCardsProps {
	/** Bumped by the host after something changes elsewhere on the page — refetches this component's own copy of the two rows. */
	refetchSignal: number;
	/** Called after this component's own mutations (toggle/frequency/run now) so sibling cards (stats, attention, activity) refetch too. */
	onChanged: () => void;
}

/**
 * The real UX the spec calls for — "Automation → Choose frequency → Save"
 * — for Free's exactly-2 built-in automations (Automations\
 * BuiltinAutomationSeeder). No template picker, no wizard: each row's own
 * `status`/`trigger_config` (JSON: `{frequency, day_of_week?}`) is the
 * entire editable surface, autosaved via the same `PATCH /automations/{id}`
 * route every other automation status-toggle already uses (now also
 * accepting `trigger_config` for these two rows specifically — see
 * Controllers\Automations::validate_builtin_trigger_config()'s own
 * docblock).
 */
const BuiltinAutomationCards = ( { refetchSignal, onChanged }: BuiltinAutomationCardsProps ) => {
	const [ rows, setRows ] = useState<BuiltinRow[]>( [] );
	const [ isLoading, setIsLoading ] = useState( true );

	const fetchRows = () => {
		setIsLoading( true );

		getApiResponse<{ data: BuiltinRow[] } | BuiltinRow[]>(
			`${ getApiLink( appLocalizer, 'automations' ) }?per_page=100`,
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then( ( response ) => {
				const list = Array.isArray( response ) ? response : ( response?.data ?? [] );
				setRows(
					list.filter( ( row ) =>
						[ FULL_SITE_SCAN_TRIGGER, VISIBILITY_REPORT_TRIGGER ].includes( row.trigger_type )
					)
				);
			} )
			.finally( () => setIsLoading( false ) );
	};

	// eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately re-fetches only on mount and when refetchSignal bumps; fetchRows is redefined every render.
	useEffect( fetchRows, [ refetchSignal ] );

	if ( isLoading ) {
		return null;
	}

	const scanRow = rows.find( ( row ) => FULL_SITE_SCAN_TRIGGER === row.trigger_type ) ?? null;
	const reportRow = rows.find( ( row ) => VISIBILITY_REPORT_TRIGGER === row.trigger_type ) ?? null;

	const handleChanged = () => {
		fetchRows();
		onChanged();
	};

	return (
		<div className="builtin-automation-cards">
			{ scanRow && (
				<BuiltinAutomationCard
					row={ scanRow }
					title={ __( 'Run Full Site Scan', 'vulopilot' ) }
					description={ __(
						'Automatically scan your website and refresh your VuloPilot insights.',
						'vulopilot'
					) }
					frequencyOptions={ [
						{ label: __( 'Manual only', 'vulopilot' ), value: 'manual' },
						{ label: __( 'Every day', 'vulopilot' ), value: 'daily' },
						{ label: __( 'Every week', 'vulopilot' ), value: 'weekly' },
						{ label: __( 'Every month', 'vulopilot' ), value: 'monthly' },
					] }
					onChanged={ handleChanged }
				/>
			) }
			{ reportRow && (
				<BuiltinAutomationCard
					row={ reportRow }
					title={ __( 'Send Visibility Report', 'vulopilot' ) }
					description={ __(
						"Receive a summary of your website's visibility, issues, and opportunities.",
						'vulopilot'
					) }
					frequencyOptions={ [
						{ label: __( 'Every week', 'vulopilot' ), value: 'weekly' },
						{ label: __( 'Every month', 'vulopilot' ), value: 'monthly' },
					] }
					onChanged={ handleChanged }
				/>
			) }
		</div>
	);
};

export default BuiltinAutomationCards;
