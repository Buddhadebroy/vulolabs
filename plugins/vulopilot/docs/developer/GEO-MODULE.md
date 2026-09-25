# GEO Module (`modules/GeoAnalysis`)

GEO (Generative Engine Optimization) checks how easy a site's content is for AI systems to read and reuse. The user view is [../user/AI-VISIBILITY.md](../user/AI-VISIBILITY.md).

## Pieces

| Piece | Role |
|---|---|
| Nine GEO scanners (`modules/GeoAnalysis/Scanners`) plus `AeoSchemaScanner` | Category `geo` findings. They are part of the core scanner list, so they always run: there is no category-wide switch |
| `GeoAnalyzer` | Scores one post with AI: `analyze( $post_id ): GeoScore`, `get_stored_score( $post_id )` |
| `LlmsTxtGenerator` | Serves `/llms.txt` |
| `Rest\Geo`, `Rest\GeoAnalysis`, `Rest\LlmsTxt` | Score, per-page data, regeneration |
| `Module` | Regenerates llms.txt when a post is published |

## Scanners

See [SCANNERS](SCANNERS.md#scanners-registered-by-the-core) (category `geo`). The admin groups them into: AI Summary, Question Coverage, Evidence & Citations, AI-Readable Structure, Entity Clarity, Content Freshness and Other signals (`src/pages/GEO/GeoTab.tsx`, `GeoScoreSection.tsx`).

## GEO score

`GET /geo/score` is deterministic and free of AI cost. It is computed from finding severity counts per signal scanner group with the same weighting the dashboard uses for category scores. `GET /geo/progress` returns a daily score trend over 7, 30 or 90 days.

## AI analysis of one post

`GeoAnalyzer::analyze()` is a plain orchestrator, not an AI action: nothing is modified, so there is no approve/rollback lifecycle. It uses `AiRequestSender` ([AI-ARCHITECTURE](AI-ARCHITECTURE.md)) and stores its findings through `FindingRepository`, so results appear like any other finding.

## llms.txt

- `LlmsTxtGenerator` registers a rewrite rule and query var for `/llms.txt`. `maybe_serve()` outputs the file on `template_redirect` when the setting `enable_llms_txt` is on. `generate()` builds a Markdown index from live published content on each request; `write_file()` can also write a physical file.
- On `save_post` (published posts only, not revisions or autosaves) `Module::maybe_regenerate_llms_txt()` regenerates the file when both `enable_llms_txt` and `llms_auto_regen` are on, and stores the text in the `llms_txt_content` setting.
- The route stays available even if the module is off, so a live `/llms.txt` never disappears. Only the auto-regeneration depends on the module.
- REST `POST /llms-txt/regenerate` rebuilds it on demand.

## Settings

| Setting key | Default |
|---|---|
| `enable_llms_txt` | `array( 'enable_llms_txt' )` |
| `llms_txt_content` | `''` |
| `llms_auto_regen` | `array( 'llms_auto_regen' )` |
| `llms_include_types` | `array( 'pages', 'posts' )` |
| `geo_competitor_urls` | `array()` |

## Class reference

| Class | File | What it does |
|---|---|---|
| `GeoAnalyzer` | `modules/GeoAnalysis/GeoAnalyzer.php` | - |
| `LlmsTxtGenerator` | `modules/GeoAnalysis/LlmsTxtGenerator.php` | - |
| `Module` | `modules/GeoAnalysis/Module.php` | VuloPilot GeoAnalysis module. |
| `Geo` | `modules/GeoAnalysis/Rest/Geo.php` | `GET /geo/score` - a real, deterministic GEO Score (no AI, no cost) for the GEO tab's own "GEO Score" card (SEO & Visibility → GEO). |
| `GeoAnalysis` | `modules/GeoAnalysis/Rest/GeoAnalysis.php` | - |
| `LlmsTxt` | `modules/GeoAnalysis/Rest/LlmsTxt.php` | - |
| `GeoAuthorInfoScanner` | `modules/GeoAnalysis/Scanners/GeoAuthorInfoScanner.php` | Flags published posts/pages whose author has no bio set (`get_the_author_meta('description')`). |
| `GeoChunkingScanner` | `modules/GeoAnalysis/Scanners/GeoChunkingScanner.php` | Flags published posts/pages containing a single paragraph over MAX_PARAGRAPH_WORD_COUNT words. |
| `GeoCitationOpportunityScanner` | `modules/GeoAnalysis/Scanners/GeoCitationOpportunityScanner.php` | Flags published posts/pages that contain a statistic-shaped claim (a percentage, or a number next to a word like "study"/"survey"/ "report"/"research") but link out to zero external sources anywhere in the content. |
| `GeoEeatSignalsScanner` | `modules/GeoAnalysis/Scanners/GeoEeatSignalsScanner.php` | Flags published posts/pages showing neither of two real, checkable EEAT (Experience, Expertise, Authoritativeness, Trustworthiness) freshness/authorship signals: an author bio, or any edit after initial publish (`post_modified` la |
| `GeoEntityNamingConsistencyScanner` | `modules/GeoAnalysis/Scanners/GeoEntityNamingConsistencyScanner.php` | Flags published posts/pages that mention the site's own name (the brand entity) in more than one distinct casing/spacing variant - e.g. |
| `GeoFaqOpportunityScanner` | `modules/GeoAnalysis/Scanners/GeoFaqOpportunityScanner.php` | Flags long-form published posts/pages with no question-phrased heading anywhere in the content (a real, bounded proxy for "no FAQ-style section") - AI answer engines frequently lift direct question/answer pairs verbatim into their |
| `GeoSemanticStructureScanner` | `modules/GeoAnalysis/Scanners/GeoSemanticStructureScanner.php` | Flags published posts/pages whose heading levels skip a level (e.g. |
| `GeoSummaryBlockScanner` | `modules/GeoAnalysis/Scanners/GeoSummaryBlockScanner.php` | Flags long-form published posts/pages with no upfront summary. |
| `GeoTrustSignalsScanner` | `modules/GeoAnalysis/Scanners/GeoTrustSignalsScanner.php` | A sitewide (not per-post) check: does this site have a published page whose slug identifies it as an About or Contact page. |
| `GeoScore` | `modules/GeoAnalysis/ValueObjects/GeoScore.php` | A single post's GEO (Generative Engine Optimization) score, produced by GeoAnalysis\GeoAnalyzer::analyze() (its only real caller, hence living here rather than classes/Utill/) - combines deterministic Scanner findings with AI-judg |

Hooks and routes registered by these classes:

- `LlmsTxtGenerator` - hooks: `init`, `query_vars`, `template_redirect`
- `Module` - hooks: `save_post`
- `Geo` - ; routes: `/geo/progress`, `/geo/score`
- `GeoAnalysis` - ; routes: `/geo-analysis/pages`, `/geo-analysis/top-pages`
- `LlmsTxt` - ; routes: `/llms-txt/regenerate`
