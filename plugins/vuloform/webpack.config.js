const createWebpackConfig = require(
	'../../tools/webpack/create-config'
);

const config = createWebpackConfig(
	__dirname
);

// zyra ships as one bundle, so importing any component pulls in everything it requires.
// `@react-pdf/renderer` (about 2.4 MiB) is only needed by zyra's `PickerInput`, which VuloForm does
// not use, so it is resolved to an empty module. If a zyra component VuloForm uses ever starts
// needing it, remove this alias: `false` fails at runtime, not at build.
config.resolve.alias['@react-pdf/renderer$'] = false;

// wordpress.org forbids loading code from other sites. zyra and @tinymce/tinymce-react bundle widgets
// that fetch from Google Maps, Mapbox, reCAPTCHA and TinyMCE Cloud. VuloForm uses none of them, so
// their host names are replaced at build time (see the loader's docblock).
config.module.rules.unshift( {
	test: /\.(c|m)?js$/,
	include: /[\\/](?:@multivendorx[\\/]zyra|@tinymce[\\/]tinymce-react)[\\/]/,
	enforce: 'pre',
	use: require( 'path' ).resolve(
		__dirname,
		'../../tools/webpack/loaders/disable-remote-hosts.js'
	),
} );

module.exports = config;
