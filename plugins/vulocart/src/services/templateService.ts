import { applyFilters } from '@wordpress/hooks';

/**
 * Settings tab discovery: scans the `../settings` folder with `require.context` and builds the tree of settings
 * folders and tabs. `vulocart_settings_context` lets vulocart-pro add settings tabs of its own.
 */
const contexts: Record< string, any > = {
	settings: require.context( '../settings', true, /\.ts$/ ),
};

type SettingNode = {
	name: string;
	type: 'folder' | 'file';
	content: SettingNode[] | any;
	folderPriority?: number;
	/** Same field name each file's own `content.headerIcon` already uses - read from that folder's own `FolderPriority.ts` (parallel to `priority`) so the top-level tab bar's folder tabs (General/Integrations/Commerce) get a real `menuIcon` icon too, not just standalone files like Advanced.ts. */
	headerIcon?: string;
};

/**
 * Reads every settings file from a webpack context and arranges them into a sorted tree of folders and tabs.
 */
const importAll = ( inpContext: any ): SettingNode[] => {
	const folderStructure: SettingNode[] = [];
	const folderPriorityMap: Record< string, number > = {};
	const folderIconMap: Record< string, string > = {};

	inpContext.keys().forEach( ( key: string ) => {
		if ( key.endsWith( 'FolderPriority.ts' ) ) {
			const folderPath = key
				.replace( './', '' )
				.replace( '/FolderPriority.ts', '' );
			const priorityData = inpContext( key )?.default;
			if ( priorityData && typeof priorityData.priority === 'number' ) {
				folderPriorityMap[ folderPath ] = priorityData.priority;
			}
			if ( priorityData && typeof priorityData.headerIcon === 'string' ) {
				folderIconMap[ folderPath ] = priorityData.headerIcon;
			}
		}
	} );

	const formatFolderName = ( name: string ): string => {
		return name
			.replace( /[_-]/g, ' ' )
			.replace( /([a-z])([A-Z])/g, '$1 $2' )
			.replace( /([A-Z]+)([A-Z][a-z])/g, '$1 $2' )
			.replace( /\s+/g, ' ' )
			.trim();
	};

	inpContext.keys().forEach( ( key: string ) => {
		const path = key.substring( 2 );
		const parts = path.split( '/' );
		const fileName = parts.pop();
		let currentFolder = folderStructure;
		let fullPath = '';

		parts.forEach( ( folder ) => {
			fullPath = fullPath ? `${ fullPath }/${ folder }` : folder;

			const formattedFolderName = formatFolderName( folder );

			let folderObject = currentFolder.find(
				( item ) =>
					item.name === formattedFolderName && item.type === 'folder'
			) as SettingNode | undefined;

			if ( ! folderObject ) {
				folderObject = {
					name: formattedFolderName,
					type: 'folder',
					content: [],
					folderPriority: folderPriorityMap[ fullPath ],
					headerIcon: folderIconMap[ fullPath ],
				};
				currentFolder.push( folderObject );
			}

			currentFolder = folderObject.content;
		} );

		if ( fileName !== 'FolderPriority.ts' ) {
			currentFolder.push( {
				name: fileName!.replace( '.ts', '' ),
				type: 'file',
				content: inpContext( key ).default,
			} );
		}
	} );

	const sortStructure = ( nodes: SettingNode[] ): SettingNode[] => {
		return nodes
			.sort( ( a, b ) => {
				const getPriority = ( node: SettingNode ): number => {
					if ( node.type === 'file' ) {
						return node.content?.priority ?? Infinity;
					}
					return node.folderPriority ?? Infinity;
				};

				return getPriority( a ) - getPriority( b );
			} )
			.map( ( node ) => {
				if ( node.type === 'folder' ) {
					return { ...node, content: sortStructure( node.content ) };
				}
				return node;
			} );
	};

	return sortStructure( folderStructure );
};

/**
 * Returns the settings tree for the admin Settings screen; Pro can extend the context with the
 * `vulocart_settings_context` filter.
 */
const getTemplateData = ( type: 'settings' ): SettingNode[] => {
	let ctx = contexts[ type ];

	if ( ! ctx ) {
		// eslint-disable-next-line no-console
		console.warn( `No context found for type: ${ type }` );
		return [];
	}

	ctx = applyFilters( 'vulocart_settings_context', ctx, type ) as typeof ctx;

	return importAll( ctx );
};

export { getTemplateData };
export default getTemplateData;
