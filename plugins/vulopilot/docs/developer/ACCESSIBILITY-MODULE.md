# Accessibility (`classes/Accessibility`)

WCAG-oriented scanners. User view: [../user/ACCESSIBILITY.md](../user/ACCESSIBILITY.md).

## Scanners

All use category `accessibility`. The whole category can be switched off with the setting `enable_accessibility_scanning` (`ScannerRegistry` skips it).

| Scanner id | Detects |
|---|---|
| `accessibility` | Published content containing its own `<h1>` |
| `form-labels` | Inputs, textareas and selects with no label, `aria-label` or similar |
| `aria-attributes` | Click-handler elements (for example a `div` with `onclick`) that have no `role` |
| `keyboard-accessibility` | A positive `tabindex` (focus-order problem) |
| `wcag-scanner` | Generic link text such as "click here" (setting `enable_wcag_scanner`) |

Missing image alt text is reported by the SEO image scanners; `MissingAltTextRule` turns that finding into a recommendation.

## Settings

| Setting key | Default |
|---|---|
| `enable_wcag_scanner` | `array( 'enable_wcag_scanner' )` |
| `accessibility_audit_frequency` | `'daily'` |
| `target_wcag_level` | `'2.1_aa'` |
| `enable_accessibility_scanning` | `array( 'enable_accessibility_scanning' )` |

Scan frequency (`accessibility_audit_frequency`) is off, hourly, daily or weekly. `target_wcag_level` is `2.1_a`, `2.1_aa` or `2.1_aaa`.

## Score

The accessibility score is calculated from the severities of open `accessibility` findings, the same way the other category scores are.

## Class reference

| Class | File | What it does |
|---|---|---|
| `AccessibilityScanner` | `classes/Accessibility/AccessibilityScanner.php` | Flags published content that contains its own `<h1>` tag. |
| `AriaAttributesScanner` | `classes/Accessibility/AriaAttributesScanner.php` | Flags interactive-looking elements - a <div> or <span> with an onclick handler - that carry no `role` attribute. |
| `FormLabelsScanner` | `classes/Accessibility/FormLabelsScanner.php` | Flags <input>/<textarea>/<select> elements in published content with no associated label - no <label for="...">, aria-label, or aria-labelledby. |
| `KeyboardAccessibilityScanner` | `classes/Accessibility/KeyboardAccessibilityScanner.php` | Flags a positive `tabindex` (`tabindex="1"` and above) in published content - WCAG 2.4.3 (Focus Order): a positive tabindex pulls that element out of the page's natural DOM tab order and inserts it at a fixed position ahead of eve |
| `MissingAltTextRule` | `classes/Accessibility/MissingAltTextRule.php` | - |
| `WcagScanner` | `classes/Accessibility/WcagScanner.php` | - |
