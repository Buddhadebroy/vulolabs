# VuloPilot - Knowledge Graph module

## Free - `KnowledgeGraph\EntityExtractor`

Six entity types, each backed by a real, deterministic data source:

| Type | Real source |
|---|---|
| People | WP users who authored at least one published post/page (`get_userdata()` per distinct `post_author`) |
| Products | Real store products (`wc_get_products()`, `class_exists('WooCommerce')` guard - same pattern `ProductMissingCategoriesScanner` already uses), `null` when the store platform isn't active |
| Services | Owner-curated: newline-separated page URLs/ids (new `entity_service_pages` setting), each resolved to a real published page |
| Locations | Owner-curated: newline-separated `Name \| Address` lines (new `entity_business_locations` setting) |
| Categories | Real taxonomy terms currently attached to at least one published post/product (`get_terms(['taxonomy' => [...], 'hide_empty' => true])`) |

Services/Locations are owner-curated rather than auto-derived because
there is no existing Service/LocalBusiness concept anywhere in this
codebase to read them from automatically - same "Free owns the setting,
deterministic once provided" posture `geo_competitor_urls` already
established. Nothing is fabricated: both are empty arrays until
configured, and `products` is `null` (not `0`) when the store platform isn't
active, matching `Dashboard`'s own `category_scores.woocommerce`
convention.

Gated on the `knowledge-graph` module being active
(`VuloPilot()->modules->get_active_modules()`) - this service has no
scanner/finding of its own to gate through `ScannerRegistry`'s usual
category mechanism, so it checks module state directly.
`modules/KnowledgeGraph/Module.php`'s own job is narrow but real: bust
`EntityExtractor`'s 1-hour transient cache on the WordPress hooks that
would actually change its output (`save_post`/`deleted_post`/
`created_term`/`edited_term`/`delete_term`).

## Tests

`test-entity-extractor.php` (Free) - real unit tests over
`EntityExtractor`'s own deterministic `extract_*()`/`get_homepage_publisher()`
methods (invoked via Reflection, same posture
`test-about-page-analysis-scanner.php` already documents), stubbing only
the plain WordPress functions each one touches. `extract_products()`'s
"store platform active" branch isn't covered (would need a real/mocked
`WC_Product` graph this test suite has no precedent for); its "store platform
inactive" branch is covered for free since the `WooCommerce` class
genuinely doesn't exist in this Brain\Monkey-only bootstrap.

## What's not here yet

- **A shared PHP/TS source of truth for relationship-type display
  labels** - `authored_content_for`/`offered_by`/`located_at`/
  `categorized_as` are plain strings on both sides today, same kind of
  manual-sync gap `AI-CRAWLER-ANALYTICS-MODULE.md`'s own bot-signature
  list already documents.
- **A "mentions" relationship type** (post content referencing an entity
  by name) - deliberately out of scope this phase; see the audit section
  above for why re-scanning content for name mentions was rejected as too
  weak a signal to persist as a real graph edge.
- **A mutating Entity Automation action** - this phase's trigger only
  ever fires into the existing action library; no new
  `AIActionInterface`/`ActionInterface` action was added.
