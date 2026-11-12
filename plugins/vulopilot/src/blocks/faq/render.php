<?php
/**
 * Server-side render for the `vulopilot/faq` block.
 *
 * @package VuloPilot
 * @var array $attributes Real block attributes.
 */

defined( 'ABSPATH' ) || exit;

echo wp_kses_post( \VuloPilot\Content\FaqRenderer::render( $attributes ) );
\VuloPilot\Content\FaqRenderer::print_schema( $attributes );
