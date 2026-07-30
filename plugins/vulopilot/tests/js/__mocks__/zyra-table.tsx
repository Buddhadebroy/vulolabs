/**
 * Test double for '@zyra/table' — see zyra-core.js's own docblock for why.
 * Minimal markup, just enough structure for RTL's accessible queries to
 * find what these tests actually assert on (row count, empty message, and
 * — since FindingsTable.test.tsx tests the real component directly rather
 * than mocking it wholesale like every page test does — each row's own
 * action buttons) — pages that render a raw TableCard directly
 * (CrawlerTraffic.tsx), rather than only through FindingsTable.tsx (which
 * every *page* test still mocks wholesale), need this stub so importing
 * them doesn't pull in the real, ESM-bundled @multivendorx/zyra package.
 */
import type { ReactNode } from 'react';

export interface TableRow {
	id: number;
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
	actions?: ActionConfig[];
}

export const TableCard = ( {
	headers,
	rows,
	emptyMessage,
}: {
	headers?: Record< string, HeaderConfig >;
	rows: TableRow[];
	ids?: number[];
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
				{ rows.map( ( row ) => (
					<div key={ row.id }>
						{ Object.values( headers || {} ).flatMap(
							( header, headerIndex ) =>
								'action' === header.type
									? ( header.actions || [] ).map(
											( action, actionIndex ) => (
												<button
													key={ `${ headerIndex }-${ actionIndex }` }
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
									  )
									: []
						) }
					</div>
				) ) }
			</>
		) }
	</div>
);
