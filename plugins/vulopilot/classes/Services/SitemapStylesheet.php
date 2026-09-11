<?php
/**
 * SitemapStylesheet class file.
 *
 * @package VuloPilot
 */

namespace VuloPilot\Services;

defined( 'ABSPATH' ) || exit;

/**
 * Restyles WordPress core's own native `/wp-sitemap.xml` browser view
 * (`WP_Sitemaps_Stylesheet`, wp-includes/sitemaps) to match the reference
 * mockup — a purple banner header (this plugin's own real brand color,
 * `#7c3aed`, the same `var(--color-primary, #7c3aed)` fallback already
 * used throughout this plugin's own admin styles) instead of core's plain
 * white header, and a real "Last Modified" column on the sitemap INDEX
 * page's own table.
 *
 * Deliberately does NOT build a second, competing sitemap renderer —
 * same "wrap/restyle core's own native sitemap, don't replace it" posture
 * SitemapManager.php's own docblock already establishes for the data side
 * of this same feature. Only 2 real core hooks are used:
 *
 * - `wp_sitemaps_stylesheet_css` — real CSS-only override, applies to
 *   BOTH the index page and every individual child sitemap page (core's
 *   own `get_stylesheet_css()` is shared between both), so the banner/
 *   table restyle is consistent everywhere with one filter.
 * - `wp_sitemaps_stylesheet_index_content` — a full real XSL override,
 *   ONLY for the index page's own table (`/wp-sitemap.xml`, the one
 *   listing child sitemaps the mockup shows) — core's own default XSL
 *   already conditionally renders a real "Last Modified" column
 *   (`<xsl:if test="$has-lastmod">`) but only when EVERY listed sitemap
 *   happens to carry one; this override removes that condition so the
 *   column always renders, with real per-sitemap `<lastmod>` values core
 *   itself already provides (genuinely empty, never a fabricated date,
 *   for the rare sitemap type with none). Individual child sitemap pages
 *   (the per-URL listing, e.g. `/wp-sitemap-posts-post-1.xml`) are left on
 *   core's own default XSL structure — only the CSS restyle above applies
 *   there, since that table already has a real, always-conditional
 *   "Last Modified" column of its own core doesn't need help with.
 *
 * Self-registers its own hooks in the constructor (php-wordpress.md) and
 * is constructed unconditionally in VuloPilot::init_classes(), same shape
 * as SitemapManager.php right next to it.
 *
 * @class       SitemapStylesheet class
 * @version     1.0.0
 * @author      VuloLabs
 */
class SitemapStylesheet {

    /**
     * This plugin's own real brand purple — the same `#7c3aed` fallback
     * `var(--color-primary, #7c3aed)` already resolves to throughout this
     * plugin's own admin CSS (assets/styles/index.css,
     * src/pages/Content/CreateContent.scss), reused here rather than
     * Rank Math's own unrelated blue so this page matches the rest of
     * this plugin's own real brand identity.
     *
     * @var string
     */
    private const BRAND_COLOR = '#7c3aed';

    /**
     * Light tint of BRAND_COLOR — same real paired `background:
     * var(--background-primary, #ece2f9f1)` this plugin's own admin CSS
     * already uses alongside the solid brand purple.
     *
     * @var string
     */
    private const BRAND_TINT = '#ece2f9';

    /**
     * SitemapStylesheet constructor.
     */
    public function __construct() {
        add_filter( 'wp_sitemaps_stylesheet_css', array( $this, 'filter_stylesheet_css' ) );
        add_filter( 'wp_sitemaps_stylesheet_index_content', array( $this, 'filter_index_stylesheet_content' ) );
    }

    /**
     * Real CSS-only restyle — applies to core's own existing markup
     * structure (`#sitemap__header`/`#sitemap__table`) unchanged, so this
     * alone can't break core's own XSL templating on either the index or
     * any child sitemap page.
     *
     * @param string $css Core's own default CSS for the sitemap stylesheet.
     * @return string
     */
    public function filter_stylesheet_css( $css ) {
        $brand = self::BRAND_COLOR;
        $tint  = self::BRAND_TINT;

        return $css . <<<EOF

			body {
				font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen-Sans, Ubuntu, Cantarell, "Helvetica Neue", sans-serif;
				background: #fff;
				color: #444;
				margin: 0;
			}

			#sitemap {
				max-width: 100%;
			}

			#sitemap__header {
				background: {$brand};
				color: #fff;
				padding: 2rem 2.5rem;
				margin: 0;
			}

			#sitemap__header h1 {
				margin: 0 0 0.5rem;
				font-size: 1.75rem;
			}

			#sitemap__header p {
				margin: 0.25rem 0;
				color: rgba(255, 255, 255, 0.85);
			}

			#sitemap__header a {
				color: #fff;
				text-decoration: underline;
			}

			#sitemap__content {
				max-width: 980px;
				margin: 0 auto;
				padding: 1.5rem 2.5rem 2.5rem;
			}

			#sitemap__table {
				border: solid 1px {$tint};
				border-radius: 0.375rem;
				overflow: hidden;
				width: 100%;
			}

			#sitemap__table tr th {
				background: {$brand};
				color: #fff;
				font-weight: 600;
				padding: 0.625rem;
			}
			#sitemap__table tr td{padding: 0.625rem;}
			#sitemap__table tr:nth-child(odd) td {
				background-color: {$tint};
			}
			#sitemap__table tr a{text-decoration: none;}

		EOF;
    }

    /**
     * Full real XSL override for the sitemap INDEX page only (the
     * top-level `/wp-sitemap.xml` listing child sitemaps) — same real
     * `sitemap:sitemapindex/sitemap:sitemap` data core's own default
     * template already reads, just without the `$has-lastmod` guard that
     * hides the "Last Modified" column whenever even one listed sitemap
     * happens to lack a real `<lastmod>`.
     *
     * @param string $xsl_content Core's own default index XSL content (unused — this returns a full real replacement built from the same real translatable strings core itself would use).
     * @return string
     */
    public function filter_index_stylesheet_content( $xsl_content ) {
        $title       = esc_xml( __( 'XML Sitemap', 'vulopilot' ) );
        $description = esc_xml( __( 'This XML Sitemap is generated by WordPress to make your content more visible for search engines.', 'vulopilot' ) );
        $learn_more  = sprintf(
            '<a href="%s">%s</a>',
            esc_url( __( 'https://www.sitemaps.org/', 'vulopilot' ) ),
            esc_xml( __( 'Learn more about XML sitemaps.', 'vulopilot' ) )
        );

        $text = sprintf(
            /* translators: %s: real count of child sitemaps in this index. */
            esc_xml( __( 'This XML Sitemap Index file contains %s sitemaps.', 'vulopilot' ) ),
            '<xsl:value-of select="count( sitemap:sitemapindex/sitemap:sitemap )" />'
        );

        $lang    = get_language_attributes( 'html' );
        $url     = esc_xml( __( 'Sitemap', 'vulopilot' ) );
        $lastmod = esc_xml( __( 'Last Modified', 'vulopilot' ) );
        $css     = $this->filter_stylesheet_css( '' );

        return <<<XSL
<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet
		version="1.0"
		xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
		xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9"
		exclude-result-prefixes="sitemap"
		>

	<xsl:output method="html" encoding="UTF-8" indent="yes" />

	<xsl:template match="/">
		<html {$lang}>
			<head>
				<title>{$title}</title>
				<style>
					{$css}
				</style>
			</head>
			<body>
				<div id="sitemap">
					<div id="sitemap__header">
						<h1>{$title}</h1>
						<p>{$description}</p>
						<p>{$learn_more}</p>
					</div>
					<div id="sitemap__content">
						<p class="text">{$text}</p>
						<table id="sitemap__table">
							<thead>
								<tr>
									<th class="loc">{$url}</th>
									<th class="lastmod">{$lastmod}</th>
								</tr>
							</thead>
							<tbody>
								<xsl:for-each select="sitemap:sitemapindex/sitemap:sitemap">
									<tr>
										<td class="loc"><a href="{sitemap:loc}"><xsl:value-of select="sitemap:loc" /></a></td>
										<td class="lastmod"><xsl:value-of select="sitemap:lastmod" /></td>
									</tr>
								</xsl:for-each>
							</tbody>
						</table>
					</div>
				</div>
			</body>
		</html>
	</xsl:template>
</xsl:stylesheet>

XSL;
    }
}
