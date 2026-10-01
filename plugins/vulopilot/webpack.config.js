const createWebpackConfig = require(
	'../../tools/webpack/create-config'
);

const config = createWebpackConfig(
	__dirname
);

// @multivendorx/zyra ships as one non-tree-shakeable CommonJS bundle shared across the zyra family, so
// importing anything pulls in every `require()` in it, including ones this plugin never calls.
// `@react-pdf/renderer` (~2.4 MiB, the largest package in vendors.js) is one: it's required only by
// zyra's `PickerInput` (a template picker with PDF preview), which nothing in src/ or modules/
// imports or declares a `type: 'picker'` field for (confirmed by grep).
// Aliasing it to `false` resolves every `require('@react-pdf/renderer')` to an empty module. Scoped
// here, not in the shared tools/webpack/create-config.js, so it stays opt-in per plugin (vulocart's
// "Invoice" feature could plausibly use PickerInput).
//
// If a zyra update routes a used component through PickerInput or `@react-pdf/renderer`, remove this
// alias: `false` fails silently at runtime (e.g. "Document is not a function"), not at build. After
// any zyra upgrade touching PickerInput, re-grep (PickerInput/templateSelector/showPdfButton/
// `type: 'picker'` across src/ and modules/).
config.resolve.alias['@react-pdf/renderer$'] = false;

// wordpress.org forbids loading code from other sites. zyra and @tinymce/tinymce-react bundle widgets
// that fetch from Google Maps, Mapbox, reCAPTCHA and TinyMCE Cloud; this plugin uses none, so their
// host names are replaced at build time (see the loader's docblock). Opt-in per plugin, like the
// @react-pdf/renderer alias above.
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
