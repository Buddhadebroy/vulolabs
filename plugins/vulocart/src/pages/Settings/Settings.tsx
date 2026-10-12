/* global vulocartLocalizer */
import { useEffect, useRef, useState } from '@wordpress/element';
import type { JSX } from 'react';
import { __ } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { useLocation, Link } from 'react-router-dom';
import { getApiLink, getApiResponse, getAvailableSettings, getSettingById } from '@zyra/core';
import { InputRenderer } from '@zyra/inputs';
import { CardComponent, NavigatorComponent } from '@zyra/components';
import { SettingProvider, useSetting } from '../../contexts/SettingContext';
import { getTemplateData } from '../../services/templateService';
import Popup from '../../components/Popup/Popup';
import ModulesPanel from '../../components/Settings/ModulesPanel';

/**
 * Ported from `vulopilot/src/pages/Settings/Settings.tsx`'s flat-option
 * structure (not a per-tab-namespaced one, which doesn't
 * apply - VuloCart has one flat `wp_options` row, Utill::SETTINGS_KEY).
 * `getTemplateData()` now comes from `../../services/templateService.ts`,
 * a `require.context` scan of `src/settings/*.ts` - the plugin's admin-UX
 * brief calls for 12 real tabs (General/Catalog/Cart/Checkout/Payments/
 * Shipping/Taxes/Email/API/MCP/AI/Advanced), so the one-file direct-import
 * shortcut this page used to take no longer applies.
 */
const Settings = () => {
	const [ isLoading, setIsLoading ] = useState( true );
	const [ error, setError ] = useState< string | null >( null );
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

	useEffect( loadSettings, [] );

	const GetForm = ( currentTab: string | null ): JSX.Element | null => {
		// Every hook this function uses must run on every call regardless
		// of currentTab - matches vulopilot's own Settings.tsx docblock on
		// this exact point (an early return before a hook call would make
		// the number of hooks React sees differ between renders).
		const { setting, settingName, setSetting, updateSetting } = useSetting();

		const rawSettingModal = currentTab ? getSettingById( settingsArray, currentTab ) : null;

		// Lets a Pro module (a payment gateway registering its own
		// credential fields onto the Payments tab, for instance) append
		// fields to an existing tab without this plugin knowing that
		// module exists - same "compose-many, filter-context-routed"
		// shape `vulocart_offering_edit_sections` already establishes.
		// Applied here (at render time), not inside the tab's own static
		// `src/settings/*.ts` file - those are collected via a
		// `require.context` that runs eagerly on script load, before a
		// separately-enqueued Pro bundle has necessarily executed its own
		// `addFilter()` call; by the time this component renders, every
		// admin script has already run.
		const settingModal = rawSettingModal
			? {
					...rawSettingModal,
					modal: applyFilters( 'vulocart_settings_fields', rawSettingModal.modal, { settingId: currentTab } ),
			  }
			: null;

		const fieldKeys: string[] = ( settingModal?.modal ?? [] ).map(
			( field: { key: string } ) => field.key
		);

		// Was a synchronous `setSetting()` call made straight in the render
		// body - triggers React's "Cannot update a component while
		// rendering a different component" warning and a visible
		// double-render flash when switching tabs. Matches vulopilot's own
		// Settings.tsx docblock on this exact point.
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

		// Modules moved inside Settings as its own subtab (settings/Modules.ts)
		// - same special-cased branch vulopilot's own Settings.tsx uses for its
		// identically-migrated Modules tab, rather than the generic
		// PanelComponent escape hatch below (ModulesPanel predates that
		// mechanism and has its own NavigatorHeaderComponent already).
		if ( 'modules' === currentTab ) {
			return <ModulesPanel />;
		}

		// Pro's escape hatch for a tab that needs a fully custom
		// component instead of InputRenderer's declarative field schema
		// (e.g. vulocart-pro's Licensing tab) - same mechanism vulopilot's
		// own Settings.tsx establishes.
		if ( settingModal?.PanelComponent ) {
			const PanelComponent = settingModal.PanelComponent;
			return <PanelComponent />;
		}

		return (
			<>
				{ settingName === currentTab ? (
					<InputRenderer
						settings={ settingModal }
						setting={ setting }
						updateSetting={ updateSetting }
						Popup={ Popup }
						// Per-tab opt-in (General.ts's own `groupBySections: true` is the
						// first) into InputRenderer's card-grouped layout - same mechanism
						// vulopilot's own Settings.tsx uses.
						groupBySections={ settingModal?.groupBySections }
					/>
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
				className="vulocart-settings"
				menuIcon
			/>
		</SettingProvider>
	);
};

export default Settings;
