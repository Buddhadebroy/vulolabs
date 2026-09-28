<?php
namespace VuloPilot\SeoVisibility\Rest;

defined( 'ABSPATH' ) || exit;

/**
 * `GET /robots-sitemap/robots` and `GET /robots-sitemap/sitemap`.
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
	 * The Robots.txt Analysis card's own "Edit" action - saves a real.
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
	 * Live-fetches this site's own sitemap index - real `/wp-sitemap.xml` (WordPress
	 * core's own native sitemap since 5.5) first.
	 *
	 * @param \WP_REST_Request $request Full request object.
	 * @return \WP_REST_Response
	 */
	public function get_sitemap( $request ) {
		$index_url = home_url( '/wp-sitemap.xml' );
		$response  = wp_remote_get(
			$index_url,
			array(
				'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
				'sslverify' => false,
			)
		);

		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			$index_url = home_url( '/sitemap.xml' );
			$response  = wp_remote_get(
				$index_url,
				array(
					'timeout'   => self::REQUEST_TIMEOUT_SECONDS,
					'sslverify' => false,
				)
			);
		}

		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
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
