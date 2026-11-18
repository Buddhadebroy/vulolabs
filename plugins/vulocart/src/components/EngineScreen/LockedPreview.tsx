import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import { EntityCellComponent } from '@zyra/components';
import TableCard from '../TableCard/TableCard';
import type { PagePreview, PreviewCell } from './previews';

const noop = () => undefined;

const renderCell = ( cell: PreviewCell | undefined ): ReactNode => {
	if ( undefined === cell || 'string' === typeof cell ) {
		return cell ?? '';
	}

	const badges = ( cell.badges ?? [] ).map( ( [ text, tone ] ) => (
		<span key={ text } className={ `admin-badge badge-${ tone }` }>
			{ text }
		</span>
	) );

	if ( ! cell.title ) {
		return <>{ badges }</>;
	}

	return <EntityCellComponent title={ cell.title } badges={ badges.length ? <>{ badges }</> : undefined } details={ ( cell.details ?? [] ).map( ( [ icon, text ] ) => ( { icon, text } ) ) } />;
};

/**
 * A page drawn with sample data: the same zyra table, status tabs, search and row actions the real page uses, so what
 * a store owner sees here is what they get. Shown dimmed and inert behind ModuleRequired's card.
 */
export function LockedPreview( { preview }: { preview: PagePreview } ) {
	const rows = preview.rows.map( ( row, index ) => ( { id: index + 1, ...row } ) );
	const actions = [
		...( preview.verbs ?? [] ).map( ( label ) => ( { label, icon: 'check', type: 'button' as const, onClick: noop } ) ),
		...( preview.icons ?? [] ).map( ( [ icon, label ] ) => ( { label, icon, onClick: noop } ) ),
	];

	const headers = {
		...Object.fromEntries(
			Object.entries( preview.columns ).map( ( [ key, label ], index ) => [
				key,
				{
					label,
					isNumeric: preview.numeric?.includes( key ),
					...( 0 === index ? { required: true } : {} ),
					render: ( row?: Record< string, unknown > ) => renderCell( row?.[ key ] as PreviewCell | undefined ),
				},
			] )
		),
		...( actions.length ? { actions: { label: __( 'Actions', 'vulocart' ), type: 'action' as const, actions } } : {} ),
	};

	return (
		// `inert` keeps the sample out of tab order and clicks; spread because these React typings predate the attribute.
		<div className="vc-locked-preview" aria-hidden="true" { ...( { inert: true } as Record< string, unknown > ) }>
			{ preview.stats && (
				<div className="vc-locked-stats">
					{ preview.stats.map( ( stat ) => (
						<div className="vc-locked-stat" key={ stat.label }>
							<span className="vc-locked-stat-label">
								<i className={ `adminfont-${ stat.icon }` } />
								{ stat.label }
							</span>
							<strong>{ stat.value }</strong>
							<span className="vc-locked-stat-hint">{ stat.hint }</span>
						</div>
					) ) }
				</div>
			) }
			<TableCard
				showMenu={ false }
				headers={ headers }
				rows={ rows }
				ids={ rows.map( ( row ) => row.id ) }
				totalRows={ rows.length }
				isLoading={ false }
				{ ...( preview.search ? { search: { placeholder: preview.search } } : {} ) }
				{ ...( preview.tabs
					? {
							categoryCounts: preview.tabs.map( ( [ label, count ], index ) => ( { value: 0 === index ? 'all' : `tab-${ index }`, label, count } ) ),
							activeCategory: 'all',
					  }
					: {} ) }
				bulkActions={ [] }
				onQueryUpdate={ noop }
			/>
		</div>
	);
}

export default LockedPreview;
