# VuloPilot - WooCommerce Intelligence

## Audit: what already existed

| Spec item | Status before this pass |
|---|---|
| Store Health (Free) | **Partially built** - `WooCommerceScanner` only checked the checkout page. No check for cart/My Account pages, store base location, or an enabled payment gateway. |
| Missing Images (Free) | Already fully built - `ProductMissingImagesScanner`. Untouched. |
| Missing Attributes (Free) | Already fully built - `ProductAttributesScanner` (variable products with zero attributes - a variable product genuinely cannot generate variations without them; simple products don't need them). Untouched. |
| Product SEO (Free) | **Did not exist at all** - `SeoScanner`/`MetaDescriptionScanner` both explicitly scope to `post`/`page` only, never `product`. |
| Duplicate Products (Free) | Already fully built - `ProductDuplicateScanner`. Untouched. |

## What's not here yet

- **A configurable Store Trends cadence.** Always a daily rollup - see
  that section above for why no setting was added.
- **Variation-level sales velocity.** `InventoryIntelligenceScanner`
  aggregates order-item quantities by parent/simple product id, matching
  how Free's own `ProductPricingScanner` also treats variable products'
  variation-level data as out of scope for this codebase's scanners.
- **Alerting on Revenue Insights/Store Trends** (e.g. "revenue dropped
  below X"). `SecurityMonitoring`/`AccessibilityAudits` built alerting
  only where that phase's own spec named it; this phase's spec didn't.
