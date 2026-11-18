import { createPortal, useLayoutEffect, useRef, useState } from '@wordpress/element';
import type { ComponentProps } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { TableCard as ZyraTableCard, type QueryProps, type TableLabels } from '@zyra/table';
import { CalendarInput, SelectInput } from '@zyra/inputs';
import { IconComponent } from '@zyra/components';
import { RowActions, type RowAction } from './RowActions';
import './table-card.scss';

type ZyraProps = ComponentProps< typeof ZyraTableCard >;
type Filter = NonNullable< ZyraProps[ 'filters' ] >[ number ];
type FilterValues = NonNullable< QueryProps[ 'filter' ] >;

/** Wording for every list: short, sentence case, translatable (zyra's defaults are "2 Rows selected", "CSV"). */
const LABELS: TableLabels = {
	rowsSelected: ( count ) => sprintf( /* translators: %d: number of selected rows. */ _n( '%d selected', '%d selected', count, 'vulocart' ), count ),
	selectAll: __( 'Select all', 'vulocart' ),
	deselectAll: __( 'Clear selection', 'vulocart' ),
	bulkActions: __( 'Bulk actions', 'vulocart' ),
	csv: __( 'Export CSV', 'vulocart' ),
	filter: __( 'Filter', 'vulocart' ),
	reset: __( 'Clear filters', 'vulocart' ),
};

/** What a date filter shows before one is picked: the last month (zyra's own default). */
const lastMonth = () => {
	const startDate = new Date();
	startDate.setMonth( startDate.getMonth() - 1 );

	return { startDate, endDate: new Date() };
};

const isSet = ( value: unknown ) => ( Array.isArray( value ) ? value.length > 0 : !! value );

/** The filter row: one control per filter, then "Clear filters" once any is set. */
function FilterRow( {
	filters,
	values,
	onChange,
	onClear,
	format,
	label,
	clearLabel,
}: {
	filters: Filter[];
	values: FilterValues;
	// eslint-disable-next-line no-unused-vars -- parameter names in a type signature, not variables.
	onChange: ( key: string, value: FilterValues[ string ] ) => void;
	onClear: () => void;
	format?: string;
	label: string;
	clearLabel: string;
} ) {
	const active = Object.values( values ).filter( isSet ).length;

	return (
		<div className="table-filter-wrapper">
			<div className="table-filter">
				<span className="vc-filter-label">
					<IconComponent name="filter" />
					{ label }
					{ active > 0 && <span className="vc-filter-count">{ active }</span> }
				</span>
				{ filters.map( ( filter ) =>
					'date' === filter.type ? (
						<div className="group-field" key={ filter.key }>
							<CalendarInput
								value={ values[ filter.key ] || lastMonth() }
								onChange={ ( range: FilterValues[ string ] ) => range && onChange( filter.key, range ) }
								format={ format }
							/>
						</div>
					) : (
						<div className="group-field" key={ filter.key }>
							<SelectInput
								type={ filter.multiple ? 'multi-select' : 'single-select' }
								options={ ( filter.options || [] ).map( ( option ) => ( { label: option.label, value: String( option.value ) } ) ) }
								value={ values[ filter.key ] }
								size={ `${ filter.size }rem` }
								placeholder={ filter.label }
								onChange={ ( selected: FilterValues[ string ] ) => onChange( filter.key, selected ) }
							/>
						</div>
					)
				) }
				{ active > 0 && (
					<button type="button" className="vc-filter-clear" onClick={ onClear }>
						{ clearLabel }
					</button>
				) }
			</div>
		</div>
	);
}

/**
 * zyra's TableCard with filters that stay put while rows are selected. Use it everywhere a list would use
 * `TableCard` from '@zyra/table'; it takes exactly the same props.
 *
 * zyra builds its filter row only while fewer than two rows are ticked, and swaps it for the bulk bar from the
 * first tick, so filtering and selecting couldn't happen together and the table jumped as the row came and went.
 * Here zyra gets no `filters`; this component keeps their values and draws the row itself, in zyra's filter slot
 * (an element it adds to zyra's `.admin-table-wrapper`, placed by CSS order between the tabs and the table). Every
 * `onQueryUpdate` the list receives still carries `query.filter`, so list pages need no other change.
 *
 * A changed filter clears the selection and refetches from page 1. zyra's page number is internal, so when the list is past page 1 this
 * presses zyra's own "1" pager button, which makes zyra report the query again with the new filters merged in.
 */
/**
 * Every `type: 'action'` column is drawn by RowActions (up to four icon actions inline, more than four: two plus a
 * "more" menu) instead of zyra's own cell, which always keeps only two inline. zyra calls a column's `render` before its
 * action branch, and the column keeps `type: 'action'`, so the cell keeps its `action` class and styles.
 */
const withRowActions = ( headers: ZyraProps[ 'headers' ] ): ZyraProps[ 'headers' ] =>
	Object.fromEntries(
		Object.entries( headers ?? {} ).map( ( [ key, header ] ) => {
			const column = header as { type?: string; actions?: RowAction[]; render?: unknown };

			return [
				key,
				'action' === column.type && Array.isArray( column.actions ) && ! column.render
					? { ...( header as object ), render: ( row: Record< string, unknown > ) => <RowActions row={ row } actions={ column.actions as RowAction[] } /> }
					: header,
			];
		} )
	) as ZyraProps[ 'headers' ];

export function TableCard( { filters = [], onQueryUpdate, labels, rows = [], format, headers, ...props }: ZyraProps ) {
	const host = useRef< HTMLDivElement >( null );
	const [ slot, setSlot ] = useState< HTMLElement | null >( null );
	const [ values, setValues ] = useState< FilterValues >( {} );
	const valuesRef = useRef< FilterValues >( {} );
	const lastQuery = useRef< QueryProps >( {} );
	const merged = { ...LABELS, ...labels };
	const hasFilters = filters.length > 0;

	useLayoutEffect( () => {
		const wrapper = host.current?.querySelector( ':scope > .admin-table-wrapper' );

		if ( ! hasFilters || ! wrapper ) {
			return;
		}

		const element = document.createElement( 'div' );
		element.className = 'filter-wrapper vc-table-filters';
		wrapper.appendChild( element );
		setSlot( element );

		return () => {
			element.remove();
			setSlot( null );
		};
	}, [ hasFilters ] );

	const report = ( query: QueryProps ) => onQueryUpdate?.( { ...query, filter: { ...( query.filter || {} ), ...valuesRef.current } } );

	const applyFilters = ( next: FilterValues ) => {
		valuesRef.current = next;
		setValues( next );

		// A new filter changes which rows are on screen; a bulk action must never reach rows the merchant can no
		// longer see, so the selection is cleared (zyra's own clear button: its selection is internal).
		host.current?.querySelector< HTMLElement >( '.table-filter.bulk .action-item.count i' )?.click();

		if ( Number( lastQuery.current.paged || 1 ) > 1 ) {
			const firstPage = Array.from( host.current?.querySelectorAll< HTMLElement >( '.admin-pagination .pagination button' ) ?? [] ).find(
				( button ) => '1' === button.textContent?.trim()
			);

			if ( firstPage ) {
				firstPage.click();
				return;
			}
		}

		report( { ...lastQuery.current, paged: 1 } );
	};

	// zyra hides its filter row on an empty table with no filter set; the same here, so a filter that matches
	// nothing can still be cleared.
	const showRow = rows.length > 0 || Object.values( values ).some( isSet );

	return (
		<div ref={ host } className="vc-table-card">
			<ZyraTableCard
				{ ...props }
				headers={ withRowActions( headers ) }
				rows={ rows }
				format={ format }
				labels={ merged }
				filters={ [] }
				onQueryUpdate={ ( query: QueryProps ) => {
					lastQuery.current = query;
					report( query );
				} }
			/>
			{ slot &&
				showRow &&
				createPortal(
					<FilterRow
						filters={ filters }
						values={ values }
						onChange={ ( key, value ) => applyFilters( { ...valuesRef.current, [ key ]: value } ) }
						onClear={ () => applyFilters( {} ) }
						format={ format }
						label={ merged.filter as string }
						clearLabel={ merged.reset as string }
					/>,
					slot
				) }
		</div>
	);
}

export default TableCard;
