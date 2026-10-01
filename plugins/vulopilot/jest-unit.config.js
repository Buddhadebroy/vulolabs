/**
 * Picked up automatically by `wp-scripts test-unit-js`. Same `@wordpress/jest-preset-default` base as
 * other WordPress projects, but `@zyra/*` maps to lightweight doubles under tests/js/__mocks__: the
 * real package bundles @react-pdf/renderer, whose ESM this setup can't parse, and these tests exercise
 * plugin logic, not design-system internals.
 */
const jestConfig = require( '@wordpress/scripts/config/jest-unit.config' );

module.exports = {
	...jestConfig,
	moduleNameMapper: {
		...( jestConfig.moduleNameMapper || {} ),
		'^@zyra/core$': '<rootDir>/tests/js/__mocks__/zyra-core.js',
		'^@zyra/components$': '<rootDir>/tests/js/__mocks__/zyra-components.tsx',
		'^@zyra/inputs$': '<rootDir>/tests/js/__mocks__/zyra-inputs.tsx',
		'^@zyra/table$': '<rootDir>/tests/js/__mocks__/zyra-table.tsx',
	},
	// `preset`'s own setupFiles/setupFilesAfterEnv arrays are replaced (not
	// merged) once this object is passed through as an explicit --config, so
	// both of the preset's own files are required directly here alongside ours.
	setupFiles: [
		require.resolve( '@wordpress/jest-preset-default/scripts/setup-globals.js' ),
		'<rootDir>/tests/js/jest.setup.js',
	],
	setupFilesAfterEnv: [
		require.resolve( '@wordpress/jest-preset-default/scripts/setup-test-framework.js' ),
		'<rootDir>/tests/js/jest.setup-after-env.js',
	],
};
