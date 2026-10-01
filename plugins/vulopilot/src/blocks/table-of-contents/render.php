<?php
/**
 * Server-side render for the `vulopilot/table-of-contents` block.
 *
 * Declaration-free: WP loads this file via `require`, not `require_once`, so a top-level function or
 * class would fatal if the block appears twice on a page. All logic lives in
 * VuloPilot\Content\TableOfContentsRenderer.
 *
 * @package VuloPilot
 * @var array $attributes Real block attributes.
 */

defined( 'ABSPATH' ) || exit;

echo wp_kses_post( \VuloPilot\Content\TableOfContentsRenderer::render( $attributes, get_the_ID() ) );
