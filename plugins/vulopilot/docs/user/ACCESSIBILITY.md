# Accessibility

The Accessibility page checks whether people with disabilities can use your site. It scans against WCAG 2.1 (levels A, AA or AAA) and groups what it finds by topic.

> Install and the first scan are in [GETTING-STARTED](GETTING-STARTED.md).

**In this guide**

1. [Run an accessibility audit](#1-run-an-accessibility-audit)
2. [Read the score](#2-read-the-score)
3. [Work through the findings](#3-work-through-the-findings)
4. [Do the manual checks](#4-do-the-manual-checks)
5. [Choose what is checked](#5-choose-what-is-checked)

## 1. Run an accessibility audit

1. Open **VuloPilot → Accessibility**.
2. Click **Run Accessibility Audit** in the header.
3. When it finishes, the score and findings update.

To have audits run on their own, set a **Scan frequency** in the settings (step 5).

## 2. Read the score

The hero card shows a **Score** and how much is **Remaining** to fix, with a rating:

| Rating | Message |
|---|---|
| **Good** | Great job - no open accessibility issues |
| **Needs Work** | Most visitors can use your site, but some areas could be improved |
| **At Risk** | Accessibility needs urgent attention |

Click **Review Important Issues** to jump to the most serious findings. **Accessibility Score History** shows the trend so you can see whether your fixes are helping.

## 3. Work through the findings

Findings are grouped so you can fix one topic at a time.

| Group | What it checks |
|---|---|
| **Page Structure** | Heading hierarchy and duplicate `<h1>` tags |
| **Images & Media** | Images without alt text |
| **Links & Forms** | Form fields without labels, and unclear link text such as "Click here" |
| **Keyboard Use** | Interactive elements that keyboard users may not reach or understand (ARIA roles and attributes) |
| **Visual Readability** | Text that may be difficult to see |
| **All Checks** | Every check combined |

For each finding: open it, read the recommendation, fix the page (for example add alt text in the Media Library), then re-run the audit.

## 4. Do the manual checks

Automated tests find many technical issues, but some things need a person. The **Manual testing recommended** panel lists three:

| Check | Ask yourself |
|---|---|
| **Keyboard navigation** | Can you reach and use everything without a mouse? |
| **Screen-reader experience** | Does the content make sense when read aloud? |
| **Zoom & text resizing** | Does the page still work when text is enlarged? |

Click **Open Manual Checklist** for a step-by-step list.

## 5. Choose what is checked

Go to **Settings → Scanning → Accessibility**.

| Setting | What it does |
|---|---|
| **Accessibility checks** | Turns the accessibility scan on or off |
| **Scan frequency** | How often it runs on its own: Off, Hourly, Daily or Weekly |
| **WCAG level** | Which standard to check against: A, AA or AAA |
| **WCAG scanner** | Turns on the extra WCAG checks |
| **Check for generic, out-of-context link text** | Flags links such as "Click here" or "Read more" whose purpose is unclear |

There is also a **Restore defaults** action in the header of that settings page.

## Related guides

- [SEO](SEO.md) - missing alt text is also an image SEO issue
- [SETTINGS](SETTINGS.md#scanning)
