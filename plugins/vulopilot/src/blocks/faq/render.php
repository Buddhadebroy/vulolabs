<?php
/**
 * Server-side render for the `vulopilot/faq` block.
 *
 * Deliberately declaration-free — see table-of-contents/render.php's own
 * comment for why. All real logic (including the real FAQPage JSON-LD)
 * lives in VuloPilot\Services\Blocks\FaqRenderer.
 *
 * @package VuloPilot
 * @var array $attributes Real block attributes.
 */

defined( 'ABSPATH' ) || exit;

echo \VuloPilot\Services\Blocks\FaqRenderer::render( $attributes ); // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- escaped internally by FaqRenderer.
