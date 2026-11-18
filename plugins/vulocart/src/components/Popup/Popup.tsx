/* global vulocartLocalizer */
import React from 'react';
import { ButtonInput } from '@zyra/inputs';
import { __, sprintf } from '@wordpress/i18n';
import MODULES_CATALOG, { isModuleCatalogEntry, moduleCardId } from '../../modules-config';
import './Popup.scss';

/** The page or feature the upgrade was asked from, shown first in the Pro popup. */
export interface ProFeature {
	title: string;
	description: string;
	icon?: string;
}

interface PopupProps {
	moduleName?: string;
	plugin?: string;
	feature?: ProFeature;
}

/**
 * Known acronym module ids get their real casing ("MCP", "AI") instead
 * of the generic capitalize-each-word fallback, which would otherwise
 * read "Mcp"/"Ai" - everything else falls back to that generic rule.
 */
const ACRONYM_LABELS: Record< string, string > = {
	mcp: 'MCP',
	ai: 'AI',
};

/**
 * The popup header icon is `adminfont-${moduleName}`. That works for module ids that are also an icon name, but 'mcp'
 * has no matching glyph in zyra's icon set (`ai` does), so it is overridden here instead of renaming the module id.
 */
const ICON_OVERRIDES: Record< string, string > = {
	mcp: 'centralized-connections',
};

const CATALOG_BY_ID = new Map( MODULES_CATALOG.modules.filter( isModuleCatalogEntry ).map( ( module ) => [ module.id, module ] ) );

/**
 * Returns the name Settings → Modules shows for a module, so the popup and the module card always agree.
 */
const formatModuleName = ( name: string ): string => {
	// The name Settings → Modules shows for it, so the popup and the card always agree.
	const card = CATALOG_BY_ID.get( moduleCardId( name ) );

	if ( card ) {
		return card.name;
	}

	if ( ACRONYM_LABELS[ name ] ) {
		return ACRONYM_LABELS[ name ];
	}

	return name
		.split( '-' )
		.map( ( word ) => word.charAt( 0 ).toUpperCase() + word.slice( 1 ) )
		.join( ' ' );
};

/** What the Pro popup lists: every module that ships in vulocart-pro, in the order the Modules screen shows them. */
const PRO_MODULES = MODULES_CATALOG.modules.filter( isModuleCatalogEntry ).filter( ( module ) => module.proModule );

/**
 * The popup zyra's InputRenderer opens when a locked field (one with `moduleEnabled`, `dependentPlugin` or
 * `proSetting`) is clicked; it is passed as the `Popup` prop of `<InputRenderer>` (pages/Settings/Settings.tsx).
 *
 * The `moduleName` branch is the one settings fields use (the MCP API key and the shipping and tax fields): it says
 * which module to activate. The `plugin` branch says which plugin is required. The default branch is a plain upgrade
 * prompt for Pro.
 */
const Popup: React.FC< PopupProps > = ( props ) => {
	if ( props.plugin ) {
		return (
			<div className="popup-wrapper">
				<div className="popup-header">
					<i className={ `adminfont-${ props.plugin }` } />
				</div>
				<div className="popup-body">
					<div className="module-name">
						{ sprintf(
							/* translators: %s: Plugin name. */
							__( 'Plugin required: %s', 'vulocart' ),
							props.plugin
						) }
					</div>
					<div className="module-desc">
						{ sprintf(
							/* translators: %s: Plugin name. */
							__(
								'This feature requires the "%s" plugin to be active.',
								'vulocart'
							),
							props.plugin
						) }
					</div>
					<ButtonInput
						position="center"
						buttons={ [
							{
								icon: 'eye',
								text: __( 'Manage plugins', 'vulocart' ),
								onClick: () => {
									window.open(
										`${ vulocartLocalizer.adminUrl.replace( /admin\.php.*/, '' ) }plugins.php`,
										'_blank'
									);
								},
							},
						] }
					/>
				</div>
			</div>
		);
	}

	if ( props.moduleName ) {
		const iconName = ICON_OVERRIDES[ props.moduleName ] ?? CATALOG_BY_ID.get( props.moduleName )?.icon ?? props.moduleName;

		return (
			<div className="popup-wrapper">
				<div className="popup-header">
					<i className={ `adminfont-${ iconName }` } />
				</div>
				<div className="popup-body">
					<div className="module-name">
						{ sprintf(
							/* translators: %s: Module name. */
							__( 'Activate %s', 'vulocart' ),
							formatModuleName( props.moduleName )
						) }
					</div>
					<div className="module-desc">
						{ sprintf(
							/* translators: %s: Module name. */
							__(
								'This feature is currently unavailable. To activate it, please enable the %s module.',
								'vulocart'
							),
							formatModuleName( props.moduleName )
						) }
					</div>
					<ButtonInput
						position="center"
						buttons={ [
							{
								icon: 'eye',
								text: __( 'Enable Now', 'vulocart' ),
								onClick: () => {
									// Same admin page, just a different hash tab.
									window.open( `${ vulocartLocalizer.adminUrl }admin.php?page=vulocart#&tab=settings&subtab=modules&module=${ props.moduleName }`, '_self' );
								},
							},
						] }
					/>
				</div>
			</div>
		);
	}

	const firstSentence = ( text: string ) => `${ text.split( '. ' )[ 0 ].replace( /\.$/, '' ) }.`;

	// The upgrade prompt: what was asked for first, then everything else Pro adds, with the buy button always in view.
	return (
		<div className="vc-pro-popup">
			<div className="vc-pro-popup-head">
				<span className="vc-pro-popup-pill">
					<i className="adminfont-pro-tag" aria-hidden="true" />
					{ __( 'VuloCart Pro', 'vulocart' ) }
				</span>
				<h2>{ __( 'Unlock the full VuloCart toolkit', 'vulocart' ) }</h2>
				<p>{ __( 'Subscriptions, coupons, inventory, workflows, AI tools and more, in the admin you already use.', 'vulocart' ) }</p>
				{ props.feature && (
					<div className="vc-pro-popup-feature">
						<span className="vc-pro-popup-icon">
							<i className={ `adminfont-${ props.feature.icon ?? 'pro-tag' }` } aria-hidden="true" />
						</span>
						<span>
							<strong>
								{ sprintf(
									/* translators: %s: feature name, e.g. "Coupons". */
									__( '%s is included', 'vulocart' ),
									props.feature.title
								) }
							</strong>
							{ props.feature.description }
						</span>
						<i className="adminfont-check vc-pro-popup-check" aria-hidden="true" />
					</div>
				) }
			</div>
			<div className="vc-pro-popup-body">
				<div className="vc-pro-popup-label">{ __( 'Everything in Pro', 'vulocart' ) }</div>
				<ul>
					{ PRO_MODULES.map( ( module ) => (
						<li key={ module.id }>
							<span className="vc-pro-popup-icon">
								<i className={ `adminfont-${ module.icon ?? module.id }` } aria-hidden="true" />
							</span>
							<span>
								<strong>{ module.name }</strong>
								<span>{ firstSentence( module.desc ) }</span>
							</span>
						</li>
					) ) }
				</ul>
			</div>
			<div className="vc-pro-popup-foot">
				<span>{ __( 'Your free features keep working as they are.', 'vulocart' ) }</span>
				<a className="vc-pro-popup-buy" href={ vulocartLocalizer.shop_url } target="_blank" rel="noreferrer">
					{ __( 'Upgrade to Pro', 'vulocart' ) }
					<i className="adminfont-arrow-right" aria-hidden="true" />
				</a>
			</div>
		</div>
	);
};

export default Popup;
