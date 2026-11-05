<?php
/**
 * SitemapStylesheet class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\SeoVisibility;

defined( 'ABSPATH' ) || exit;

/**
 * Restyles WordPress core's own native `/wp-sitemap.xml` browser view.
 *
 * Browsers are removing client-side XSLT support, so core's own approach - an
 * `<?xml-stylesheet type="text/xsl" ...?>` processing instruction that the browser transforms -
 * no longer works and logs a deprecation warning in the console. We turn that PI off entirely
 * (`wp_sitemaps_stylesheet_url`/`wp_sitemaps_stylesheet_index_url` returning false, same as core's
 * own documented way to disable it) and instead render the same look as a real server-side HTML
 * page, swapped in only when a browser is navigating directly to a sitemap URL - crawlers and the
 * raw XML every other consumer reads are completely unaffected.
 *
 * @class       SitemapStylesheet class
 * @version     2.0.0
 * @author      VuloLabs
 */
class SitemapStylesheet {

	/**
	 * Compiled file, relative to the plugin folder.
	 *
	 * @var string
	 */
	private const STYLE_FILE = 'assets/styles/public/vulopilot-sitemap-stylesheet.min.css';

	/**
	 * SitemapStylesheet constructor.
	 */
	public function __construct() {
		// Core's own escape hatch - a falsey URL means no xml-stylesheet PI is emitted at all.
		add_filter( 'wp_sitemaps_stylesheet_url', '__return_false' );
		add_filter( 'wp_sitemaps_stylesheet_index_url', '__return_false' );

		// Earlier than core's own `render_sitemaps()` (added at the default priority, 10), so we
		// can swap in an HTML response before core ever writes an XML one.
		add_action( 'template_redirect', array( $this, 'maybe_render_html' ), 5 );
	}

	/**
	 * If this request is a browser navigating straight to a sitemap URL, renders the same page as
	 * real HTML and exits; otherwise does nothing and lets core's own XML rendering run as normal.
	 *
	 * @return void
	 */
	public function maybe_render_html() {
		$sitemap = sanitize_text_field( (string) get_query_var( 'sitemap' ) );

		if ( '' === $sitemap || ! $this->is_browser_request() ) {
			return;
		}

		$server = wp_sitemaps_get_server();

		if ( 'index' === $sitemap ) {
			$this->render_html( $this->index_rows( $server->index->get_sitemap_list() ), true );
			exit;
		}

		$provider = $server->registry->get_provider( $sitemap );

		if ( ! $provider ) {
			return;
		}

		$object_subtype = sanitize_text_field( (string) get_query_var( 'sitemap-subtype' ) );
		$paged          = max( 1, absint( get_query_var( 'paged' ) ) );
		$url_list       = $provider->get_url_list( $paged, $object_subtype );

		// Empty: let core 404 the request exactly like it would for the XML version.
		if ( empty( $url_list ) ) {
			return;
		}

		$this->render_html( $this->url_rows( $url_list ), false );
		exit;
	}

	/**
	 * A direct browser visit asks for `text/html`; a crawler or any other XML consumer does not -
	 * same heuristic the WordPress ecosystem settled on for this exact browser change.
	 *
	 * @return bool
	 */
	private function is_browser_request() {
		$accept = isset( $_SERVER['HTTP_ACCEPT'] ) ? sanitize_text_field( wp_unslash( $_SERVER['HTTP_ACCEPT'] ) ) : '';

		return false !== strpos( $accept, 'text/html' );
	}

	/**
	 * Builds the table rows for a single sitemap's URL list.
	 *
	 * @param array $url_list Core's own per-URL array (`loc`, optionally `lastmod`, `changefreq`, `priority`).
	 * @return array{rows: string, has_lastmod: bool, has_changefreq: bool, has_priority: bool}
	 */
	private function url_rows( array $url_list ) {
		$has_lastmod    = false;
		$has_changefreq = false;
		$has_priority   = false;
		$rows           = '';

		foreach ( $url_list as $item ) {
			$has_lastmod    = $has_lastmod || ! empty( $item['lastmod'] );
			$has_changefreq = $has_changefreq || ! empty( $item['changefreq'] );
			$has_priority   = $has_priority || isset( $item['priority'] );

			$rows .= '<tr>';
			$rows .= '<td class="loc"><a href="' . esc_url( $item['loc'] ) . '">' . esc_html( $item['loc'] ) . '</a></td>';

			if ( $has_lastmod ) {
				$rows .= '<td class="lastmod">' . esc_html( $item['lastmod'] ?? '' ) . '</td>';
			}

			if ( $has_changefreq ) {
				$rows .= '<td class="changefreq">' . esc_html( $item['changefreq'] ?? '' ) . '</td>';
			}

			if ( $has_priority ) {
				$rows .= '<td class="priority">' . esc_html( isset( $item['priority'] ) ? (string) $item['priority'] : '' ) . '</td>';
			}

			$rows .= '</tr>';
		}

		return compact( 'rows', 'has_lastmod', 'has_changefreq', 'has_priority' );
	}

	/**
	 * Builds the table rows for the top-level sitemap index.
	 *
	 * @param array $sitemap_list Core's own index array (`loc`, optionally `lastmod`).
	 * @return array{rows: string}
	 */
	private function index_rows( array $sitemap_list ) {
		$rows = '';

		foreach ( $sitemap_list as $item ) {
			$rows .= '<tr>';
			$rows .= '<td class="loc"><a href="' . esc_url( $item['loc'] ) . '">' . esc_html( $item['loc'] ) . '</a></td>';
			$rows .= '<td class="lastmod">' . esc_html( $item['lastmod'] ?? '' ) . '</td>';
			$rows .= '</tr>';
		}

		return array( 'rows' => $rows );
	}

	/**
	 * Writes the real HTML page and ends the request, same markup/CSS classes
	 * (`#sitemap__header`/`#sitemap__table`) the old XSL output used, so the compiled stylesheet
	 * applies unchanged.
	 *
	 * @param array $table    From `url_rows()`/`index_rows()`.
	 * @param bool  $is_index Whether this is the top-level sitemap index.
	 * @return void
	 */
	private function render_html( array $table, $is_index ) {
		nocache_headers();
		header( 'Content-Type: text/html; charset=UTF-8' );

		$title       = __( 'XML Sitemap', 'vulopilot' );
		$description = __( 'This XML Sitemap is generated by VuloPilot powered by WordPress to make your content more visible for search engines.', 'vulopilot' );
		$css_url     = $this->get_stylesheet_url();

		$text = $is_index
			? sprintf(
				/* translators: %s: real count of child sitemaps in this index. */
				__( 'This XML Sitemap Index file contains %s sitemaps.', 'vulopilot' ),
				number_format_i18n( substr_count( $table['rows'], '<tr>' ) )
			)
			: sprintf(
				/* translators: %s: real count of URLs in this sitemap. */
				__( 'Number of URLs in this XML Sitemap: %s.', 'vulopilot' ),
				number_format_i18n( substr_count( $table['rows'], '<tr>' ) )
			);

		?>
<!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<title><?php echo esc_html( $title ); ?></title>
		<?php if ( '' !== $css_url ) : ?>
	<?php // phpcs:ignore WordPress.WP.EnqueuedResources.NonEnqueuedStylesheet -- this response is written directly, outside wp_head/the normal page template, so there is nothing to enqueue into. ?>
	<link rel="stylesheet" type="text/css" href="<?php echo esc_url( $css_url ); ?>">
	<?php endif; ?>
</head>
<body>
	<div id="sitemap">
		<div id="sitemap__header">
			<h1><?php echo esc_html( $title ); ?></h1>
			<p><?php echo esc_html( $description ); ?></p>
			<p><a href="<?php echo esc_url( __( 'https://www.sitemaps.org/', 'vulopilot' ) ); ?>"><?php esc_html_e( 'Learn more about XML sitemaps.', 'vulopilot' ); ?></a></p>
		</div>
		<div id="sitemap__content">
			<p class="text"><?php echo esc_html( $text ); ?></p>
			<table id="sitemap__table">
				<thead>
					<tr>
						<th class="loc"><?php echo esc_html( $is_index ? __( 'Sitemap', 'vulopilot' ) : __( 'URL', 'vulopilot' ) ); ?></th>
						<?php if ( $is_index || ! empty( $table['has_lastmod'] ) ) : ?>
						<th class="lastmod"><?php esc_html_e( 'Last Modified', 'vulopilot' ); ?></th>
						<?php endif; ?>
						<?php if ( ! $is_index && ! empty( $table['has_changefreq'] ) ) : ?>
						<th class="changefreq"><?php esc_html_e( 'Change Frequency', 'vulopilot' ); ?></th>
						<?php endif; ?>
						<?php if ( ! $is_index && ! empty( $table['has_priority'] ) ) : ?>
						<th class="priority"><?php esc_html_e( 'Priority', 'vulopilot' ); ?></th>
						<?php endif; ?>
					</tr>
				</thead>
				<tbody>
					<?php echo $table['rows']; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- built field-by-field in url_rows()/index_rows(), each value already escaped there. ?>
				</tbody>
			</table>
		</div>
	</div>
</body>
</html>
		<?php
	}

	/**
	 * Address of the compiled file, with the plugin version appended. Empty when the file has not
	 * been built.
	 *
	 * @return string
	 */
	private function get_stylesheet_url(): string {
		if ( ! file_exists( VuloPilot()->plugin_path . self::STYLE_FILE ) ) {
			return '';
		}

		wp_register_style(
			'vulopilot-sitemap-stylesheet',
			VuloPilot()->plugin_url . self::STYLE_FILE,
			array(),
			VuloPilot()->version
		);

		$style = wp_styles()->registered['vulopilot-sitemap-stylesheet'];

		return add_query_arg( 'ver', $style->ver, $style->src );
	}
}
