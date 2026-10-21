/**
 * VuloCart storefront blocks - editor side.
 *
 * Plain JavaScript (no JSX, no build step), like view.js. Containers (collection, template, no results) hold real
 * inner blocks so the card can be redesigned in the editor; the leaf blocks draw a faithful preview, because the
 * real products only exist in the server-side render, where each block gets its product as context.
 */
( function ( wp ) {
	'use strict';

	var el = wp.element.createElement;
	var Fragment = wp.element.Fragment;
	var __ = wp.i18n.__;
	var registerBlockType = wp.blocks.registerBlockType;
	var useBlockProps = wp.blockEditor.useBlockProps;
	var InnerBlocks = wp.blockEditor.InnerBlocks;
	var InspectorControls = wp.blockEditor.InspectorControls;
	var PanelBody = wp.components.PanelBody;
	var RangeControl = wp.components.RangeControl;
	var SelectControl = wp.components.SelectControl;
	var ToggleControl = wp.components.ToggleControl;

	var pictureIcon = el(
		'svg',
		{ viewBox: '0 0 24 24', width: 40, height: 40, fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' },
		el( 'rect', { x: 3, y: 3, width: 18, height: 18, rx: 3 } ),
		el( 'circle', { cx: 9, cy: 9, r: 1.6 } ),
		el( 'path', { d: 'm21 15-4.5-4.5L8 19' } )
	);

	var noSave = function () {
		return null;
	};
	var saveInner = function () {
		return el( InnerBlocks.Content );
	};

	/** Skeleton cards beside the editable one, so the grid reads as a grid while designing. */
	function ghostCards( count ) {
		var cards = [];

		for ( var i = 0; i < count; i++ ) {
			cards.push(
				el(
					'li',
					{ key: 'ghost-' + i, className: 'vulocart-product is-ghost', 'aria-hidden': 'true' },
					el( 'div', { className: 'vulocart-product-image' }, el( 'span', { className: 'vulocart-product-image__placeholder' }, pictureIcon ) ),
					el( 'span', { className: 'vulocart-ghost-line' } ),
					el( 'span', { className: 'vulocart-ghost-line is-short' } )
				)
			);
		}

		return cards;
	}

	registerBlockType( 'vulocart/product-collection', {
		edit: function ( props ) {
			var a = props.attributes;
			var blockProps = useBlockProps( {
				// The canvas always previews the grid: a list is only the same cards laid out differently on the page.
				className: 'vulocart-collection is-layout-grid',
				style: { '--vc-columns': a.columns || 4 },
			} );

			return el(
				Fragment,
				null,
				el(
					InspectorControls,
					null,
					el(
						PanelBody,
						{ title: __( 'Products', 'vulocart' ), initialOpen: true },
						el( RangeControl, { label: __( 'Products per page', 'vulocart' ), min: 1, max: 48, value: a.perPage, onChange: function ( v ) { props.setAttributes( { perPage: v } ); } } ),
						el( SelectControl, {
							label: __( 'Default order', 'vulocart' ),
							value: a.orderBy,
							options: [
								{ label: __( 'Newest', 'vulocart' ), value: 'newest' },
								{ label: __( 'Price: low to high', 'vulocart' ), value: 'price_asc' },
								{ label: __( 'Price: high to low', 'vulocart' ), value: 'price_desc' },
								{ label: __( 'Name: A to Z', 'vulocart' ), value: 'title' },
							],
							onChange: function ( v ) { props.setAttributes( { orderBy: v } ); },
						} ),
						el( 'p', { className: 'components-base-control__help' }, __( 'Shoppers can change the order with the Product Filters block.', 'vulocart' ) )
					),
					el(
						PanelBody,
						{ title: __( 'Layout', 'vulocart' ), initialOpen: true },
						el( SelectControl, {
							label: __( 'Layout', 'vulocart' ),
							value: a.layout,
							options: [
								{ label: __( 'Use the site setting', 'vulocart' ), value: '' },
								{ label: __( 'Grid', 'vulocart' ), value: 'grid' },
								{ label: __( 'List', 'vulocart' ), value: 'list' },
							],
							help: __( 'The editor always previews the grid; the list layout shows on the page.', 'vulocart' ),
							onChange: function ( v ) { props.setAttributes( { layout: v } ); },
						} ),
						'list' !== a.layout &&
							el( SelectControl, {
								label: __( 'Columns', 'vulocart' ),
								value: String( a.columns ),
								options: [ { label: __( 'Use the site setting', 'vulocart' ), value: '0' } ].concat(
									[ 2, 3, 4, 5, 6 ].map( function ( n ) { return { label: String( n ), value: String( n ) }; } )
								),
								onChange: function ( v ) { props.setAttributes( { columns: Number( v ) } ); },
							} )
					)
				),
				el(
					'div',
					blockProps,
					el( InnerBlocks, {
						template: [
							[ 'vulocart/product-filters' ],
							[ 'vulocart/product-template' ],
							[ 'vulocart/product-pagination' ],
							[ 'vulocart/product-no-results', {}, [ [ 'core/paragraph', { align: 'center', content: __( 'No products match your filters. Try a different search or clear the filters.', 'vulocart' ) } ] ] ],
						],
					} )
				)
			);
		},
		save: saveInner,
	} );

	registerBlockType( 'vulocart/product-filters', {
		edit: function ( props ) {
			var a = props.attributes;
			var set = function ( key ) {
				return function ( v ) {
					var next = {};
					next[ key ] = v;
					props.setAttributes( next );
				};
			};
			var blockProps = useBlockProps( { className: 'vulocart-filters' } );

			return el(
				Fragment,
				null,
				el(
					InspectorControls,
					null,
					el(
						PanelBody,
						{ title: __( 'Filters', 'vulocart' ) },
						el( ToggleControl, { label: __( 'Search', 'vulocart' ), checked: a.showSearch, onChange: set( 'showSearch' ), __nextHasNoMarginBottom: true } ),
						el( ToggleControl, { label: __( 'Categories', 'vulocart' ), checked: a.showCategories, onChange: set( 'showCategories' ), __nextHasNoMarginBottom: true } ),
						el( ToggleControl, { label: __( 'Sort', 'vulocart' ), checked: a.showSort, onChange: set( 'showSort' ), __nextHasNoMarginBottom: true } )
					)
				),
				el(
					'div',
					blockProps,
					a.showSearch && el( 'label', { className: 'vulocart-filters__search' }, el( 'svg', { viewBox: '0 0 24 24', width: 18, height: 18, fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' }, el( 'circle', { cx: 11, cy: 11, r: 7 } ), el( 'path', { d: 'm20 20-3.5-3.5' } ) ), el( 'input', { type: 'search', disabled: true, placeholder: __( 'Search products…', 'vulocart' ) } ) ),
					a.showCategories && el( 'label', { className: 'vulocart-filters__field' }, el( 'select', { disabled: true }, el( 'option', null, __( 'All categories', 'vulocart' ) ) ) ),
					a.showSort && el( 'label', { className: 'vulocart-filters__field' }, el( 'select', { disabled: true }, el( 'option', null, __( 'Newest', 'vulocart' ) ) ) ),
					el( 'p', { className: 'vulocart-filters__count' }, __( 'Showing 1–12 of 48 products', 'vulocart' ) )
				)
			);
		},
		save: noSave,
	} );

	registerBlockType( 'vulocart/product-template', {
		edit: function () {
			var blockProps = useBlockProps( { className: 'vulocart-product-template' } );

			return el(
				'ul',
				blockProps,
				el(
					'li',
					{ className: 'vulocart-product' },
					el( InnerBlocks, {
						template: [
							[ 'vulocart/product-image' ],
							[ 'vulocart/product-title' ],
							[ 'vulocart/product-price' ],
							[ 'vulocart/product-add-to-cart' ],
						],
						templateLock: false,
					} )
				),
				ghostCards( 3 )
			);
		},
		save: saveInner,
	} );

	registerBlockType( 'vulocart/product-image', {
		edit: function ( props ) {
			var a = props.attributes;
			var blockProps = useBlockProps( { className: 'vulocart-product-image', style: { '--vc-ratio': a.aspectRatio } } );

			return el(
				Fragment,
				null,
				el(
					InspectorControls,
					null,
					el(
						PanelBody,
						{ title: __( 'Image', 'vulocart' ) },
						el( SelectControl, {
							label: __( 'Aspect ratio', 'vulocart' ),
							value: a.aspectRatio,
							options: [ '1 / 1', '4 / 5', '3 / 4', '4 / 3', '16 / 9' ].map( function ( r ) { return { label: r.replace( ' / ', ':' ), value: r }; } ),
							onChange: function ( v ) { props.setAttributes( { aspectRatio: v } ); },
						} ),
						el( SelectControl, {
							label: __( 'Crop', 'vulocart' ),
							value: a.scale,
							options: [ { label: __( 'Fill the frame', 'vulocart' ), value: 'cover' }, { label: __( 'Show the whole image', 'vulocart' ), value: 'contain' } ],
							onChange: function ( v ) { props.setAttributes( { scale: v } ); },
						} ),
						el( ToggleControl, { label: __( 'Show sale and sold-out badges', 'vulocart' ), checked: a.showBadge, onChange: function ( v ) { props.setAttributes( { showBadge: v } ); }, __nextHasNoMarginBottom: true } )
					)
				),
				el(
					'div',
					blockProps,
					el( 'a', { href: '#', onClick: function ( e ) { e.preventDefault(); } }, el( 'span', { className: 'vulocart-product-image__placeholder' }, pictureIcon ) ),
					a.showBadge && el( 'span', { className: 'vulocart-badge is-sale' }, '-20%' )
				)
			);
		},
		save: noSave,
	} );

	registerBlockType( 'vulocart/product-title', {
		edit: function ( props ) {
			var a = props.attributes;
			var blockProps = useBlockProps();

			return el(
				Fragment,
				null,
				el(
					InspectorControls,
					null,
					el(
						PanelBody,
						{ title: __( 'Title', 'vulocart' ) },
						el( SelectControl, {
							label: __( 'Heading level', 'vulocart' ),
							value: String( a.level ),
							options: [ 1, 2, 3, 4, 5, 6 ].map( function ( n ) { return { label: 'H' + n, value: String( n ) }; } ),
							onChange: function ( v ) { props.setAttributes( { level: Number( v ) } ); },
						} ),
						el( ToggleControl, { label: __( 'Link to the product', 'vulocart' ), checked: a.isLink, onChange: function ( v ) { props.setAttributes( { isLink: v } ); }, __nextHasNoMarginBottom: true } )
					)
				),
				el( 'h' + a.level, blockProps, a.isLink ? el( 'a', { href: '#', onClick: function ( e ) { e.preventDefault(); } }, __( 'Product name', 'vulocart' ) ) : __( 'Product name', 'vulocart' ) )
			);
		},
		save: noSave,
	} );

	registerBlockType( 'vulocart/product-price', {
		edit: function () {
			var blockProps = useBlockProps( { className: 'vulocart-price' } );

			return el( 'p', blockProps, el( 'del', { className: 'vulocart-price__regular' }, '$40.00' ), ' ', el( 'ins', { className: 'vulocart-price__current' }, '$32.00' ) );
		},
		save: noSave,
	} );

	registerBlockType( 'vulocart/product-summary', {
		edit: function () {
			var blockProps = useBlockProps( { className: 'vulocart-summary' } );

			return el( 'p', blockProps, __( 'A short description of the product appears here, trimmed to a few lines.', 'vulocart' ) );
		},
		save: noSave,
	} );

	registerBlockType( 'vulocart/product-add-to-cart', {
		edit: function ( props ) {
			var a = props.attributes;
			var blockProps = useBlockProps( { className: 'vulocart-add' + ( a.fullWidth ? ' is-full' : '' ) } );

			return el(
				Fragment,
				null,
				el(
					InspectorControls,
					null,
					el(
						PanelBody,
						{ title: __( 'Button', 'vulocart' ) },
						el( ToggleControl, { label: __( 'Full width', 'vulocart' ), checked: a.fullWidth, onChange: function ( v ) { props.setAttributes( { fullWidth: v } ); }, __nextHasNoMarginBottom: true } ),
						el( 'p', { className: 'components-base-control__help' }, __( 'The label follows the product type (Add to cart, Book now, Subscribe…). Products that need a choice open their page instead.', 'vulocart' ) )
					)
				),
				el( 'div', blockProps, el( 'span', { className: 'wp-element-button vulocart-add__button' }, __( 'Add to cart', 'vulocart' ) ) )
			);
		},
		save: noSave,
	} );

	registerBlockType( 'vulocart/product-pagination', {
		edit: function () {
			var blockProps = useBlockProps( { className: 'vulocart-pagination' } );

			return el(
				'nav',
				blockProps,
				el( 'span', { className: 'page-numbers' }, '←' ),
				el( 'span', { className: 'page-numbers current' }, '1' ),
				el( 'span', { className: 'page-numbers' }, '2' ),
				el( 'span', { className: 'page-numbers' }, '3' ),
				el( 'span', { className: 'page-numbers' }, '→' )
			);
		},
		save: noSave,
	} );

	registerBlockType( 'vulocart/product-no-results', {
		edit: function () {
			var blockProps = useBlockProps( { className: 'vulocart-no-results' } );

			return el(
				'div',
				blockProps,
				el( InnerBlocks, { template: [ [ 'core/paragraph', { align: 'center', content: __( 'No products match your filters.', 'vulocart' ) } ] ] } )
			);
		},
		save: saveInner,
	} );
	registerBlockType( 'vulocart/product-details', {
		edit: function () {
			var blockProps = useBlockProps( { className: 'vulocart-product-details' } );
			var column = function ( width, template, className ) {
				return [ 'core/column', { width: width, className: className }, template ];
			};

			return el(
				'div',
				blockProps,
				el( InnerBlocks, {
					template: [
						[ 'vulocart/product-breadcrumbs' ],
						[
							'core/columns',
							{ className: 'vulocart-details-columns' },
							[
								column( '56%', [ [ 'vulocart/product-gallery' ] ] ),
								column(
									'44%',
									[
										[ 'vulocart/product-title', { level: 1, isLink: false } ],
										[ 'vulocart/product-price' ],
										[ 'vulocart/product-summary', { words: 45 } ],
										[
											'core/group',
											{ className: 'vulocart-buybox' },
											[
												[ 'vulocart/product-stock' ],
												[ 'vulocart/product-purchase' ],
												[ 'vulocart/product-trust' ],
												[ 'vulocart/product-facts' ],
											],
										],
									],
									'vulocart-details-info'
								),
							],
						],
						[
							'core/columns',
							{ className: 'vulocart-details-more' },
							[
								column( '62%', [ [ 'vulocart/product-content' ], [ 'vulocart/product-faqs' ] ] ),
								column(
									'38%',
									[
										[ 'vulocart/product-specs', { source: 'details' } ],
										[ 'vulocart/product-specs', { source: 'specifications' } ],
										[ 'vulocart/product-specs', { source: 'policies' } ],
										[ 'vulocart/product-extras' ],
									]
								),
							],
						],
					],
				} )
			);
		},
		save: saveInner,
	} );

	registerBlockType( 'vulocart/product-breadcrumbs', {
		edit: function () {
			var blockProps = useBlockProps( { className: 'vulocart-breadcrumbs' } );

			return el(
				'nav',
				blockProps,
				el( 'ol', null, el( 'li', null, el( 'a', { href: '#', onClick: function ( e ) { e.preventDefault(); } }, __( 'Home', 'vulocart' ) ) ), el( 'li', null, el( 'a', { href: '#', onClick: function ( e ) { e.preventDefault(); } }, __( 'Shop', 'vulocart' ) ) ), el( 'li', { 'aria-current': 'page' }, __( 'Product name', 'vulocart' ) ) )
			);
		},
		save: noSave,
	} );

	registerBlockType( 'vulocart/product-gallery', {
		edit: function () {
			var blockProps = useBlockProps( { className: 'vulocart-gallery' } );

			return el(
				'div',
				blockProps,
				el( 'div', { className: 'vulocart-gallery__stage' }, el( 'span', { className: 'vulocart-product-image__placeholder' }, pictureIcon ) ),
				el(
					'ul',
					{ className: 'vulocart-gallery__thumbs' },
					[ 0, 1, 2, 3 ].map( function ( i ) {
						return el( 'li', { key: i }, el( 'span', { className: 'vulocart-gallery__thumb' + ( 0 === i ? ' is-active' : '' ) } ) );
					} )
				)
			);
		},
		save: noSave,
	} );

	registerBlockType( 'vulocart/product-purchase', {
		edit: function () {
			var blockProps = useBlockProps( { className: 'vulocart-purchase' } );

			return el(
				'div',
				blockProps,
				el(
					'div',
					{ className: 'vulocart-purchase__row' },
					el( 'div', { className: 'vulocart-qty' }, el( 'button', { type: 'button', tabIndex: -1 }, '−' ), el( 'input', { value: '1', readOnly: true } ), el( 'button', { type: 'button', tabIndex: -1 }, '+' ) ),
					el( 'div', { className: 'vulocart-add' }, el( 'span', { className: 'wp-element-button vulocart-add__button' }, __( 'Add to cart', 'vulocart' ) ) )
				)
			);
		},
		save: noSave,
	} );

	registerBlockType( 'vulocart/product-stock', {
		edit: function () {
			var blockProps = useBlockProps( { className: 'vulocart-stock-block' } );

			return el( 'div', blockProps, el( 'p', { className: 'vulocart-savings' }, __( 'You save 20% on the regular price', 'vulocart' ) ), el( 'p', { className: 'vulocart-stock is-in' }, __( 'In stock', 'vulocart' ) ) );
		},
		save: noSave,
	} );

	registerBlockType( 'vulocart/product-trust', {
		edit: function () {
			var blockProps = useBlockProps( { className: 'vulocart-trust' } );

			return el( 'ul', blockProps, el( 'li', null, el( 'span', null, __( 'Ships within 2 business days.', 'vulocart' ) ) ), el( 'li', null, el( 'span', null, __( 'Secure checkout', 'vulocart' ) ) ) );
		},
		save: noSave,
	} );

	registerBlockType( 'vulocart/product-facts', {
		edit: function () {
			var blockProps = useBlockProps( { className: 'vulocart-facts' } );

			return el( 'dl', blockProps, el( 'div', null, el( 'dt', null, __( 'SKU', 'vulocart' ) ), el( 'dd', null, 'SKU-1234' ) ), el( 'div', null, el( 'dt', null, __( 'Type', 'vulocart' ) ), el( 'dd', null, __( 'Physical', 'vulocart' ) ) ) );
		},
		save: noSave,
	} );

	registerBlockType( 'vulocart/product-content', {
		edit: function () {
			var blockProps = useBlockProps( { className: 'vulocart-description-part' } );

			return el( 'div', blockProps, el( 'section', { className: 'vulocart-section' }, el( 'h2', null, __( 'Description', 'vulocart' ) ), el( 'div', { className: 'vulocart-prose' }, el( 'p', null, __( 'The full product description appears here.', 'vulocart' ) ) ) ) );
		},
		save: noSave,
	} );

	registerBlockType( 'vulocart/product-specs', {
		edit: function ( props ) {
			var source = props.attributes.source || 'specifications';
			var titles = { details: __( 'Details', 'vulocart' ), specifications: __( 'Specifications', 'vulocart' ), policies: __( 'Shipping & returns', 'vulocart' ) };
			var blockProps = useBlockProps( { className: 'vulocart-description-part is-card' } );

			return el(
				'div',
				blockProps,
				el(
					wp.blockEditor.InspectorControls,
					null,
					el(
						wp.components.PanelBody,
						{ title: __( 'Specs', 'vulocart' ) },
						el( wp.components.SelectControl, {
							label: __( 'Show', 'vulocart' ),
							value: source,
							options: [
								{ value: 'details', label: titles.details },
								{ value: 'specifications', label: titles.specifications },
								{ value: 'policies', label: titles.policies },
							],
							onChange: function ( value ) {
								props.setAttributes( { source: value } );
							},
							__nextHasNoMarginBottom: true,
							__next40pxDefaultSize: true,
						} )
					)
				),
				el( 'section', { className: 'vulocart-section is-side' }, el( 'h2', null, titles[ source ] ), el( 'table', { className: 'vulocart-spec-table' }, el( 'tbody', null, el( 'tr', null, el( 'th', null, __( 'Material', 'vulocart' ) ), el( 'td', null, '—' ) ) ) ) )
			);
		},
		save: noSave,
	} );

	registerBlockType( 'vulocart/product-faqs', {
		edit: function () {
			var blockProps = useBlockProps( { className: 'vulocart-description-part' } );

			return el( 'div', blockProps, el( 'section', { className: 'vulocart-section' }, el( 'h2', null, __( 'Questions & answers', 'vulocart' ) ), el( 'div', { className: 'vulocart-faqs' }, el( 'details', null, el( 'summary', null, __( 'A common question', 'vulocart' ) ) ) ) ) );
		},
		save: noSave,
	} );

	registerBlockType( 'vulocart/product-extras', {
		edit: function () {
			var blockProps = useBlockProps( { className: 'vulocart-description-part is-cards' } );

			return el( 'div', blockProps, el( 'p', { className: 'vulocart-muted' }, __( 'Sections added by extensions, such as the Digital Product Passport, appear here.', 'vulocart' ) ) );
		},
		save: noSave,
	} );

	registerBlockType( 'vulocart/cart', {
		edit: function () {
			var blockProps = useBlockProps( { className: 'vulocart-cart is-ready' } );
			var row = function ( name, price ) {
				return el(
					'li',
					{ className: 'vulocart-cart-item', key: name },
					el( 'span', { className: 'vulocart-cart-item__image' }, pictureIcon ),
					el( 'div', { className: 'vulocart-cart-item__info' }, el( 'span', { className: 'vulocart-cart-item__title' }, name ), el( 'span', { className: 'vulocart-cart-item__unit' }, price + ' ' + __( 'each', 'vulocart' ) ) ),
					el( 'div', { className: 'vulocart-qty' }, el( 'button', { type: 'button', tabIndex: -1 }, '−' ), el( 'input', { value: '1', readOnly: true } ), el( 'button', { type: 'button', tabIndex: -1 }, '+' ) ),
					el( 'strong', { className: 'vulocart-cart-item__total' }, price )
				);
			};

			return el(
				'div',
				blockProps,
				el(
					'div',
					{ className: 'vulocart-cart__layout' },
					el( 'section', { className: 'vulocart-cart__items' }, el( 'p', { className: 'vulocart-cart__count' }, __( '2 items', 'vulocart' ) ), el( 'ul', { className: 'vulocart-cart__list' }, row( __( 'Product name', 'vulocart' ), '$32.00' ), row( __( 'Another product', 'vulocart' ), '$18.00' ) ) ),
					el(
						'aside',
						{ className: 'vulocart-cart-summary' },
						el( 'h2', null, __( 'Order summary', 'vulocart' ) ),
						el( 'dl', { className: 'vulocart-cart-summary__rows' }, el( 'div', null, el( 'dt', null, __( 'Subtotal', 'vulocart' ) ), el( 'dd', null, '$50.00' ) ), el( 'div', { className: 'is-total' }, el( 'dt', null, __( 'Total', 'vulocart' ) ), el( 'dd', null, '$50.00' ) ) ),
						el( 'span', { className: 'wp-element-button vulocart-cart-summary__checkout' }, __( 'Proceed to checkout', 'vulocart' ) )
					)
				)
			);
		},
		save: noSave,
	} );

	registerBlockType( 'vulocart/cart-link', {
		edit: function () {
			var blockProps = useBlockProps( { className: 'vulocart-cart-link' } );

			return el(
				'span',
				blockProps,
				el( 'svg', { viewBox: '0 0 24 24', width: 22, height: 22, fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': 'true' }, el( 'path', { d: 'M6 7h12l-1 13H7L6 7Z' } ), el( 'path', { d: 'M9 10V6a3 3 0 0 1 6 0v4' } ) ),
				el( 'span', { className: 'vulocart-cart-link__count' }, '2' )
			);
		},
		save: noSave,
	} );
}( window.wp ) );
