/**
 * Test double for '@zyra/core' (real source: @multivendorx/zyra — see
 * tools/webpack/create-config.js's own alias comment). The real package
 * bundles @react-pdf/renderer, which ships ESM Jest can't parse under this
 * repo's deliberately babel-config-less setup — components under test don't
 * exercise real network/PDF behavior, so a lightweight jest.fn()-based
 * double is what jest-unit.config.js's moduleNameMapper points '@zyra/core'
 * at for tests only (the real webpack alias is untouched).
 */
module.exports = {
	getApiLink: ( _appLocalizer, endpoint ) => endpoint,
	getApiResponse: jest.fn(),
	sendApiResponse: jest.fn(),
	// Real values — kept in sync by hand with the real
	// packages/core/src/colorPalette.ts export this mocks, same
	// "no build step reaches a Sass map from JS" reasoning that file's
	// own docblock already documents.
	COLOR_PALETTE: {
		critical: '#991b1b',
		red: '#dc2626',
		green: '#16a34a',
		orange: '#e67a2e',
		ai: '#e67a2e',
		yellow: '#b7791f',
		blue: '#0284c7',
		sky: '#0284c7',
		cyan: '#0891b2',
		teal: '#0f9f91',
		indigo: '#6366c8',
		violet: '#8b5cf6',
		pink: '#db2777',
		rose: '#e11d48',
		lime: '#65a30d',
		gray: '#6b7280',
		dark: '#374151',
	},
};
