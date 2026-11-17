<?php
/**
 * Server-side render for the `vulopilot/table-of-contents` block.
 *
 * @package VuloPilot
 * @var array $attributes Real block attributes.
 */

defined( 'ABSPATH' ) || exit;

echo wp_kses_post( \VuloPilot\Content\TableOfContentsRenderer::render( $attributes, get_the_ID() ) );
