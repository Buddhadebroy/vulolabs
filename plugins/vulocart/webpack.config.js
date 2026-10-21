const path = require( 'path' );
const CopyWebpackPlugin = require( 'copy-webpack-plugin' );
const createWebpackConfig = require(
	'../../tools/webpack/create-config'
);

const config = createWebpackConfig(
	__dirname
);

/**
 * Copies the prebuilt `@vulocart/sdk` bundle (`dist/vulocart-sdk.js`, built separately with esbuild and without any
 * `@wordpress/*` externals, so it can run on a page that loads no WordPress scripts) into this plugin's `assets/js/`
 * folder, so `<script src=".../wp-content/plugins/vulocart/assets/js/vulocart-sdk.js">` resolves. webpack does not
 * bundle it again. `noErrorOnMissing` stops a fresh checkout that has not built the SDK yet from failing this build.
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
