# Brand Visibility (`modules/BrandVisibility`)

Trust and authority signals that make a brand look reliable to people and AI. User view: [../user/AI-VISIBILITY.md](../user/AI-VISIBILITY.md#brand-visibility-look-trustworthy).

## Scanners

`BrandVisibility\Module` adds three scanners through `vulopilot_scanner_sources`:

| Scanner id | Checks |
|---|---|
| `organization-schema` | Organization structured data on the site |
| `author-schema` | Person/author structured data for authors |
| `about-page-analysis` | An About-style page exists and has at least `brand_about_page_min_words` words (default 80) |

It also reuses existing `geo` scanners (`geo-trust-signals`, `geo-eeat-signals`, `geo-author-info`, `geo-entity-naming-consistency`) rather than duplicating them.

## Scores

`GET /brand-intelligence/score` (`Rest\BrandIntelligence`) is deterministic and uses no AI. It computes:

- **Trust** and **Authority** sub-scores from severity counts of their own scanner-id lists, using the same weighting as the dashboard category scores.
- **Brand score**: the combination of Trust and Authority.
- **Entity score**: also returned, but shown in the Knowledge Graph area, not in the Brand card.

## Notifications

A brand score drop alert (Settings -> Notifications -> Visibility Alerts) fires when the score falls by the configured amount.

## Class reference

| Class | File | What it does |
|---|---|---|
| `Module` | `modules/BrandVisibility/Module.php` | VuloPilot BrandVisibility module. |
| `BrandIntelligence` | `modules/BrandVisibility/Rest/BrandIntelligence.php` | `GET /brand-intelligence/score` - Brand Intelligence's composite, deterministic scores (no AI, no cost): an overall "Brand Score" plus three named sub-scores (Trust, Authority, Entity), each scoped to its own `scanner_id` list via |
| `AboutPageAnalysisScanner` | `modules/BrandVisibility/Scanners/AboutPageAnalysisScanner.php` | - |
| `AuthorSchemaScanner` | `modules/BrandVisibility/Scanners/AuthorSchemaScanner.php` | - |
| `OrganizationSchemaScanner` | `modules/BrandVisibility/Scanners/OrganizationSchemaScanner.php` | - |

Hooks and routes registered by these classes:

- `Module` - hooks: `vulopilot_scanner_sources`
- `BrandIntelligence` - ; routes: `/brand-intelligence/score`
