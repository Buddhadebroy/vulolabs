/**
 * `wp-scripts test-unit-js` picks this up automatically (see
 * getJestOverrideConfigFile() in @wordpress/scripts/utils/config.js) — same
 * `@wordpress/jest-preset-default` base every WordPress project uses (jsdom
 * env, CSS/SCSS mocked, WP-flavored babel transform when no babel.config.js
 * exists, which this repo intentionally doesn't have), just with `@zyra/*`
 * mapped to lightweight test doubles under tests/js/__mocks__ instead of the
 * real `@multivendorx/zyra` tools/webpack/create-config.js aliases them to
 * for the actual build — the real package bundles @react-pdf/renderer,
 * which ships ESM this Jest setup can't parse, and these tests exercise
 * this plugin's own logic, not the design system's internals (see each stub
 * file's own docblock). Mirrors vulopilot-pro's own jest-unit.config.js.
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
