<?php
/**
 * Cors class file.
 *
 * @package VuloCart
 */

namespace VuloCart\RestAPI;

defined( 'ABSPATH' ) || exit;

/**
 * Adds CORS headers to the plugin's own REST namespace (`vulocart/v1`) so `@vulocart/sdk` can run on a domain other
 * than this WordPress site (a landing page, a separate app, plain HTML). Core WordPress routes are not affected.
 *
 * Any origin is allowed (`Access-Control-Allow-Origin: *`). The routes the SDK uses are public and guest-safe: they
 * are authenticated by a cart token or an order access token, never by a nonce, so cross-origin calls add no new
 * trust boundary.
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
        // Priority 15 - after WP core's own `rest_send_cors_headers`
        // (default priority 10, hooked in `rest_api_init`), so this
        // plugin's own `Access-Control-Allow-Origin: *` overwrites core's
        // more restrictive default rather than being overwritten by it
        // (repeated `header()` calls for the same header name replace the
        // previous value by default).
        add_filter( 'rest_pre_serve_request', array( $this, 'add_cors_headers' ), 15, 3 );
    }

    /**
     * Adds permissive CORS headers to every `vulocart/v1` REST response -
     * including OPTIONS preflight requests, which WordPress's REST server
     * already routes through this same filter for any registered route.
     *
     * @param bool             $served  Whether the request has already been served.
     * @param mixed            $result  Response object/error being served.
     * @param \WP_REST_Request $request Full request object.
     * @return bool Unmodified - this method only has a side effect (headers), it doesn't change whether/how the request is served.
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
        // already run at this point - see this method's own docblock on
        // hook priority) sends `Access-Control-Allow-Credentials: true`.
        // Wildcard origin + credentials:true is a combination browsers
        // reject outright, and nothing calling this API needs credentialed
        // (cookie-based) requests anyway - every route the SDK touches
        // authenticates via `X-Cart-Token`/order access tokens, never a
        // session cookie - so this explicitly overrides it to false rather
        // than leaving an invalid, inconsistent pair of headers in place.
        header( 'Access-Control-Allow-Credentials: false' );

        return $served;
    }
}
