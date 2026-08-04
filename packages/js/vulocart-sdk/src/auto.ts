import { init } from './index';

/**
 * The `<script src="vulocart-sdk.js"></script>` entry point — this is
 * what makes "developers should only need a script tag" literally true.
 * `document.currentScript.src` is this file's OWN url, and because this
 * bundle is served BY the merchant's own WordPress site (the plugin's own
 * `assets/js/vulocart-sdk.js`, wired up in Sdk's PHP-side loader), its
 * origin already tells us which store to talk to — zero data attributes,
 * zero inline config block, nothing the embedding page has to supply.
 * `import "@vulocart/sdk"` consumers (index.ts) don't get this trick —
 * there's no `<script>` tag for them, they pass `storeUrl` explicitly.
 *
 * This holds regardless of which domain the EMBEDDING page is on — a
 * `<script src="https://mystore.com/…/vulocart-sdk.js">` tag's own `src`
 * is always `https://mystore.com/…`, whether the page including it is
 * `mystore.com` itself or an unrelated third-party domain, which is
 * exactly the cross-domain case Phase 4 exists for. `document.currentScript`
 * is reliable here because this bundle builds as a classic (non-module)
 * script (`build.mjs`'s own `format: 'iife'`) — it's ES module scripts
 * where `currentScript` support is spec-inconsistent, not classic ones.
 *
 * Falls back to `location.origin` only if `document.currentScript` isn't
 * available at all (e.g. a `document.write`'d script tag, or this file
 * re-bundled into something else's build pipeline) — wrong in a genuine
 * cross-origin embed if that fallback path ever triggers, but better than
 * refusing to boot outright.
 */
const scriptSrc = ( document.currentScript as HTMLScriptElement | null )?.src;
const storeUrl = scriptSrc ? new URL( scriptSrc ).origin : window.location.origin;

init( { storeUrl } );
