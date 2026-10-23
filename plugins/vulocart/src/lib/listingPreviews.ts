/**
 * Miniature drawings of the storefront listing layouts, as SVG data URIs for a choice-toggle option's `img`.
 * Each draws image / title / price blocks in the layout's own grid, so the choice is visual.
 */
type Layout = 'grid' | 'compact' | 'list' | 'showcase';

const SHAPES: Record< Layout, { cols: number; rows: number; list?: boolean } > = {
	grid: { cols: 3, rows: 2 },
	compact: { cols: 4, rows: 3 },
	list: { cols: 1, rows: 3, list: true },
	showcase: { cols: 2, rows: 1 },
};

/** Draws the small SVG thumbnail of a product listing layout. */
function draw( layout: Layout ): string {
	const { cols, rows, list } = SHAPES[ layout ];
	const width = 200;
	const height = 120;
	const pad = 10;
	const gap = 6;
	const cellW = ( width - pad * 2 - gap * ( cols - 1 ) ) / cols;
	const cellH = ( height - pad * 2 - gap * ( rows - 1 ) ) / rows;
	let body = '';

	for ( let r = 0; r < rows; r++ ) {
		for ( let c = 0; c < cols; c++ ) {
			const x = pad + c * ( cellW + gap );
			const y = pad + r * ( cellH + gap );
			body += `<rect x="${ x }" y="${ y }" width="${ cellW }" height="${ cellH }" rx="4" fill="#fff" stroke="#e3e6ef"/>`;

			if ( list ) {
				body += `<rect x="${ x + 4 }" y="${ y + 4 }" width="${ cellH - 8 }" height="${ cellH - 8 }" rx="3" fill="#dfe3f0"/>`;
				body += `<rect x="${ x + cellH + 4 }" y="${ y + cellH / 2 - 6 }" width="${ cellW * 0.5 }" height="4" rx="2" fill="#c3c9dc"/>`;
				body += `<rect x="${ x + cellH + 4 }" y="${ y + cellH / 2 + 2 }" width="${ cellW * 0.3 }" height="4" rx="2" fill="#e3e6ef"/>`;
			} else {
				const imgH = cellH * 0.58;
				body += `<rect x="${ x + 4 }" y="${ y + 4 }" width="${ cellW - 8 }" height="${ imgH }" rx="3" fill="#dfe3f0"/>`;
				body += `<rect x="${ x + 4 }" y="${ y + imgH + 9 }" width="${ ( cellW - 8 ) * 0.7 }" height="4" rx="2" fill="#c3c9dc"/>`;
				body += `<rect x="${ x + 4 }" y="${ y + imgH + 17 }" width="${ ( cellW - 8 ) * 0.4 }" height="4" rx="2" fill="#e3e6ef"/>`;
			}
		}
	}

	const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ width } ${ height }"><rect width="${ width }" height="${ height }" rx="8" fill="#f5f6fb"/>${ body }</svg>`;

	return `data:image/svg+xml;utf8,${ encodeURIComponent( svg ) }`;
}

/** Returns the SVG thumbnail for a listing layout, used in the layout picker. */
export const listingPreview = ( layout: Layout ): string => draw( layout );
