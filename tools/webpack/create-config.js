const defaultConfig = require(
	'@wordpress/scripts/config/webpack.config'
);

const path = require('path');

const fs = require('fs');

const MiniCssExtractPlugin = require(
	'mini-css-extract-plugin'
);

const DependencyExtractionWebpackPlugin = require(
	'@wordpress/dependency-extraction-webpack-plugin'
);

const CopyWebpackPlugin = require(
	'copy-webpack-plugin'
);

/**
 * Generate dynamic Gutenberg block entries
 */
function generateBlockEntries(rootDir) {
	const blockBasePath = path.resolve(
		rootDir,
		'src/blocks'
	);

	if (!fs.existsSync(blockBasePath)) {
		return {};
	}

	const blockDirs = fs
		.readdirSync(blockBasePath, {
			withFileTypes: true,
		})
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);

	const entries = {};

	for (const blockName of blockDirs) {
		const blockPath = path.join(blockBasePath, blockName);

		const indexFile = path.join(blockPath, 'index.js');
		const viewFile = path.join(blockPath, 'view.js');

		if (fs.existsSync(indexFile)) {
			entries[`block/${blockName}/index`] = indexFile;
		}

		if (fs.existsSync(viewFile)) {
			entries[`block/${blockName}/view`] = viewFile;
		}
	}

	return entries;
}

/**
 * Generate dynamic block asset copy patterns
 */
function generateBlockPatterns(rootDir) {
	const blockBasePath = path.resolve(
		rootDir,
		'src/blocks'
	);

	if (!fs.existsSync(blockBasePath)) {
		return [];
	}

	const blockDirs = fs
		.readdirSync(blockBasePath, {
			withFileTypes: true,
		})
		.filter((dirent) => dirent.isDirectory())
		.map((dirent) => dirent.name);

	return blockDirs.flatMap((blockName) => {
		const blockPath = path.join(
			blockBasePath,
			blockName
		);

		const outPath = path.resolve(
			rootDir,
			'assets/js/block',
			blockName
		);

		const patterns = [];

		// block.json
		if (
			fs.existsSync(
				path.join(
					blockPath,
					'block.json'
				)
			)
		) {
			patterns.push({
				from: path.join(
					blockPath,
					'block.json'
				),
				to: path.join(
					outPath,
					'block.json'
				),
			});
		}

		// render.php
		if (
			fs.existsSync(
				path.join(
					blockPath,
					'render.php'
				)
			)
		) {
			patterns.push({
				from: path.join(
					blockPath,
					'render.php'
				),
				to: path.join(
					outPath,
					'render.php'
				),
			});
		}

		return patterns;
	});
}

/**
 * Generate dynamic module entries
 *
 * modules/{moduleName}/blocks/index.tsx
 */
function generateModuleEntries(rootDir) {
	const moduleEntries = {};

	const modulesBasePath = path.resolve(
		rootDir,
		'modules'
	);

	if (
		fs.existsSync(modulesBasePath) &&
		fs.statSync(modulesBasePath).isDirectory()
	) {
		const moduleDirs = fs
			.readdirSync(modulesBasePath, {
				withFileTypes: true,
			})
			.filter((dirent) => dirent.isDirectory())
			.map((dirent) => dirent.name);

		moduleDirs.forEach((moduleName) => {
			const entryPath = path.join(
				modulesBasePath,
				moduleName,
				'blocks/index.tsx'
			);

			if (fs.existsSync(entryPath)) {
				moduleEntries[
					`../modules/${moduleName}/block/view`
				] = entryPath;
			}
		});
	}

	return moduleEntries;
}

/**
 * Optional Block Editor sidebar entry — `src/post-editor/index.tsx`, not
 * every plugin's own admin dashboard mount (`src/index.tsx`, always
 * present). Guarded by existence, same "skip if the file doesn't exist"
 * posture as the block/module entry generators above, so plugins without
 * a post-editor integration (every plugin except vulopilot, today) are
 * unaffected.
 */
function generatePostEditorEntry(rootDir) {
	const entryFile = path.resolve(
		rootDir,
		'src/post-editor/index.tsx'
	);

	return fs.existsSync(entryFile)
		? { 'post-editor': entryFile }
		: {};
}

/**
 * Optional storefront bundle entry — `src/storefront/index.tsx`, a
 * plugin's own script for the PUBLIC-facing side of a page (as opposed to
 * `src/index.tsx`, always wp-admin-only). Same guarded-by-existence
 * posture as generatePostEditorEntry() above, so plugins with no
 * storefront bundle of their own (every plugin except vulocart-pro,
 * today — its Order Notes/Coupons/Gift Cards checkout-step extensions
 * need to run on the free `vulocart` plugin's own storefront checkout
 * page, which has no wp-admin context to inject an admin bundle's
 * `@wordpress/hooks` filters into) are unaffected.
 */
function generateStorefrontEntry(rootDir) {
	const entryFile = path.resolve(
		rootDir,
		'src/storefront/index.tsx'
	);

	return fs.existsSync(entryFile)
		? { storefront: entryFile }
		: {};
}

module.exports = function createWebpackConfig(
	rootDir
) {
	const dynamicEntries =
		generateBlockEntries(rootDir);

	const dynamicPatterns =
		generateBlockPatterns(rootDir);

	const moduleEntries =
		generateModuleEntries(rootDir);

	const postEditorEntry =
		generatePostEditorEntry(rootDir);

	const storefrontEntry =
		generateStorefrontEntry(rootDir);

	return {
		...defaultConfig,

		entry: {
			index: path.resolve(
				rootDir,
				'./src/index.tsx'
			),

			...dynamicEntries,
			...moduleEntries,
			...storefrontEntry,
			...postEditorEntry,
		},

		output: {
			...defaultConfig.output,

			path: path.resolve(
				rootDir,
				'assets'
			),

			filename: 'js/[name].js',

			chunkFilename:
				'chunks/[name].[contenthash].js',

			clean: false,
		},

		optimization: {
			...defaultConfig.optimization,

			splitChunks: {
				chunks: 'all',

				minSize: 20000,

				maxInitialRequests: 5,

				maxAsyncRequests: 5,

				cacheGroups: {
					default: false,

					vendors: {
						test: /[\\/]node_modules[\\/]/,

						name: 'vendors',

						priority: -10,

						reuseExistingChunk: true,
					},
				},
			},

			runtimeChunk: false,
		},

		watchOptions: {
			// '@multivendorx/zyra' is a real pnpm symlink into a sibling
			// zyra checkout (not a real, static, installed dependency) —
			// blanket-ignoring all of node_modules here meant an ongoing
			// zyra source edit's rebuilt output never got noticed once
			// this watcher was already running (only a *fresh* `pnpm
			// watch` start ever picked up the current on-disk content,
			// since that's a one-time resolve/read, not a watch). Carve
			// out just that one package so live zyra-repo edits keep
			// reflecting here without a full webpack restart each time —
			// everything else under node_modules (thousands of real,
			// static dependencies) stays ignored as before.
			ignored: /node_modules\/(?!\.pnpm\/.*@multivendorx\+zyra|@multivendorx\/zyra)/,
		},

		module: {
			...defaultConfig.module,

			rules: [
				{
					test: /\.html$/i,

					type: 'asset/source',
				},

				{
					test: /\.tsx?$/,

					exclude: /node_modules/,

					use: {
						loader: 'ts-loader',

						options: {
							transpileOnly: true,
						},
					},
				},

				{
					test: /\.(t|j)sx?$/,

					exclude:
						/[\\/]node_modules[\\/]/,

					use: {
						loader: 'babel-loader',

						options: {
							presets: [
								'@wordpress/babel-preset-default',
							],

							cacheDirectory:
								path.resolve(
									rootDir,
									'.cache/babel'
								),

							cacheCompression: false,
						},
					},
				},

				{
					test: /\.css$/,

					use: [
						'style-loader',
						'css-loader',
					],
				},

				{
					test: /\.(png|jpe?g|gif|svg)$/i,

					type: 'asset/resource',

					generator: {
						filename:
							'images/[name][hash][ext]',
					},
				},

				{
					test: /\.scss$/,

					use: [
						MiniCssExtractPlugin.loader,

						{
							loader: 'css-loader',

							options: {
								url: true,

								importLoaders: 2,
							},
						},

						{
							loader:
								'postcss-loader',

							options: {
								postcssOptions: {
									plugins: [
										require(
											'autoprefixer'
										),
									],
								},
							},
						},

						'sass-loader',
					],
				},

				{
					test: /\.(woff(2)?|ttf|eot|otf|svg)$/i,

					type: 'asset/resource',

					generator: {
						filename:
							'fonts/[name][hash][ext][query]',
					},
				},
			],
		},

		plugins: [
			new MiniCssExtractPlugin({
				filename:
					'styles/[name].css',
			}),

			new DependencyExtractionWebpackPlugin({
				outputFormat: 'php',

				injectPolyfill: true,
			}),

			new CopyWebpackPlugin({
				patterns: [
					/**
					 * Copy ONLY public images
					 *
					 * public/images/*
					 * →
					 * assets/images/public/*
					 */
					{
						from: path.resolve(
							rootDir,
							'public/images'
						),

						to: path.resolve(
							rootDir,
							'assets/images/public'
						),

						noErrorOnMissing: true,
					},

					...dynamicPatterns,
				],
			}),
		],

		resolve: {
			extensions: [
				'.ts',
				'.tsx',
				'.js',
				'.jsx',
			],

			modules: ['node_modules'],

			alias: {
				'@': path.resolve(
					rootDir,
					'./src'
				),

				// The real installed dependency is '@multivendorx/zyra'
				// (published to GitHub Packages). 'zyra' stays aliased to
				// it so the ~292 existing `import ... from 'zyra'` call
				// sites don't need a mass rename. The '@zyra/*' aliases
				// let source files import from the more specific
				// '@zyra/components', '@zyra/inputs', etc. names for
				// readability without needing each sub-package installed
				// separately — everything resolves to the one real
				// dependency below.
				zyra: '@multivendorx/zyra',
				'@zyra/core': '@multivendorx/zyra',
				// @zyra/components is the former @zyra/elements package
				// (renamed upstream, itself formerly @zyra/primitives), and
				// also absorbed the former @zyra/recaptcha package
				// (RecaptchaUI, Recaptcha, CustomRecaptcha), the settings
				// navigation/module list (Modules, SettingsNavigator), and
				// MapProvider/GuidedTourProvider (formerly @zyra/providers,
				// now removed — don't re-add an alias for it;
				// useModules/SettingProvider/ThemeProvider moved to
				// @zyra/core instead). It has also now fully absorbed
				// @zyra/admin (HeaderComponent/HeaderSearchComponent,
				// formerly AdminHeader/AdminHeaderSearch) — @zyra/admin no
				// longer exists as a package, so don't re-add an alias for
				// it either.
				'@zyra/components': '@multivendorx/zyra',
				'@zyra/inputs': '@multivendorx/zyra',
				'@zyra/table': '@multivendorx/zyra',
				// @zyra/builders covers what used to be the separate
				// @zyra/editor and @zyra/formbuilder packages (merged
				// upstream in the zyra repo) — BlockBuilder, CanvasEditor,
				// SettingMetaBox, FormViewer, FreeFormCustomizer, FIELD_REGISTRY.
				'@zyra/builders': '@multivendorx/zyra',

				// ── Local zyra source dev toggle ──────────────────────────
				// The block above resolves every zyra import to the one
				// installed '@multivendorx/zyra' dependency, i.e. its
				// prebuilt `packages/bundle/build/index.js` — a real zyra
				// source edit (in the sibling zyra repo this is pnpm-linked
				// from) only shows up here once zyra's own `pnpm run dev`/
				// `pnpm run build` has re-emitted that build output; this
				// webpack watcher has no visibility into zyra's raw
				// TypeScript source on its own.
				//
				// To make zyra source changes reflect live in THIS plugin's
				// watch without a manual zyra rebuild each time: comment out
				// the six 'zyra'/'@zyra/*' lines above, uncomment the block
				// below, and point ZYRA_SRC_DIR at your local zyra checkout
				// (only needed once — this plugin doesn't otherwise know
				// where a sibling zyra repo lives on disk). Every '@zyra/*'
				// name below resolves straight to that sub-package's own
				// `src/index.ts`, so ts-loader compiles zyra's real source
				// as part of this plugin's own build (the `.tsx?` rule's
				// `exclude: /node_modules/` doesn't apply — the zyra repo
				// lives outside node_modules). Switch back to the block
				// above before building for release — this alias resolves
				// zyra's raw, untranspiled-by-zyra-itself source, not the
				// package a real install would use.
				//
				// const ZYRA_SRC_DIR = '/absolute/path/to/zyra/packages';
				// zyra: path.resolve(ZYRA_SRC_DIR, 'bundle/src/index.ts'),
				// '@zyra/core': path.resolve(ZYRA_SRC_DIR, 'core/src/index.ts'),
				// '@zyra/components': path.resolve(ZYRA_SRC_DIR, 'components/src/index.ts'),
				// '@zyra/inputs': path.resolve(ZYRA_SRC_DIR, 'inputs/src/index.ts'),
				// '@zyra/table': path.resolve(ZYRA_SRC_DIR, 'table/src/index.ts'),
				// '@zyra/builders': path.resolve(ZYRA_SRC_DIR, 'builders/src/index.ts'),
				// '@zyra/theme': path.resolve(ZYRA_SRC_DIR, 'theme/src/index.ts'),
			},
		},

		externals: {
			react: 'React',
			'react-dom': 'ReactDOM',
			'@wordpress/element': ['wp', 'element'],
			'@wordpress/i18n': ['wp', 'i18n'],
			'@wordpress/components': ['wp', 'components'],
			'@wordpress/data': ['wp', 'data'],
			'@wordpress/hooks': ['wp', 'hooks'],
			'@wordpress/plugins': ['wp', 'plugins'],
			'@wordpress/blocks': ['wp', 'blocks'],
			'@wordpress/block-editor': ['wp', 'blockEditor'],
			// Only imported by vulopilot's src/post-editor/* (the
			// PluginSidebar-based "Meta Box" — react-frontend.md doesn't
			// cover this since it's this codebase's first Block Editor
			// integration) — maps to the same `wp-edit-post` script handle
			// every other @wordpress/edit-post consumer in WP core uses.
			'@wordpress/edit-post': ['wp', 'editPost'],
		},
	};
};