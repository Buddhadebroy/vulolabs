<?php
/**
 * Cors class file.
 *
 * @package VuloCart
 */

namespace VuloCart\RestAPI;

defined( 'ABSPATH' ) || exit;

/**
 * VuloCart Cors class.
 *
 * Phase 4 (Embedded Commerce) exists specifically so `@vulocart/sdk` can
 * run on a domain that is NOT this WordPress site — a merchant's landing
 * page, a separate React/Next.js app, plain HTML anywhere. Every other
 * REST caller in this codebase so far (the Gutenberg checkout block, the
 * wp-admin SPA) has been same-origin, so nothing before this class ever
 * needed to touch CORS. Scoped to VuloCart's OWN `vulocart/v1` namespace
 * only — this does not open up core WordPress REST routes or
 * `vulopilot/v1` (that plugin has no embeddable SDK and no reason to be
 * cross-origin).
 *
 * Origin policy is wide open (`Access-Control-Allow-Origin: *`) rather
 * than a merchant-configured allowlist — a deliberate choice matching the
 * SDK's own "just drop a script tag anywhere" promise: every route this
 * reaches is already a route this codebase treats as public/guest-safe
 * (Cart/Order/Checkout's own docblocks: cart-token or order access-token
 * authentication, never a nonce, so cross-origin doesn't add a NEW trust
 * boundary here the way it would for an admin-nonce-authenticated route).
 *
 * @class       Cors class
 * @version     1.0.0
 * @author      VuloLabs
 */
class Cors {

    /**
     * Cors constructor.
     */
    public function __construct() {
        // Priority 15 — after WP core's own `rest_send_cors_headers`
        // (default priority 10, hooked in `rest_api_init`), so this
        // plugin's own `Access-Control-Allow-Origin: *` overwrites core's
        // more restrictive default rather than being overwritten by it
        // (repeated `header()` calls for the same header name replace the
        // previous value by default).
        add_filter( 'rest_pre_serve_request', array( $this, 'add_cors_headers' ), 15, 3 );
    }

    /**
     * Adds permissive CORS headers to every `vulocart/v1` REST response —
     * including OPTIONS preflight requests, which WordPress's REST server
     * already routes through this same filter for any registered route.
     *
     * @param bool             $served  Whether the request has already been served.
     * @param mixed            $result  Response object/error being served.
     * @param \WP_REST_Request $request Full request object.
     * @return bool Unmodified — this method only has a side effect (headers), it doesn't change whether/how the request is served.
     */
    public function add_cors_headers( $served, $result, $request ) {
        if ( 0 !== strpos( $request->get_route(), '/' . VuloCart()->rest_namespace ) ) {
            return $served;
        }

        header( 'Access-Control-Allow-Origin: *' );
        header( 'Access-Control-Allow-Methods: GET, POST, PATCH, PUT, DELETE, OPTIONS' );
        header( 'Access-Control-Allow-Headers: Content-Type, X-Cart-Token' );
        header( 'Access-Control-Max-Age: 600' );

        // WP core's own default CORS handling (`rest_send_cors_headers`,
        // already run at this point — see this method's own docblock on
        // hook priority) sends `Access-Control-Allow-Credentials: true`.
        // Wildcard origin + credentials:true is a combination browsers
        // reject outright, and nothing calling this API needs credentialed
        // (cookie-based) requests anyway — every route the SDK touches
        // authenticates via `X-Cart-Token`/order access tokens, never a
        // session cookie — so this explicitly overrides it to false rather
        // than leaving an invalid, inconsistent pair of headers in place.
        header( 'Access-Control-Allow-Credentials: false' );

        return $served;
    }
}
