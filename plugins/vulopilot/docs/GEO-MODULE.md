# VuloPilot - GEO module

## What GEO means here

GEO = Generative Engine Optimization - how discoverable and citable a page is to
AI answer engines (ChatGPT, Perplexity, Google AI Overviews), as distinct from
classic search-engine SEO (`SEO-MODULE.md`). `pages/GEO/GEO.tsx` and the `geo`
Finding category have existed since the admin-UI and Scanners passes, but
`SCANNERS.md` explicitly noted "there's no `geo` scanner in this list" - this pass
is what fills that gap.

## Splitting 12 checks into two honest categories

`SCANNERS.md`'s hard rule - **scanners never call AI** - means a check only becomes
a `Scanner` if it has a real, deterministic, non-AI signal. Four of the requested
checks genuinely don't:

| Check | Why it needs AI judgment, not a scanner |
|---|---|
| Entity Coverage | Whether key people/products/concepts are clearly named and explained requires understanding what the content is *about* |
| Question Coverage | Whether the content answers questions a reader would plausibly search for requires understanding reader intent |
| Answer Completeness | Whether an answer is self-contained requires judging whether it actually resolves the question, not just that words are present |
| LLM Readability | A holistic "could an AI system cleanly extract and quote this" assessment, not a single measurable property |

Faking these with a word-count or regex heuristic pretending to measure "entity
coverage" would be exactly the kind of dishonest scanner `SCANNERS.md`'s existing
scanners (each documented as "one honest check") argue against. Instead, these 4
are scored by a real AI call - see `GeoAnalysis\GeoAnalyzer` below - not skipped.

The other 8 of the original 12 checks *do* have a real, bounded, deterministic
signal and became real scanners, exactly like `SEO-MODULE.md`'s pass:

| Check | Scanner `id` | Scope | What it actually checks |
|---|---|---|---|
| Author Information | `geo-author-info` | per-post | Author has no bio (`get_the_author_meta('description')`) |
| EEAT | `geo-eeat-signals` | per-post | *Both* no author bio *and* never updated since publish |
| Trust Signals | `geo-trust-signals` | sitewide | No published About or Contact page exists |
| Citation Opportunities | `geo-citation-opportunities` | per-post | A statistic-shaped claim (`42%`, "studies show…") with zero outbound links |
| Summary Blocks | `geo-summary-block` | per-post | Long-form content with no TL;DR/key-takeaways marker or early list |
| FAQ Opportunities | `geo-faq-opportunity` | per-post | Long-form content with no question-phrased heading |
| Chunking | `geo-chunking` | per-post | A single `<p>` block over 150 words |
| Semantic Structure | `geo-semantic-structure` | per-post | A heading skips a level (e.g. H2 → H4 with no H3) |

**A 9th deterministic scanner, added after this original 12-check pass**:
`GeoEntityNamingConsistencyScanner` (`geo-entity-naming-consistency`, per-post) -
flags a post that refers to the site's own brand name in more than one distinct
casing/spelling variant (e.g. "VuloPilot" in one paragraph, "Vulopilot" in
another). It wasn't part of the original 12-item checklist above; it's a
separate, later addition (`AI-VISIBILITY-MODULE.md`'s audit already documents it
as "already Free" - its paired `normalize-entity-naming` AI action lives
alongside the others in `modules/AiCopilot/Actions/`). All 9 deterministic
scanners are what `GeoAnalyzer::calculate_deterministic_score()` below actually
counts against (`TOTAL_DETERMINISTIC_CHECKS = 9`), not just the original 8.

All 9 share `get_category() === 'geo'`, `get_tier() === 'free'`, extend
`Utill\ScannerUtil`, and live in `modules/GeoAnalysis/Scanners/` - identical
convention to `SEO-MODULE.md`'s scanners. `GeoTrustSignalsScanner` is the one
sitewide check among them (like `RobotsTxtScanner`'s "blocks all crawlers"
finding) - it applies identically to every post rather than being about one
specific post. A 10th `geo`-category scanner, `AeoSchemaScanner`
(`aeo-schema`), was added in the same later pass as Entity Naming Consistency,
but its findings are deliberately surfaced on `pages/AEO/AEO.tsx` instead of
this page - see `AI-VISIBILITY-MODULE.md` for what it checks and why it isn't
duplicated here.

## `GeoAnalysis\GeoAnalyzer` - "Generate GEO Score" / "Generate AI suggestions"

A plain, concrete orchestrator (`modules/GeoAnalysis/GeoAnalyzer.php`) - no
interface, same reasoning `Scanners\ScanRunner`/`RuleEngine\RuleEngine` already
establish: there's exactly one way "analyze this post for GEO" happens, so an
interface would have one implementer.

**This is not an `AIAction`.** Nothing about the post is mutated - it's a
read-only analysis producing a report, so there's no Approval/Execution/Rollback
lifecycle to run (`AI-ACTIONS.md`'s stages 5-7 exist specifically to gate a
*mutation*). Modeling it as an `AIAction` anyway (e.g. `execute()` just writing the
score to postmeta) would have forced every GEO score generation through an
unnecessary approval click for something that changes nothing on the site.

```php
public function analyze( int $post_id ): GeoScore
```

`analyze()` now blends **three** components into `overall_score`, not two:

1. **A deterministic score** (`calculate_deterministic_score()`): the percentage
   of the 9 scanners above with no open finding for this post (8 per-post + the
   1 sitewide Trust Signals check) - read from already-persisted
   `vulopilot_scan_findings` via `FindingRepository` (which gained an
   `object_ref` filter specifically for this read). **Null, not 0, if this site
   has no GEO scan history at all** - an absence of problems is never confused
   with "never checked." Omitted from the final average entirely when null,
   rather than treated as 0.
2. **8 AI-judged dimensions** (`build_prompt()`/`parse_response()`), each 0-100:
   `entity_coverage`, `question_coverage`, `answer_completeness`,
   `llm_readability`, `purpose_clarity`, `conversation_readiness`,
   `knowledge_graph_coverage`, `answer_first_structure`. (The original pass only
   asked for 4 - `purpose_clarity`, `conversation_readiness`,
   `knowledge_graph_coverage`, and `answer_first_structure` were added later,
   same AI-call path, no new REST route.) `entity_coverage` is dropped from the
   result entirely - not scored 0 - when Scanning → GEO's `flag_weak_entity`
   toggle is off, the same "disabled check reports nothing" posture a disabled
   scanner already takes; when it's on, the prompt also passes the AI a
   concrete anchor point from `minimum_entity_mentions`.
3. **6 sub-scores** (`calculate_sub_scores()`), computed with zero AI cost from
   already-known scanner findings or the post object itself: `retrieval_score`
   (average pass/fail of the `geo-chunking`/`geo-semantic-structure` checks),
   `citation_readiness` (binary on `geo-citation-opportunities`),
   `ai_summary_qa_detection` (average pass/fail of `geo-summary-block`/
   `geo-faq-opportunity`), `entity_naming_consistency` (binary on
   `geo-entity-naming-consistency`), `content_freshness` (a 4-tier recency score
   off `post_modified`, scaled by Scanning → GEO's `stale_content_months`), and
   `data_point_evidence_density` (a 3-tier score reusing
   `GeoCitationOpportunityScanner`'s own claim-detection regex, but counting
   matches per 500 words against `min_data_points` instead of just checking
   presence).

`calculate_overall_score()` averages whichever of these 3 components are
actually known, unweighted - still "a simple, documented heuristic, not a claim
of scientific precision" (the same posture `Controllers/Dashboard.php`'s
`calculate_overall_score()` already takes), just blending 3 inputs now instead
of 2.

**New in this pass: a per-post score-drop notification.** `analyze()` also calls
`maybe_notify_score_drop()`, which compares the just-computed `overall_score`
against the previously stored one (if any) and emails Settings → Notifications'
recipient when it fell by at least Scanning → GEO's `aeo_drop_threshold`, gated
behind `email_on_geo_score_drop` (default off). Never fires on a post's
first-ever analysis - there's nothing to have "dropped" from. The identical
threshold/toggle also drives a *sitewide* version of this same notification;
see `AI-VISIBILITY-MODULE.md`'s "Monitoring".

4. Persists the result to `_vulopilot_geo_score` postmeta (`GenerateSchemaAction`'s
   same postmeta-blob pattern - no new table) and returns it.

### Reusing the AI call path - and a small refactor to make that possible

`GeoAnalyzer` needed the exact "safety-validate → build provider chain → send →
sanitize response" sequence `AiCopilot\ActionRunner::propose()` already had, inline.
Rather than copy those six lines into a second consumer, they were extracted into
a new **`AI\AiRequestSender`** class, and `ActionRunner` was
refactored to use it too (its own constructor now takes `AiRequestSender` instead
of a provider registry + `AISafetyValidator` separately - that registry has since been removed). Both `ActionRunner` and
`GeoAnalyzer` now go through the identical safety-validated call path - no parallel
"send an AI request" logic exists anywhere in this codebase.

## The 2 new rules and 2 new AI Actions

| Rule | `id` | Pairs with scanner | Fix action |
|---|---|---|---|
| `FaqOpportunityRule` | `faq-opportunity` | `geo-faq-opportunity` | `GenerateFaqAction` |
| `MissingSummaryBlockRule` | `missing-summary-block` | `geo-summary-block` | `GenerateSummaryBlockAction` |

Both rules match on a scanner-specific meta key (`faq_opportunity`,
`missing_summary_block`), never on category alone or on the Finding's
already-translated title text - `SEO-MODULE.md`'s "Fixing a category collision"
section documents exactly why that discipline matters once many scanners share one
category (`geo` is now shared by 10 scanners, per the table above).

**`GenerateFaqAction`** and **`GenerateSummaryBlockAction`** (`modules/AiCopilot/Actions/`)
close those two fix loops - both a content-mutation pattern none of the existing 5
actions used yet:

- `GenerateFaqAction` **appends** an FAQ section (real, visible HTML - question
  headings + answers) to the end of `post_content` via `wp_update_post()`. Unlike
  `GenerateSchemaAction`'s postmeta-only write, this has to be visible HTML,
  because `GeoFaqOpportunityScanner`'s own check is about headings a crawler would
  actually render and see.
- `GenerateSummaryBlockAction` **prepends** a "Key Takeaways" list to the *top* of
  `post_content` - the one shape none of the other actions use (append or full
  rewrite). It has to land at the top because `GeoSummaryBlockScanner` specifically
  checks the first 600 characters for a summary.

Both get a WordPress revision for free via `wp_update_post()` (`ImproveReadabilityAction`'s
same bonus safety net) and roll back by restoring the previous full `post_content`.

## Extension strategy

Identical shape to every other engine in this codebase:

1. **A new Free GEO check**: if it has a real deterministic signal, add a scanner
   with `get_category() === 'geo'` (register in `ScannerRegistry`); if it genuinely
   needs semantic judgment, extend `GeoAnalyzer`'s prompt/parsing to score another AI
   dimension instead of forcing a fake scanner.
3. **A third-party check**: same filters, from any other plugin.

## What's not here yet

- **A live post-search picker** for `GeoScoreCard` - see above.
- **Per-post GEO score history** - each `analyze()` call still overwrites the
  previous postmeta value for that one post; there's no trend-over-time view
  for an individual post's own score. (The *sitewide sample average*
  VisibilitySnapshotBuilder produces DOES now have real history -
  `vulopilot_geo_visibility_history`, see
  [`AI-VISIBILITY-MODULE.md`](AI-VISIBILITY-MODULE.md)'s "Historical Trends" -
  this bullet is specifically about a single post's own score over time,
  which still has no equivalent.)
- **Quota/cost guardrails specific to GEO analysis** - it goes through the same
  the same per-minute budget and history recording `AiRequestSender` applies to every AI call, but there's no
  GEO-specific "you've analyzed N posts this month" limit.
