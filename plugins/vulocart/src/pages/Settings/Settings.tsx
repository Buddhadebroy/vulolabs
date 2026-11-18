/* global vulocartLocalizer */
import { useEffect, useRef, useState } from '@wordpress/element';
import type { JSX } from 'react';
import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { useLocation, Link } from 'react-router-dom';
import { getApiLink, getApiResponse, getAvailableSettings, getSettingById } from '@zyra/core';
import { InputRenderer } from '@zyra/inputs';
import { CardComponent, NavigatorComponent, type SaveStatus } from '@zyra/components';
import { SettingProvider, useSetting } from '../../contexts/SettingContext';
import { getTemplateData } from '../../services/templateService';
import Popup from '../../components/Popup/Popup';
import ModulesPanel from '../../components/Settings/ModulesPanel';
import { getStates } from '../../blocks/shared/geo';

type Field = { key: string; type?: string; statesOf?: string; settingDescription?: string; [ prop: string ]: unknown };

/**
 * A field with `statesOf: '<country field key>'` (e.g. General's `store_state`) is a region picker for that country:
 * a dropdown of its regions when geo.ts has a list for it (the same list the checkout uses), otherwise free text.
 */
function resolveRegionFields( modal: Field[], values: Record< string, unknown > ): Field[] {
	return modal.map( ( field ) => {
		if ( ! field.statesOf ) {
			return field;
		}

		const states = getStates( String( values[ field.statesOf ] ?? '' ) );

		return states
			? { ...field, type: 'select', settingDescription: undefined, options: [ { label: __( 'Select a state / region…', 'vulocart' ), value: '' }, ...states ] }
			: { ...field, type: 'text' };
	} );
}

/**
 * Settings screen. Settings are one flat option (`Utill::SETTINGS_KEY`). `getTemplateData()`
 * (services/templateService.ts) scans `src/settings/*.ts` for the tabs.
 */
const Settings = () => {
	const [ isLoading, setIsLoading ] = useState( true );
	const [ error, setError ] = useState< string | null >( null );
	const [ saveStatus, setSaveStatus ] = useState< SaveStatus >( 'idle' );
	const settingsRef = useRef< Record< string, unknown > >( {} );

	const settingsArray = getAvailableSettings( getTemplateData( 'settings' ), [] );
	const location = new URLSearchParams( useLocation().hash.substring( 1 ) );

	const loadSettings = () => {
		setIsLoading( true );
		setError( null );

		getApiResponse< Record< string, unknown > >(
			getApiLink( vulocartLocalizer, 'settings' ),
			{ headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } }
		)
			.then( ( response ) => {
				if ( ! response ) {
					setError( __( 'Could not load settings.', 'vulocart' ) );
					return;
				}

				settingsRef.current = response;
			} )
			.finally( () => setIsLoading( false ) );
	};

	useEffect( () => {
		loadSettings();
	}, [] );

	const GetForm = ( currentTab: string | null ): JSX.Element | null => {
		// Every hook must run on every call, whatever the current tab is: an early return before a hook would change
		// the number of hooks React sees between renders.
		const { setting, settingName, setSetting, updateSetting } = useSetting();

		const rawSettingModal = currentTab ? getSettingById( settingsArray, currentTab ) : null;

		// Lets a Pro module (a payment gateway registering its own
		// credential fields onto the Payments tab, for instance) append
		// fields to an existing tab without this plugin knowing that
		// module exists - same "compose-many, filter-context-routed"
		// shape `vulocart_product_edit_sections` already establishes.
		// Applied here (at render time), not inside the tab's own static
		// `src/settings/*.ts` file - those are collected via a
		// `require.context` that runs eagerly on script load, before a
		// separately-enqueued Pro bundle has necessarily executed its own
		// `addFilter()` call; by the time this component renders, every
		// admin script has already run.
		const settingModal = rawSettingModal
			? {
					...rawSettingModal,
					modal: resolveRegionFields(
						applyFilters( 'vulocart_settings_fields', rawSettingModal.modal, { settingId: currentTab } ) as Field[],
						settingName === currentTab ? ( setting as Record< string, unknown > ) : {}
					),
			  }
			: null;

		// A region picker empties when its country changes, so a state code never outlives the country it belongs to.
		const regionFields = ( settingModal?.modal ?? [] ).filter( ( field: Field ) => field.statesOf ) as Field[];
		const regionCountries = regionFields.map( ( field ) => String( ( setting as Record< string, unknown > )?.[ field.statesOf as string ] ?? '' ) ).join( '|' );
		const lastCountries = useRef< string | null >( null );

		useEffect( () => {
			if ( settingName !== currentTab ) {
				lastCountries.current = null;
				return;
			}

			const previous = lastCountries.current?.split( '|' );
			lastCountries.current = regionCountries;

			if ( ! previous ) {
				return;
			}

			regionFields.forEach( ( field, index ) => {
				if ( previous[ index ] !== String( ( setting as Record< string, unknown > )[ field.statesOf as string ] ?? '' ) && ( setting as Record< string, unknown > )[ field.key ] ) {
					updateSetting( field.key, '' );
				}
			} );
		}, [ regionCountries, settingName, currentTab ] );

		const fieldKeys: string[] = ( settingModal?.modal ?? [] ).map(
			( field: { key: string } ) => field.key
		);

		// When the tab changes, an effect copies that tab's stored values into the settings state. It is an effect
		// and not a `setSetting()` call in the render body, which would trigger React's "Cannot update a component
		// while rendering a different component" warning and a visible double render when switching tabs.
		useEffect( () => {
			if ( currentTab && settingName !== currentTab ) {
				const tabFields: Record< string, unknown > = {};
				fieldKeys.forEach( ( key ) => {
					tabFields[ key ] = settingsRef.current[ key ];
				} );
				setSetting( currentTab, tabFields );
			}
		}, [ currentTab, settingName ] );

		useEffect( () => {
			if ( currentTab && settingName === currentTab ) {
				settingsRef.current = { ...settingsRef.current, ...setting };
			}
		}, [ setting, settingName, currentTab ] );

		if ( ! currentTab ) {
			return null;
		}

		// Modules is a sub-tab of Settings (settings/Modules.ts) and is handled here on its own. ModulesPanel draws
		// its own `NavigatorHeaderComponent`, so it does not use the generic PanelComponent below.
		if ( 'modules' === currentTab ) {
			return <ModulesPanel />;
		}

		// A tab can supply a fully custom component instead of InputRenderer's declarative field schema (for example
		// the Licensing tab of vulocart-pro). A panel with no fields of its own (Pro filters may still add some,
		// which the panel draws itself); a panel that declares its own `modal` fields (Tax) is drawn after them,
		// below.
		if ( settingModal?.PanelComponent && ! rawSettingModal?.modal?.length ) {
			const PanelComponent = settingModal.PanelComponent;
			return <PanelComponent />;
		}

		return (
			<>
				{ settingName === currentTab ? (
					<>
					<InputRenderer
						settings={ settingModal }
						setting={ setting }
						updateSetting={ updateSetting }
						Popup={ Popup }
						// A tab can opt in to InputRenderer's card-grouped layout with `groupBySections: true`
						// (General.ts is the first).
						groupBySections={ settingModal?.groupBySections }
						onSaveStatusChange={ setSaveStatus }
					/>
					{ /* A section that isn't a field list (e.g. Integrations' VuloCloud AI connection) is
					      drawn after the declarative ones. */ }
					{ settingModal?.AfterComponent && <settingModal.AfterComponent /> }
					{ settingModal?.PanelComponent && <settingModal.PanelComponent /> }
					</>
				) : (
					<>{ __( 'Loading…', 'vulocart' ) }</>
				) }
			</>
		);
	};

	if ( error ) {
		return (
			<CardComponent title={ __( 'Settings', 'vulocart' ) }>
				<p>{ error }</p>
			</CardComponent>
		);
	}

	if ( isLoading ) {
		return <CardComponent title={ __( 'Settings', 'vulocart' ) } isLoading />;
	}

	return (
		<SettingProvider>
			<NavigatorComponent
				settingContent={ settingsArray }
				currentSetting={ location.get( 'subtab' ) as string }
				getForm={ GetForm }
				prepareUrl={ ( subTab: string ) =>
					`?page=vulocart#&tab=settings&subtab=${ subTab }`
				}
				appLocalizer={ vulocartLocalizer }
				Link={ Link }
				settingName="Settings"
				// `admin-settings` is the class zyra scopes the settings spacing under (form-group padding, section
				// rows). Without it the fields sit flush against their labels and the row edges.
				className="admin-settings vulocart-settings"
				menuIcon
				saveStatus={ saveStatus }
			/>
		</SettingProvider>
	);
};

export default Settings;
