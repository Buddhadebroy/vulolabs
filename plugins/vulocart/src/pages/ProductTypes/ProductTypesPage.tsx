/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import axios from 'axios';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ColumnComponent, ContainerComponent, NavigatorHeaderComponent, NoticeManager } from '@zyra/components';
import '../Products/products-page.scss';
import './product-types-page.scss';

interface ProLink {
	module: string;
	label: string;
	page: string;
	view: string;
}

interface ProductTypeInfo {
	type: string;
	description: string;
	product_count: number;
	enabled: boolean;
	/** Set when the type only works with a vulocart-pro module. */
	pro: ProLink | null;
	/** Pro pages that add to this type (Pro is not needed to sell it). */
	pro_extras: Omit< ProLink, 'module' >[];
	/** The Settings screen that configures this type, when there is one. */
	settings: { label: string; subtab: string } | null;
}

const TYPE_ICONS: Record< string, string > = {
	physical: 'product',
	subscription: 'subscription',
	gift_card: 'gift-card',
};

const humanize = ( type: string ): string =>
	type
		.split( '_' )
		.map( ( word ) => word.charAt( 0 ).toUpperCase() + word.slice( 1 ) )
		.join( ' ' );

const nonceHeaders = { headers: { 'X-WP-Nonce': vulocartLocalizer.nonce } };

/**
 * The product types as a grid of cards. Each can be switched off so the editor stops product it (products that
 * already use it are untouched). A type that needs a vulocart-pro module says so, links to where that module is
 * managed, and stays locked until Pro is installed and licensed.
 */
export function ProductTypesPage() {
	const [ types, setTypes ] = useState< ProductTypeInfo[] >( [] );
	const [ isLoading, setIsLoading ] = useState( true );
	const [ busyType, setBusyType ] = useState< string | null >( null );

	useEffect( () => {
		getApiResponse< ProductTypeInfo[] >( getApiLink( vulocartLocalizer, 'product-types' ), nonceHeaders )
			.then( ( response ) => setTypes( response ?? [] ) )
			.finally( () => setIsLoading( false ) );
	}, [] );

	const adminUrl = vulocartLocalizer.adminUrl as string;
	const proActive = !! vulocartLocalizer.khali_dabba;
	const enabledCount = types.filter( ( row ) => row.enabled ).length;

	const toggle = ( row: ProductTypeInfo ) => {
		setBusyType( row.type );

		axios
			.post< ProductTypeInfo[] >( getApiLink( vulocartLocalizer, `product-types/${ row.type }` ), { enabled: ! row.enabled }, nonceHeaders )
			.then( ( response ) => setTypes( response.data ) )
			.catch( ( error ) =>
				NoticeManager.add( {
					uniqueKey: 'vulocart-product-type',
					type: 'error',
					position: 'float',
					message: error?.response?.data?.message || __( 'Could not update this type.', 'vulocart' ),
				} )
			)
			.finally( () => setBusyType( null ) );
	};

	return (
		<ContainerComponent general>
			<ColumnComponent>
				<NavigatorHeaderComponent
					headerIcon="variable"
					headerTitle={ __( 'Product Types', 'vulocart' ) }
					headerDescription={ __( 'Choose which kinds of product you sell. A type you switch off is no longer offered when creating a new product.', 'vulocart' ) }
				/>

				<CardComponent isLoading={ isLoading }>
					<div className="vulocart-type-grid">
						{ types.map( ( row ) => {
							const locked = !! row.pro && ! proActive;
							const manageUrl = row.pro ? `${ adminUrl }admin.php?page=${ row.pro.page }&view=${ row.pro.view }` : '';

							return (
								<article key={ row.type } className={ `vulocart-type-card${ row.enabled && ! locked ? '' : ' is-off' }` }>
									<header>
										<span className="vulocart-type-icon" aria-hidden="true">
											<i className={ `adminfont-${ TYPE_ICONS[ row.type ] ?? 'catalog' }` } />
										</span>
										<div className="vulocart-type-title">
											<h3>{ humanize( row.type ) }</h3>
											<span className="vulocart-type-count">
												{ sprintf(
													/* translators: %d: number of products. */
													_n( '%d product', '%d products', row.product_count, 'vulocart' ),
													row.product_count
												) }
											</span>
										</div>
										<span className="vulocart-type-pro">
											<svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" focusable="false">
												<path fill="currentColor" d="M1.5 5.5 4.6 8 8 3l3.4 5 3.1-2.5-1.2 7H2.7l-1.2-7Z" />
											</svg>
											{ __( 'Pro', 'vulocart' ) }
										</span>
										{ locked ? (
											<i className="adminfont-lock vulocart-type-lock" aria-label={ __( 'Needs VuloCart Pro', 'vulocart' ) } />
										) : (
											<button
												type="button"
												role="switch"
												aria-checked={ row.enabled }
												aria-label={ sprintf(
													/* translators: %s: product type. */
													__( 'Enable %s', 'vulocart' ),
													humanize( row.type )
												) }
												className={ `vulocart-switch${ row.enabled ? ' is-on' : '' }` }
												disabled={ busyType === row.type || ( row.enabled && 1 === enabledCount ) }
												title={ row.enabled && 1 === enabledCount ? __( 'At least one type must stay on.', 'vulocart' ) : undefined }
												onClick={ () => toggle( row ) }
											>
												<span aria-hidden="true" />
											</button>
										) }
									</header>

									<p>{ row.description }</p>

									<div className="vulocart-type-links vulocart-type-pro-links">
										<span className="vulocart-type-links-label">{ __( 'Pro tools', 'vulocart' ) }</span>
										{ locked ? (
											<a href={ `${ adminUrl }admin.php?page=vulocart#&tab=settings&subtab=licensing` }>{ __( 'Activate license', 'vulocart' ) }</a>
										) : (
											<>
												{ row.pro && <a href={ manageUrl }>{ row.pro.label }</a> }
												{ row.pro_extras.map( ( extra ) => (
													<a key={ `${ extra.page }-${ extra.view }` } href={ `${ adminUrl }admin.php?page=${ extra.page }&view=${ extra.view }` }>
														{ extra.label }
													</a>
												) ) }
											</>
										) }
									</div>

									{ row.settings && (
										<footer>
											<div className="vulocart-type-links">
												<i className="adminfont-setting" aria-hidden="true" />
												<a href={ `${ adminUrl }admin.php?page=vulocart#&tab=settings&subtab=${ row.settings.subtab }` }>{ row.settings.label }</a>
											</div>
										</footer>
									) }
								</article>
							);
						} ) }
					</div>
				</CardComponent>
			</ColumnComponent>
		</ContainerComponent>
	);
}

export default ProductTypesPage;
