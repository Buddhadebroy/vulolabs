<?php
namespace VuloPilot\SeoVisibility\Rest;

defined( 'ABSPATH' ) || exit;

/**
 * REST controller for live fetch-and-parse of this site's `/robots.txt`
 * and sitemap index, backing RobotsSitemapSection.tsx's "Robots.txt
 * Analysis"/"XML Sitemap Overview" cards.
 *
 * @class       RobotsSitemap controller
 * @version     1.0.0
 * @author      VuloLabs
 */
class RobotsSitemap extends \WP_REST_Controller {

	/**
	 * @var string
	 */
	protected $rest_base = 'robots-sitemap';

	private const REQUEST_TIMEOUT_SECONDS = 8;

	/** Bounds how many child sitemaps a single index fetch inspects/counts. */
	private const MAX_CHILD_SITEMAPS = 50;


	/**
	 * @inheritDoc
	 */
	public function register_routes() {
		register_rest_route(
			VuloPilot()->rest_namespace,
			'/' . $this->rest_base . '/robots',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_robots' ),
					'permission_callback' => array( $this, 'permissions_check' ),
				),
				array(
					'methods'             => \WP_REST_Server::CREATABLE,
					'callback'            => array( $this, 'save_robots' ),
					'permission_callback' => array( $this, 'permissions_check' ),
				),
			)
		);

		register_rest_route(
			VuloPilot()->rest_namespace,
			'/' . $this->rest_base . '/sitemap',
			array(
				array(
					'methods'             => \WP_REST_Server::READABLE,
					'callback'            => array( $this, 'get_sitemap' ),
					'permission_callback' => array( $this, 'permissions_check' ),
				),
			)
		);
	}

	/**
	 * Same manage_options gate every other VuloPilot REST route uses.
	 *
	 * @param \WP_REST_Request $request Full request object.
	 * @return bool
	 */
	public function permissions_check( $request ) {
		return current_user_can( 'manage_options' );
	}

	/**
	 * Live-fetches this site's own `/robots.txt` and parses every real `User-
	 * agent`/`Allow`/`Disallow`/`Sitemap`/`Crawl-delay` line.
	 *
	 * @param \WP_REST_Request $request Full request object.
	 * @return \WP_REST_Response
	 */
	public function get_robots( $request ) {
		$url      = home_url( '/robots.txt' );
		$response = wp_remote_get(
			$url,
			array(
				'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
				'sslverify' => false,
			)
		);

		$custom_content = VuloPilot()->robots_txt_manager->get_custom_content();
		$is_custom      = '' !== $custom_content;

		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			return rest_ensure_response(
				array(
					'reachable'      => false,
					'url'            => $url,
					'content'        => '',
					'is_custom'      => $is_custom,
					'custom_content' => $custom_content,
					'rules'          => array(
						'total'      => 0,
						'allowed'    => 0,
						'disallowed' => 0,
						'sitemaps'   => 0,
					),
					'directives'     => array(
						'user_agents' => array(),
						'allow'       => array(),
						'disallow'    => array(),
						'sitemaps'    => array(),
						'crawl_delay' => null,
					),
				)
			);
		}

		$content = (string) wp_remote_retrieve_body( $response );
		$parsed  = $this->parse_robots_txt( $content );

		return rest_ensure_response(
			array_merge(
				array(
					'reachable'      => true,
					'url'            => $url,
					'content'        => $content,
					'is_custom'      => $is_custom,
					'custom_content' => $custom_content,
				),
				$parsed
			)
		);
	}

	/**
	 * Saves a persisted override of this site's robots.txt output via
	 * RobotsTxtManager::save_custom_content(). An empty `content` clears
	 * the override, reverting to core's default.
	 *
	 * @param \WP_REST_Request $request Full request object.
	 * @return \WP_REST_Response
	 */
	public function save_robots( $request ) {
		$content = sanitize_textarea_field( (string) $request->get_param( 'content' ) );

		VuloPilot()->robots_txt_manager->save_custom_content( $content );

		return rest_ensure_response(
			array(
				'saved'     => true,
				'is_custom' => '' !== $content,
			)
		);
	}

	/**
	 * Plain line-by-line real robots.txt directive parser.
	 *
	 * @param string $content Raw robots.txt body.
	 * @return array{rules: array, directives: array}
	 */
	private function parse_robots_txt( string $content ): array {
		$lines       = preg_split( '/\r\n|\r|\n/', $content ) ? preg_split( '/\r\n|\r|\n/', $content ) : array();
		$user_agents = array();
		$allow       = array();
		$disallow    = array();
		$sitemaps    = array();
		$crawl_delay = null;

		foreach ( $lines as $line ) {
			$line = trim( $line );

			if ( '' === $line || '#' === substr( $line, 0, 1 ) || false === strpos( $line, ':' ) ) {
				continue;
			}

			list( $directive, $value ) = array_map( 'trim', explode( ':', $line, 2 ) );

			switch ( strtolower( $directive ) ) {
				case 'user-agent':
					$user_agents[] = $value;
					break;
				case 'allow':
					$allow[] = $value;
					break;
				case 'disallow':
					$disallow[] = $value;
					break;
				case 'sitemap':
					$sitemaps[] = $value;
					break;
				case 'crawl-delay':
					$crawl_delay = $value;
					break;
			}
		}

		$user_agents = array_values( array_unique( $user_agents ) );
		$sitemaps    = array_values( array_unique( $sitemaps ) );

		return array(
			'rules'      => array(
				'total'      => count( $allow ) + count( $disallow ) + count( $sitemaps ),
				'allowed'    => count( $allow ),
				'disallowed' => count( $disallow ),
				'sitemaps'   => count( $sitemaps ),
			),
			'directives' => array(
				'user_agents' => $user_agents,
				'allow'       => $allow,
				'disallow'    => $disallow,
				'sitemaps'    => $sitemaps,
				'crawl_delay' => $crawl_delay,
			),
		);
	}

	/**
	 * Live-fetches the site's real sitemap (robots.txt's declared `Sitemap:`, then
	 * `/wp-sitemap.xml`, then `/sitemap.xml`) and enumerates its child sitemaps/URLs.
	 *
	 * @param \WP_REST_Request $request Full request object.
	 * @return \WP_REST_Response
	 */
	public function get_sitemap( $request ) {
		$candidates = array_unique(
			array_filter(
				array_merge(
					$this->get_declared_sitemap_urls(),
					array( home_url( '/wp-sitemap.xml' ), home_url( '/sitemap.xml' ) )
				)
			)
		);

		$index_url = '';
		$response  = null;

		foreach ( $candidates as $candidate_url ) {
			$index_url = $candidate_url;
			$response  = wp_remote_get(
				$candidate_url,
				array(
					'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
					'sslverify' => false,
				)
			);

			if ( ! is_wp_error( $response ) && 200 === wp_remote_retrieve_response_code( $response ) ) {
				break;
			}
		}

		if ( null === $response || is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			return rest_ensure_response(
				array(
					'reachable'      => false,
					'index_url'      => $index_url,
					'valid'          => false,
					'total_sitemaps' => 0,
					'total_urls'     => 0,
					'sitemaps'       => array(),
				)
			);
		}

		$body = (string) wp_remote_retrieve_body( $response );
		$xml  = $this->parse_xml( $body );

		if ( false === $xml ) {
			return rest_ensure_response(
				array(
					'reachable'      => true,
					'index_url'      => $index_url,
					'valid'          => false,
					'total_sitemaps' => 0,
					'total_urls'     => 0,
					'sitemaps'       => array(),
				)
			);
		}

		$sitemap_nodes = $xml->xpath( '//*[local-name()="sitemap"]' ) ? $xml->xpath( '//*[local-name()="sitemap"]' ) : array();
		$url_nodes     = $xml->xpath( '//*[local-name()="url"]' ) ? $xml->xpath( '//*[local-name()="url"]' ) : array();
		$children      = array();

		if ( $sitemap_nodes ) {
			foreach ( array_slice( $sitemap_nodes, 0, self::MAX_CHILD_SITEMAPS ) as $node ) {
				$loc_nodes     = $node->xpath( './/*[local-name()="loc"]' ) ? $node->xpath( './/*[local-name()="loc"]' ) : array();
				$lastmod_nodes = $node->xpath( './/*[local-name()="lastmod"]' ) ? $node->xpath( './/*[local-name()="lastmod"]' ) : array();
				$loc           = $loc_nodes ? (string) $loc_nodes[0] : '';

				if ( '' === $loc ) {
					continue;
				}

				$url_count  = $this->count_sitemap_urls( $loc );
				$children[] = array(
					'loc'       => $loc,
					'type'      => $this->infer_sitemap_type( $loc ),
					'lastmod'   => $lastmod_nodes ? (string) $lastmod_nodes[0] : null,
					'url_count' => $url_count,
					'status'    => null === $url_count ? 'error' : 'ok',
				);
			}
		} elseif ( $url_nodes ) {
			// A flat urlset, not an index - the fetched URL IS the one real sitemap.
			$children[] = array(
				'loc'       => $index_url,
				'type'      => $this->infer_sitemap_type( $index_url ),
				'lastmod'   => null,
				'url_count' => count( $url_nodes ),
				'status'    => 'ok',
			);
		}

		$total_urls = array_sum( array_map( static fn( $child ) => $child['url_count'] ?? 0, $children ) );

		return rest_ensure_response(
			array(
				'reachable'      => true,
				'index_url'      => $index_url,
				'valid'          => true,
				'total_sitemaps' => count( $children ),
				'total_urls'     => $total_urls,
				'sitemaps'       => $children,
			)
		);
	}

	/**
	 * Real `Sitemap:` directive URL(s) this site's own `/robots.txt` declares.
	 *
	 * @return string[]
	 */
	private function get_declared_sitemap_urls(): array {
		$response = wp_remote_get(
			home_url( '/robots.txt' ),
			array(
				'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
				'sslverify' => false,
			)
		);

		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			return array();
		}

		$parsed = $this->parse_robots_txt( (string) wp_remote_retrieve_body( $response ) );

		return $parsed['directives']['sitemaps'];
	}

	/**
	 * Live-fetches a single child sitemap and counts its real `<url>` entries.
	 *
	 * @param string $url Child sitemap's own `loc`.
	 * @return int|null Null on fetch/parse failure (shown as a real "error" status).
	 */
	private function count_sitemap_urls( string $url ): ?int {
		$response = wp_remote_get(
			$url,
			array(
				'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
				'sslverify' => false,
			)
		);

		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			return null;
		}

		$xml = $this->parse_xml( (string) wp_remote_retrieve_body( $response ) );

		if ( false === $xml ) {
			return null;
		}

		$url_nodes = $xml->xpath( '//*[local-name()="url"]' );

		return $url_nodes ? count( $url_nodes ) : 0;
	}

	/**
	 * @param string $loc Child sitemap's own `loc`.
	 * @return string
	 */
	private function infer_sitemap_type( string $loc ): string {
		$path = (string) wp_parse_url( $loc, PHP_URL_PATH );

		if ( preg_match( '#wp-sitemap-posts-([a-z0-9_-]+?)(?:-\d+)?\.xml$#i', $path, $matches ) ) {
			return strtolower( $matches[1] );
		}

		if ( preg_match( '#wp-sitemap-taxonomies-([a-z0-9_-]+?)(?:-\d+)?\.xml$#i', $path, $matches ) ) {
			return strtolower( $matches[1] );
		}

		if ( false !== strpos( $path, 'wp-sitemap-users' ) ) {
			return 'author';
		}

		// Best-effort: a non-core generator's common `{type}-sitemap(-n).xml` convention.
		if ( preg_match( '#([a-z0-9_-]+)-sitemap(?:-?\d+)?\.xml$#i', $path, $matches ) ) {
			return strtolower( $matches[1] );
		}

		return 'other';
	}

	/**
	 * @param string $body Raw XML body.
	 * @return \SimpleXMLElement|false
	 */
	private function parse_xml( string $body ) {
		$previous = libxml_use_internal_errors( true );
		$xml      = simplexml_load_string( $body );
		libxml_clear_errors();
		libxml_use_internal_errors( $previous );

		return $xml;
	}
}
