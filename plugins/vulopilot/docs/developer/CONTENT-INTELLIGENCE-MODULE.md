# Content Optimization (`modules/ContentOptimization`)

Content quality checks. User view: [../user/CONTENT.md](../user/CONTENT.md).

## Components

| Component | Role |
|---|---|
| `Scanners\ReadabilityScanner` | Flags posts whose Flesch Reading Ease score is below `content_readability_min_score` (default 50). Registered through `vulopilot_scanner_sources` |
| `ContentAnalyzer` | `analyze( $post_id ): ContentScore` combines deterministic checks with an AI "topic authority" assessment; `get_stored_score()` reads the last result |
| `Rest\ContentIntelligence` | `GET /content-intelligence/quality`, `/score`, `/stats` |
| `ValueObjects\ContentScore` | Result of one analysis |

`ContentAnalyzer` follows the same shape as `GeoAnalysis\GeoAnalyzer`: a plain orchestrator that reuses `AiRequestSender`, stores through `FindingRepository`, and is not an AI action because it changes nothing.

## Content creation

Free AI content tools (AI Writer, Blog Generator, Duplicate Content, AI Content Audit) run through AI actions ([AI-ACTIONS](AI-ACTIONS.md)). `AiCopilot\ContentCreationOrchestrator` allows the chat to create a draft only for whitelisted actions (`generate-blog`).

## Settings

| Setting key | Default |
|---|---|
| `thin_content_word_threshold` | `300` |
| `content_search_scans` | `array( ... )` |
| `content_readability_min_score` | `50` |

## Class reference

| Class | File | What it does |
|---|---|---|
| `ContentAnalyzer` | `modules/ContentOptimization/ContentAnalyzer.php` | Generates a ContentScore for one post - "Topic Authority" (the one Content Intelligence AI capability actually requested), combined with a deterministic score over this module's own 5 real checks. |
| `Module` | `modules/ContentOptimization/Module.php` | VuloPilot ContentOptimization module. |
| `ContentIntelligence` | `modules/ContentOptimization/Rest/ContentIntelligence.php` | `GET /content-intelligence/score` - the composite, deterministic "Content Score" (no AI, no cost). |
| `ReadabilityScanner` | `modules/ContentOptimization/Scanners/ReadabilityScanner.php` | Content Intelligence's own deterministic readability check - the one genuinely new scanner this module adds (Thin Content/Duplicate Content/ Heading Structure/Internal Linking already exist as `seo`-category scanners and aren't du |
| `ContentScore` | `modules/ContentOptimization/ValueObjects/ContentScore.php` | A single post's Content Intelligence score, produced by ContentOptimization\ContentAnalyzer::analyze() (its only real caller, hence living here rather than classes/Utill/) - same shape as GeoAnalysis\ValueObjects\GeoScore (combine |

Hooks and routes registered by these classes:

- `Module` - hooks: `vulopilot_scanner_sources`
- `ContentIntelligence` - ; routes: `/content-intelligence/quality`, `/content-intelligence/score`, `/content-intelligence/stats`
