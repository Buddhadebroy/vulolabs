const path = require( 'path' );
const CopyWebpackPlugin = require( 'copy-webpack-plugin' );
const createWebpackConfig = require(
	'../../tools/webpack/create-config'
);

const config = createWebpackConfig(
	__dirname
);

/**
 * Phase 4 (Embedded Commerce) — `@vulocart/sdk` (packages/js/vulocart-sdk,
 * this same repo, own esbuild-based build — NOT wp-scripts/webpack, since
 * that bundle deliberately has zero `@wordpress/*` externals so it can
 * run on a page with no WordPress scripts loaded at all) already ships a
 * fully bundled, minified `dist/vulocart-sdk.js`. This just copies that
 * existing build output into THIS plugin's own public `assets/js/`
 * directory so `<script src="…/wp-content/plugins/vulocart/assets/js/vulocart-sdk.js">`
 * resolves to a real file — no re-bundling by webpack, `noErrorOnMissing`
 * so a fresh checkout that hasn't run `pnpm -r run build` yet doesn't
 * fail vulocart's own build over a sibling package's missing output.
 */
config.plugins.push(
	new CopyWebpackPlugin( {
		patterns: [
			{
				from: path.resolve( __dirname, '../../packages/js/vulocart-sdk/dist/vulocart-sdk.js' ),
				to: path.resolve( __dirname, 'assets/js/vulocart-sdk.js' ),
				noErrorOnMissing: true,
			},
			{
				from: path.resolve( __dirname, '../../packages/js/vulocart-sdk/dist/vulocart-sdk.js.map' ),
				to: path.resolve( __dirname, 'assets/js/vulocart-sdk.js.map' ),
				noErrorOnMissing: true,
			},
		],
	} )
);

module.exports = config;
