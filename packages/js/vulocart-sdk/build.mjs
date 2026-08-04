import * as esbuild from 'esbuild';

const watch = process.argv.includes( '--watch' );

/** @type {esbuild.BuildOptions[]} */
const configs = [
	// `import "@vulocart/sdk"` — explicit `VuloCart.init()` call required,
	// standard library ergonomics (index.ts's own docblock).
	{
		entryPoints: [ 'src/index.ts' ],
		outfile: 'dist/vulocart-sdk.esm.js',
		format: 'esm',
		bundle: true,
		minify: true,
		sourcemap: true,
		target: 'es2020',
	},
	{
		entryPoints: [ 'src/index.ts' ],
		outfile: 'dist/vulocart-sdk.cjs.js',
		format: 'cjs',
		bundle: true,
		minify: true,
		sourcemap: true,
		target: 'es2020',
		platform: 'node',
	},
	// `<script src="vulocart-sdk.js"></script>` — self-initializes and
	// attaches `window.VuloCart`, zero config (auto.ts's own docblock).
	// No `globalName` needed: auto.ts itself assigns `window.VuloCart`, the
	// IIFE's own return value is unused.
	{
		entryPoints: [ 'src/auto.ts' ],
		outfile: 'dist/vulocart-sdk.js',
		format: 'iife',
		bundle: true,
		minify: true,
		sourcemap: true,
		target: 'es2018', // Broader than the other two builds — this one runs on arbitrary third-party pages this codebase doesn't control the browser target for.
	},
];

async function run() {
	if ( watch ) {
		const contexts = await Promise.all( configs.map( ( config ) => esbuild.context( config ) ) );
		await Promise.all( contexts.map( ( context ) => context.watch() ) );
		// eslint-disable-next-line no-console -- CLI build script, not application code.
		console.log( 'Watching @vulocart/sdk…' );
		return;
	}

	await Promise.all( configs.map( ( config ) => esbuild.build( config ) ) );
	// eslint-disable-next-line no-console -- CLI build script, not application code.
	console.log( 'Built @vulocart/sdk.' );
}

run().catch( ( error ) => {
	// eslint-disable-next-line no-console -- CLI build script, not application code.
	console.error( error );
	process.exit( 1 );
} );
