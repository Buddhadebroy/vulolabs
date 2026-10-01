<?php
namespace VuloPilot\SeoVisibility;

use VuloPilot\SeoVisibility\CrawlerVisitRepository;
use VuloPilot\Utill;
use VuloPilot\Utill\ServerRequest;

defined( 'ABSPATH' ) || exit;

/**
 * Detects known AI crawlers by User-Agent and logs each visit (bot name, user agent and
 * URL only - no IP address or visitor data).
 *
 * @class       CrawlerTrafficLogger class
 * @version     1.0.0
 * @author      VuloLabs
 */
class CrawlerTrafficLogger {

	private const CLEANUP_HOOK = 'vulopilot_crawler_log_cleanup';

	/**
	 * User-Agent substring => display name.
	 *
	 * @var array<string, string>
	 */
	private const BOT_SIGNATURES = array(
		'GPTBot'                => 'GPTBot (OpenAI)',
		'ChatGPT-User'          => 'ChatGPT-User (OpenAI)',
		'ClaudeBot'             => 'ClaudeBot (Anthropic)',
		'anthropic-ai'          => 'anthropic-ai (Anthropic)',
		'PerplexityBot'         => 'PerplexityBot (Perplexity)',
		'Bytespider'            => 'Bytespider (ByteDance)',
		'CCBot'                 => 'CCBot (Common Crawl)',
		'Google-CloudVertexBot' => 'Google-CloudVertexBot (Google AI training)',
		'Amazonbot'             => 'Amazonbot (Amazon)',
	);

	/**
	 * CrawlerTrafficLogger constructor.
	 */
	public function __construct() {
		add_action( 'template_redirect', array( $this, 'maybe_log' ) );
		add_action( 'init', array( $this, 'ensure_cleanup_scheduled' ) );
		add_action( self::CLEANUP_HOOK, array( $this, 'run_cleanup' ) );
	}

	/**
	 * @return void
	 */
	public function maybe_log(): void {
		$settings = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );

		if ( empty( $settings['enable_crawler_tracking'] ) ) {
			return;
		}

		$user_agent = ServerRequest::get( 'HTTP_USER_AGENT' );

		if ( '' === $user_agent ) {
			return;
		}

		foreach ( self::get_bot_signatures() as $signature => $bot_name ) {
			if ( false === strpos( $user_agent, $signature ) ) {
				continue;
			}

			$requested_url = ServerRequest::get( 'REQUEST_URI' );

			( new CrawlerVisitRepository() )->log( $bot_name, $user_agent, $requested_url, is_404() );
			return;
		}
	}

	/**
	 * @return array<string, string>
	 */
	public static function get_bot_signatures(): array {
		return apply_filters( 'vulopilot_crawler_bot_signatures', self::BOT_SIGNATURES );
	}

	/**
	 * @return void
	 */
	public function ensure_cleanup_scheduled(): void {
		if ( ! wp_next_scheduled( self::CLEANUP_HOOK ) ) {
			wp_schedule_event( time(), 'daily', self::CLEANUP_HOOK );
		}
	}

	/**
	 * @return void
	 */
	public function run_cleanup(): void {
		$settings       = wp_parse_args( get_option( Utill::VULOPILOT_SETTINGS_KEY, array() ), Utill::VULOPILOT_SETTINGS_DEFAULTS );
		$saved_days     = (int) ( $settings['log_retention'] ?? 30 );
		$retention_days = (int) apply_filters( 'vulopilot_crawler_log_retention_days', $saved_days ? $saved_days : 30 );

		if ( $retention_days <= 0 ) {
			return;
		}

		( new CrawlerVisitRepository() )->delete_older_than( $retention_days );
	}
}
