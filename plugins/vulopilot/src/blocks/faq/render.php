<?php
/**
 * Server-side render for the `vulopilot/faq` block.
 *
 * Declaration-free (see table-of-contents/render.php). All logic, including the FAQPage JSON-LD, lives
 * in VuloPilot\Content\FaqRenderer.
 *
 * @package VuloPilot
 * @var array $attributes Real block attributes.
 */

defined( 'ABSPATH' ) || exit;

echo wp_kses_post( \VuloPilot\Content\FaqRenderer::render( $attributes ) );
\VuloPilot\Content\FaqRenderer::print_schema( $attributes );
