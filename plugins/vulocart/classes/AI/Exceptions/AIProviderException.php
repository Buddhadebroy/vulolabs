<?php
/**
 * AIProviderException file.
 *
 * @package VuloCart
 */

namespace VuloCart\AI\Exceptions;

defined( 'ABSPATH' ) || exit;

/**
 * Thrown by an AIProviderInterface adapter when a call fails — no
 * provider-configured, an HTTP/network failure, or a provider that doesn't
 * support the requested capability (image generation/embeddings).
 *
 * @class       AIProviderException class
 * @version     1.0.0
 * @author      VuloLabs
 */
class AIProviderException extends \RuntimeException {}
