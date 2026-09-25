# Knowledge Graph (`modules/KnowledgeGraph`)

Builds a picture of the entities on the site - organization, people, products, services, locations and categories - from data WordPress already has. User view: [../user/AI-VISIBILITY.md](../user/AI-VISIBILITY.md#business-identity--schema-what-machines-learn-about-you).

## How it works

`EntityExtractor::extract_all()` reads existing WordPress data. There is no text mining or NLP:

| Entity | Source |
|---|---|
| Organization / business name | Business Information settings, site identity and detected sources (`get_business_name_sources()`) |
| People | Authors of published posts |
| Products | WooCommerce products, when active (`get_product_schema_details()` adds their schema status) |
| Services, Locations | Business Information settings |
| Categories | Post categories that have published content |

It also produces suggested relationships between the business and its services, products and categories (translated strings such as "%1$s offers %2$s").

## Caching

Results are cached in a transient for one hour (`CACHE_KEY`, `CACHE_TTL_SECONDS`). `KnowledgeGraph\Module` clears it when the data can change: `save_post`, `deleted_post`, `created_term`, `edited_term`, `delete_term`, and `update_option_vulopilot_settings` when a Business Information field actually changed. Settings -> Developer Tools -> Clear cache also clears it.

## Module gating

The extractor checks that the `knowledge-graph` module is active; a deactivated module returns no entities.

## REST

`GET /entities`, `/entities/business-name-sources`, `/entities/product-details` (`Rest\EntityExtraction`).

## Settings

| Setting key | Default |
|---|---|
| `entity_business_type` | `''` |
| `entity_service_pages` | `''` |
| `entity_business_locations` | `''` |

## Class reference

| Class | File | What it does |
|---|---|---|
| `EntityExtractor` | `modules/KnowledgeGraph/EntityExtractor.php` | - |
| `Module` | `modules/KnowledgeGraph/Module.php` | VuloPilot KnowledgeGraph module. |
| `EntityExtraction` | `modules/KnowledgeGraph/Rest/EntityExtraction.php` | `GET /entities` backs src/pages/KnowledgeGraph/KnowledgeGraph.tsx - Services\EntityExtractor's own docblock has the full extraction design. |

Hooks and routes registered by these classes:

- `Module` - hooks: `created_term`, `delete_term`, `deleted_post`, `edited_term`, `save_post`, `update_option_`
- `EntityExtraction` - ; routes: `/entities`, `/entities/business-name-sources`, `/entities/product-details`
