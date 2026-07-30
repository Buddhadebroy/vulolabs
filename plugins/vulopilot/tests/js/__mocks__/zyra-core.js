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
};
