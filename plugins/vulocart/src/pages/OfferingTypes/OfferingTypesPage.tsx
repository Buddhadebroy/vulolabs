/* global vulocartLocalizer */
import { useEffect, useState } from '@wordpress/element';
import { __, _n, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ColumnComponent, ContainerComponent, InformationItemComponent, NavigatorHeaderComponent } from '@zyra/components';
import { TableCard, TableRow } from '@zyra/table';

interface OfferingTypeInfo extends TableRow {
	type: string;
	description: string;
	offering_count: number;
}

const humanize = ( type: string ): string =>
	type
		.split( '_' )
		.map( ( word ) => word.charAt( 0 ).toUpperCase() + word.slice( 1 ) )
		.join( ' ' );

/** The built-in offering types and how many offerings use each - a read-only list, laid out like VuloPilot's tables. */
export function OfferingTypesPage() {
	const [ types, setTypes ] = useState< OfferingTypeInfo[] >( [] );
	const [ isLoading, setIsLoading ] = useState( true );

	useEffect( () => {
		getApiResponse< OfferingTypeInfo[] >( getApiLink( vulocartLocalizer, 'offering-types' ), {
			headers: { 'X-WP-Nonce': vulocartLocalizer.nonce },
		} )
			.then( ( response ) => setTypes( response ?? [] ) )
			.finally( () => setIsLoading( false ) );
	}, [] );

	const headers = {
		type: {
			label: __( 'Type', 'vulocart' ),
			render: ( row: OfferingTypeInfo ) => (
				<InformationItemComponent
					title={ humanize( row.type ) }
					badges={ [
						{
							text: sprintf(
								/* translators: %d: number of offerings. */
								_n( '%d Offering', '%d Offerings', row.offering_count, 'vulocart' ),
								row.offering_count
							),
							className: 'blue',
						},
					] }
					descriptions={ row.description ? [ { icon: 'document', label: __( 'Description', 'vulocart' ), value: row.description } ] : [] }
				/>
			),
		},
	};

	return (
		<ContainerComponent general>
			<ColumnComponent>
				<NavigatorHeaderComponent
					headerIcon="variable"
					headerTitle={ __( 'Offering Types', 'vulocart' ) }
					headerDescription={ __(
						'The built-in offering types this plugin supports, and how many offerings currently use each one.',
						'vulocart'
					) }
				/>

				<CardComponent
					title={ __( 'Offering Types', 'vulocart' ) }
					titleIcon="variable"
					desc={ __( 'Types are built in and cannot be added or removed.', 'vulocart' ) }
				>
					<TableCard
						showMenu={ false }
						variant="transparent"
						hideHeader={ true }
						headerHide={ true }
						headers={ headers }
						rows={ types }
						ids={ types.map( ( row ) => row.type ) }
						totalRows={ types.length }
						isLoading={ isLoading }
						emptyMessage={ __( 'No offering types found.', 'vulocart' ) }
					/>
				</CardComponent>
			</ColumnComponent>
		</ContainerComponent>
	);
}

export default OfferingTypesPage;
