# VuloPilot - Accessibility

## Audit: what already existed

| Spec item | Status before this pass |
|---|---|
| WCAG Scanner (Free) | **Did not exist at all** - no check for WCAG 2.4.4 (Link Purpose) or any other single, generically-branded "WCAG" rule. |
| Missing Alt (Free) | Already fully built - `Scanners\Basic\ImagesScanner` (category `images`, not `accessibility`) already flags image attachments missing alt text, gated by `flag_missing_alt_text`. Untouched. |
| Labels (Free) | Already fully built - `Scanners\Basic\FormLabelsScanner` (category `accessibility`) already flags `<input>`/`<textarea>`/`<select>` elements with no associated label/aria-label/aria-labelledby. Untouched. |
| Heading Hierarchy (Free) | Already fully built - `Scanners\Basic\GeoSemanticStructureScanner` (category `geo`, built for the GEO module) already flags a heading level *skip* (e.g. `<h2>` directly followed by `<h4>`), its own docblock explicitly citing "the same heading-order definition of a skip that accessibility checkers like axe-core use." Untouched. |
| ARIA Detection (Free) | Already fully built - `Scanners\Basic\AriaAttributesScanner` (category `accessibility`) already flags a clickable `<div>`/`<span>` (has an `onclick` handler) with no `role` attribute. Untouched. |

## Free - one new scanner, category `accessibility`

`WcagScanner` (`wcag-scanner`) lives in `classes/Accessibility/`,
registered in `ScannerRegistry::get_default_scanner_classes()` alongside
`AccessibilityScanner`/`FormLabelsScanner`/`AriaAttributesScanner` under the
same `accessibility` category string, gated by its own settings toggle
(`enable_wcag_scanner`, `Settings → Scanning → Accessibility`) - same
granular, per-scanner-toggle posture this category already uses (no whole-
category kill switch beyond the existing `enable_accessibility_scanning`).

Flags links whose *entire* visible text is a generic, out-of-context phrase
("click here", "read more", "learn more", "here", "this link", "link",
"more") - not merely containing one of those words, which would false-
positive on a link with real context like "click here to read our shipping
policy." This is WCAG 2.4.4 (Link Purpose, In Context): a screen reader
user who pulls up a page's own link list (a common navigation shortcut)
hears nothing but "click here, click here, click here" with no way to tell
them apart. It's the single most common rule automated accessibility
auditors (axe-core's `link-name`, WAVE's "Suspicious Link Text") flag, and
neither plugin had a check for it before this pass - distinct from
`AriaAttributesScanner` (missing role on a clickable non-link element) and
`FormLabelsScanner` (unlabeled form fields).

The other four Free bullets needed no new code - see the audit table above
for exactly which pre-existing scanner (and category) already satisfies
each one.

## What's not here yet

- **A UI for reordering/removing individual ambiguous-link phrases from
  `WcagScanner`'s own dictionary.** The phrase list
  (`WcagScanner::AMBIGUOUS_PHRASES`) is a fixed, small, well-known set -
  same "illustrative, fixed dictionary, not a configurable wordlist"
  posture `WeakPasswordScanner`'s own `COMMON_PASSWORDS` already takes.
- **Color contrast checking.** Genuinely requires rendering the page (a
  headless browser or a screenshot pipeline), which is out of scope for
  this codebase's PHP-side, regex-over-`post_content` scanning approach -
  same category of gap as `SECURITY-MODULE.md`'s "live vulnerability feed"
  (a real, separate infrastructure investment, not something to fake).
- **Bulk-fixing `form-labels`/`wcag-scanner` findings.** See "Bulk Fixes"
  above for why no safe, deterministic fix exists for either yet.
