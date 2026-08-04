import * as esbuild from 'esbuild';

const watch = process.argv.includes( '--watch' );

/** @type {esbuild.BuildOptions[]} */
const configs = [
	{
		entryPoints: [ 'src/index.tsx' ],
		outfile: 'dist/vulocart-react.esm.js',
		format: 'esm',
		bundle: true,
		minify: true,
		sourcemap: true,
		target: 'es2020',
		external: [ 'react', 'react-dom', 'react/jsx-runtime' ],
	},
	{
		entryPoints: [ 'src/index.tsx' ],
		outfile: 'dist/vulocart-react.cjs.js',
		format: 'cjs',
		bundle: true,
		minify: true,
		sourcemap: true,
		target: 'es2020',
		platform: 'node',
		external: [ 'react', 'react-dom', 'react/jsx-runtime' ],
	},
];

async function run() {
	if ( watch ) {
		const contexts = await Promise.all( configs.map( ( config ) => esbuild.context( config ) ) );
		await Promise.all( contexts.map( ( context ) => context.watch() ) );
		// eslint-disable-next-line no-console -- CLI build script, not application code.
		console.log( 'Watching @vulocart/react…' );
		return;
	}

	await Promise.all( configs.map( ( config ) => esbuild.build( config ) ) );
	// eslint-disable-next-line no-console -- CLI build script, not application code.
	console.log( 'Built @vulocart/react.' );
}

run().catch( ( error ) => {
	// eslint-disable-next-line no-console -- CLI build script, not application code.
	console.error( error );
	process.exit( 1 );
} );
