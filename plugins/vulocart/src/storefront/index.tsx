/**
 * Free's own storefront bootstrap — the Checkout Engine's registry
 * (`blocks/checkout-engine/registry.ts`) and mount API
 * (`blocks/checkout-engine/mount.tsx`) are otherwise only ever bundled
 * into the `vulocart/checkout` BLOCK's own view script
 * (`blocks/checkout/Checkout.tsx` imports `mount.tsx`), which WordPress
 * only loads on a page that actually PLACES that block — fine for the
 * block itself, but wrong for vulocart-pro's Popup/Embedded delivery
 * modes, whose entire point is working on a page that has NO checkout
 * block on it at all (a "Buy Now" trigger on a shop listing, say). This
 * tiny, always-cheap-to-load entry (Classes/Block.php's own
 * `enqueue_storefront_bootstrap()` decides when, gated on
 * `enable_cart_checkout` — no page-content check needed, this has no
 * meaningful cost) is what makes `window.vulocartCheckoutEngine` exist
 * everywhere the Checkout Engine setting says checkout should work at
 * all, independent of which page happens to have the block.
 */
import '../blocks/checkout-engine/mount';
