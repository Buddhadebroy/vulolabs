/* global vulocartLocalizer */
import { useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import { HeaderComponent } from '@zyra/components';
import Brand from '../../assets/images/vulocart-logo.svg';
import { buildSearchIndex, type SearchItem } from '../../searchIndex';

/**
 * The header every VuloCart screen shows - brand, version and the search box at its top right, same
 * as VuloPilot's. Results cover tabs and menu pages, settings (sections and fields) and modules. A tab
 * result switches tab in place when you are already in the VuloCart app; anything else navigates.
 */
export function SearchHeader() {
	const [ results, setResults ] = useState< SearchItem[] >( [] );

	const handleQueryUpdate = ( { searchValue, searchAction }: { searchValue: string; searchAction?: string } ) => {
		const query = searchValue.trim().toLowerCase();

		if ( ! query ) {
			setResults( [] );
			return;
		}

		setResults(
			buildSearchIndex().filter( ( item ) => {
				if ( searchAction && 'all' !== searchAction && item.category !== searchAction ) {
					return false;
				}

				return item.name.toLowerCase().includes( query ) || Boolean( item.desc?.toLowerCase().includes( query ) );
			} )
		);
	};

	const handleResultClick = ( item: SearchItem ) => {
		const isAppTab = item.link.startsWith( '&tab=' );
		const inApp = 'vulocart' === new URLSearchParams( window.location.search ).get( 'page' );

		if ( isAppTab && inApp ) {
			window.location.hash = item.link;
			return;
		}

		window.location.href = `${ vulocartLocalizer.adminUrl }${ isAppTab ? `admin.php?page=vulocart#${ item.link }` : item.link }`;
	};

	return (
		<HeaderComponent
			brandImg={ Brand }
			results={ results }
			search={ {
				placeholder: __( 'Search…', 'vulocart' ),
				options: [
					{ value: 'all', label: __( 'Every Where', 'vulocart' ) },
					{ value: 'pages', label: __( 'Pages', 'vulocart' ) },
					{ value: 'settings', label: __( 'Settings', 'vulocart' ) },
					{ value: 'modules', label: __( 'Modules', 'vulocart' ) },
				],
			} }
			onQueryUpdate={ handleQueryUpdate }
			onResultClick={ handleResultClick }
			free={ vulocartLocalizer.version }
			pro={ vulocartLocalizer.pro_version ?? undefined }
			searchSize={ 7 }
		/>
	);
}

export default SearchHeader;
