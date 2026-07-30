# VuloPilot — WooCommerce Intelligence

Companion to [`DATABASE.md`](DATABASE.md), [`SCANNERS.md`](SCANNERS.md), and
[`ACCESSIBILITY-MODULE.md`](ACCESSIBILITY-MODULE.md). Same "audit what
already exists first" shape as that file: Free already had a
`WooCommerceScanner` (one check, checkout page) plus 11 `Product*`
scanners (WooCommerce Optimization) before this pass, and `vulopilot-pro`'s
`WooCommerceAi` module already had 9 AI product-content actions plus a
bulk-optimize endpoint — 2 of this pass's 6 Pro bullets were therefore
already fully built, not missing.

## Audit: what already existed

| Spec item | Status before this pass |
|---|---|
| Store Health (Free) | **Partially built** — `WooCommerceScanner` only checked the checkout page. No check for cart/My Account pages, store base location, or an enabled payment gateway. |
| Missing Images (Free) | Already fully built — `ProductMissingImagesScanner`. Untouched. |
| Missing Attributes (Free) | Already fully built — `ProductAttributesScanner` (variable products with zero attributes — a variable product genuinely cannot generate variations without them; simple products don't need them). Untouched. |
| Product SEO (Free) | **Did not exist at all** — `SeoScanner`/`MetaDescriptionScanner` both explicitly scope to `post`/`page` only, never `product`. |
| Duplicate Products (Free) | Already fully built — `ProductDuplicateScanner`. Untouched. |
| AI Product Content (Pro) | Already fully built — `WooCommerceAi` module's 9 actions (title, short/long description, meta description, schema, FAQ, cross-sell, upsell, bundle suggestions). |
| Inventory Intelligence (Pro) | **Did not exist at all** — Free's own `ProductInventoryHealthScanner` only flags a *current* data inconsistency (negative/null quantity, or "in stock" with zero quantity); nothing projected forward from sales activity. |
| Store Trends (Pro) | **Did not exist at all** — no snapshot table or trend data for revenue/orders anywhere in either plugin. |
| Automation (Pro) | **Partially built** — the Automation module's trigger registry already had `ProductCreatedTrigger`/`ProductUpdatedTrigger`/`OrderCompletedTrigger`, but nothing fired specifically on a product crossing into low stock. |
| Bulk AI (Pro) | Already fully built — `WooCommerceAi\BulkOptimizeRest` (`POST /woocommerce-ai/bulk-optimize`), generic across all 9 actions. |
| Revenue Insights (Pro) | **Did not exist at all** — no live revenue computation anywhere. |

## Free — one new scanner, one extended scanner

### `ProductSeoScanner` — "Product SEO"

Lives in `classes/Scanners/Basic/`, registered in
`ScannerRegistry::get_default_scanner_classes()` alongside the 11
pre-existing `Product*` scanners under the same `woocommerce` category
string, gated only by the existing whole-category
`enable_woocommerce_scanning` kill switch (no new per-scanner toggle —
none of the other 11 `Product*` scanners has one either, per
`Settings/Scanning/WooCommerce.ts`'s own single-toggle shape).

Checks product title length only (the same 10-60 character thresholds
`SeoScanner` already uses for posts/pages), **not** a missing-meta-
description check — a product's short description (`post_excerpt`) is
already monitored by `ProductMissingShortDescriptionScanner` under its
own product-page-UX framing; re-checking that same field here under an
"SEO" label would be a duplicate finding for the same underlying gap.

### `WooCommerceScanner` — "Store Health", extended to four more checks

The original single check (a missing/unpublished checkout page) is
joined by four more, bundled into the same scanner rather than four new
ones (same "several related hardening checks, one scanner" pattern
[`SECURITY-MODULE.md`](SECURITY-MODULE.md)'s `BasicVulnerabilitiesScanner`
already establishes for a different category):

- A missing/unpublished cart page (`Severity::HIGH`).
- A missing/unpublished My Account page (`Severity::MEDIUM`).
- No store base location configured (`woocommerce_default_country` empty
  — `Severity::HIGH`; every location-dependent feature, tax/shipping/
  currency, has nothing to key off).
- No enabled payment gateway (`Severity::CRITICAL` — customers can reach
  checkout but cannot actually pay).

"Missing Images"/"Missing Attributes"/"Duplicate Products" (this pass's
other three Free bullets) needed no new code — see the audit table above.

### Schema addition: `vulopilot_store_trends_snapshots`

A new table + `Repositories` (Pro-side `StoreTrendsSnapshotRepository`),
same "Free owns the schema/migration, Pro owns the concrete repository
and population logic" split `vulopilot_accessibility_snapshots`/
`vulopilot_geo_visibility_history` already establish. One row per
**finished** calendar day (`snapshot_date` UNIQUE, upserted) — see
"Store Trends" below for why yesterday, not today. Empty and inert
without Pro's `WooCommerceIntelligence` module active. See `DATABASE.md`
for the full column list.

### Setting addition: `inventory_stockout_threshold_days`

Free-owned, Pro-consumed (default `7`) — same "setting lives here, only
meaningfully acted on by a Pro module" split
`accessibility_audit_frequency`/`integrity_monitoring_max_files` already
establish. Read by `InventoryIntelligenceScanner` as the "projected to
run out within this many days" threshold.

## Pro (`modules/WooCommerceIntelligence/`, brand-new module)

### Inventory Intelligence — sales-velocity stockout projection

`InventoryIntelligenceScanner` (`inventory-intelligence`, category
`woocommerce`) sums real completed/processing order quantities over the
last 30 days per product to compute a daily sales velocity, then
projects `current_stock / velocity` days remaining. Flags only products
currently in stock (a product already at zero/negative stock is left to
Free's own `ProductInventoryHealthScanner`, not double-reported) with
non-zero recent sales velocity and a projection under
`inventory_stockout_threshold_days`. Deliberately not mapped in
OneClickFix's `ScannerFixMap` — there's no fix for "you're about to sell
out," safe or otherwise.

### Store Trends — a daily revenue/order rollup

`StoreTrendsSnapshotBuilder` self-registers its own daily wp-cron tick
(own hook, always `'daily'` — no configurable frequency setting the way
`SecurityScanScheduler`/`AccessibilityAuditScheduler` have, since this
isn't re-running a scanner) that sums real WooCommerce order totals for
**yesterday** — a complete day whose totals never change again — and
upserts via `StoreTrendsSnapshotRepository::upsert_for_date()`. Exposed
via `StoreTrendsRest` (`GET /store-trends-history`), same "plain array,
not paginated" shape `AccessibilityHistoryRest` already uses.

### Revenue Insights — a live current-state breakdown

`RevenueInsightsRest` (`GET /revenue-insights`) computes today/7-day/
30-day revenue and the top 5 products by revenue **directly from real
orders on each request** — distinct from Store Trends' historical daily
snapshots, same "current-state dashboard vs. historical trend" split
[`ACCESSIBILITY-MODULE.md`](ACCESSIBILITY-MODULE.md)'s dashboard-card/
history-chart pair already establishes. Orders are fetched once for the
widest (30-day) window and bucketed by date in PHP, not queried three
times.

### Automation — a new WooCommerce-specific trigger

`LowStockTrigger` (`low_stock`), added to the existing Automation
module's own `TriggerRegistry` (not a new module — it belongs there
structurally), fires on core's own `woocommerce_low_stock` action —
reusing WooCommerce's own configured low-stock threshold logic rather
than reinventing a second one. Distinct from the pre-existing
`ProductUpdatedTrigger` (fires on any product save): this only fires on
the specific "just crossed into low stock" moment.

### AI Product Content / Bulk AI — already fully built, untouched

`WooCommerceAi`'s 9 actions and `BulkOptimizeRest` needed no changes this
pass — see the audit table above.

### React UI — one bundled panel, additive on Free's WooCommerce.tsx

`WooCommerceIntelligencePanel.tsx` bundles `RevenueInsightsCard.tsx`,
`StoreTrendsChart.tsx`, and `InventoryIntelligenceCard.tsx` behind a
single new filter slot, `vulopilot_woocommerce_intelligence_panel` — same
"one slot, one module's whole feature set" shape
`vulopilot_woocommerce_ai_panel`/`WooCommerceAi\BulkOptimizePanel` already
establish on this exact page, rather than three separate slots. Shows the
same locked-teaser-card-with-Pro-popup pattern
(`WooCommerceIntelligenceLockedCard`) that page already uses for the AI
panel when the module isn't active. `InventoryIntelligenceCard.tsx` calls
Free's own generic `GET /findings` endpoint directly (scoped via
`scanner_id=inventory-intelligence`) rather than a dedicated PHP
endpoint — no new REST surface was needed for it.

## What's not here yet

- **A configurable Store Trends cadence.** Always a daily rollup — see
  that section above for why no setting was added.
- **Variation-level sales velocity.** `InventoryIntelligenceScanner`
  aggregates order-item quantities by parent/simple product id, matching
  how Free's own `ProductPricingScanner` also treats variable products'
  variation-level data as out of scope for this codebase's scanners.
- **Alerting on Revenue Insights/Store Trends** (e.g. "revenue dropped
  below X"). `SecurityMonitoring`/`AccessibilityAudits` built alerting
  only where that phase's own spec named it; this phase's spec didn't.
