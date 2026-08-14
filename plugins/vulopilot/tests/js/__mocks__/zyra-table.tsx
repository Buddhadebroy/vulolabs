/**
 * Test double for '@zyra/table' — see zyra-core.js's own docblock for why.
 * Minimal markup, just enough structure for RTL's accessible queries to
 * find what these tests actually assert on (row count, empty message, and
 * — since useFindingsTable.test.tsx exercises the real hook + a real
 * `<TableCard />` directly rather than mocking the whole findings table
 * wholesale like every page test does — each row's own action buttons) —
 * pages that render a raw TableCard directly (CrawlerTrafficTab.tsx,
 * WooCommerceIssuesTable.tsx, Health.tsx, all via useFindingsTable.tsx),
 * rather than through a table component of their own (which every *page*
 * test still mocks wholesale), need this stub so importing them doesn't
 * pull in the real, ESM-bundled @multivendorx/zyra package.
 */
import type { ReactNode } from 'react';

export interface TableRow {
	id?: number | string;
	[ key: string ]: unknown;
}

interface ActionConfig {
	/* eslint-disable-next-line no-unused-vars -- named param on a type-only call signature; base no-unused-vars doesn't recognize TS call-signature parameters, same as zyra-inputs.tsx's TextInput onChange. */
	label: string | ( ( row?: Record< string, unknown > ) => string );
	/* eslint-disable-next-line no-unused-vars -- same reasoning as above. */
	onClick: ( row?: Record< string, unknown > ) => void;
}

interface HeaderConfig {
	type?: string;
	statusClass?: string | ( ( row: TableRow ) => string );
	actions?: ActionConfig[];
	/* eslint-disable-next-line no-unused-vars -- same reasoning as above. */
	render?: ( row: TableRow ) => ReactNode;
}

/**
 * `render` (used by IssuesList.tsx's Issues table for every
 * custom column) and `type: 'status'` (its own "Priority" column) both
 * need real support here, not just `type: 'action'` — this mock used to
 * only render action-button headers, which silently dropped every other
 * column's content in any test asserting on row text.
 */
export const TableCard = ( {
	headers,
	rows,
	emptyMessage,
}: {
	headers?: Record< string, HeaderConfig >;
	rows: TableRow[];
	ids?: ( number | string )[];
	totalRows?: number;
	categoryCounts?: unknown;
	isLoading?: boolean;
	onQueryUpdate?: () => void;
	search?: unknown;
	bulkActions?: unknown;
	onBulkActionApply?: () => void;
	emptyMessage?: ReactNode;
	filters?: unknown;
} ) => (
	<div data-testid="table-card">
		{ 0 === rows.length ? (
			<p>{ emptyMessage }</p>
		) : (
			<>
				{ `${ rows.length } rows` }
				{ rows.map( ( row, rowIndex ) => (
					<div key={ row.id ?? rowIndex }>
						{ Object.entries( headers || {} ).map(
							( [ key, header ] ) => {
								if ( header.render ) {
									return (
										<div key={ key }>
											{ header.render( row ) }
										</div>
									);
								}

								if ( 'action' === header.type ) {
									return ( header.actions || [] ).map(
										( action, actionIndex ) => (
											<button
												key={ `${ key }-${ actionIndex }` }
												onClick={ () =>
													action.onClick( row )
												}
											>
												{ 'function' ===
												typeof action.label
													? action.label( row )
													: action.label }
											</button>
										)
									);
								}

								if ( 'status' === header.type ) {
									const statusClass =
										'function' === typeof header.statusClass
											? header.statusClass( row )
											: header.statusClass;

									return (
										<span
											key={ key }
											className={ `admin-badge badge-${ String( statusClass ).toLowerCase() }` }
										>
											{ String( row[ key ] ?? '' ) }
										</span>
									);
								}

								return (
									<span key={ key }>
										{ String( row[ key ] ?? '' ) }
									</span>
								);
							}
						) }
					</div>
				) ) }
			</>
		) }
	</div>
);
