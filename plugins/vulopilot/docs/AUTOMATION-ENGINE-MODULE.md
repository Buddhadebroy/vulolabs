# VuloPilot - Automation Engine

## Audit: what already existed

| Spec item | Status before this pass |
|---|---|
| Triggers | Already fully built (12 triggers - `TriggerRegistry`'s own docblock notes this count grew by one after this audit was first written) - untouched by this pass. |
| Actions | Already fully built (4 actions) - untouched. |
| Schedules | Already fully built (`Scheduler`, hourly/daily/weekly/monthly cron) - untouched. |
| Email | Already fully built (`Actions\SendEmailAction`) - untouched. |
| Conditions | **Did not exist at all** - no `ConditionInterface`, no config beyond the single bound rule. |
| Workflow Builder | Existed only as a single-action, no-conditions create form. |
| Automation Dashboard | Existed only as Free's own small `AutomationStatusWidget` (enabled/disabled counts). |
| Logs | `GET /automation-runs` existed (read-only), but had **no UI** - `AutomationPanel.tsx` only ever showed `last_triggered_at` on the automations table itself. |
| Retries | **Did not exist at all** - a failed run just stayed `failed`. |
| Manual Actions Only (Free) | **Did not exist at all** - Free's own `Automations\Rest\Automations::run_item()` hard-coded a 501 "not implemented yet" regardless of site state. |

One real, pre-existing bug was also found and fixed in this pass:
`AutomationRunRepository::get_breakdown_by_automation_for_period()`'s SQL
and `Reports\Types\AutomationReport::generate()` both checked for
`status = 'success'`/`'failure'`, but `AutomationEngine` has only ever
written `running`/`completed`/`failed` - every automation report's
succeeded/failed counts were silently always zero. Fixed by correcting
both to the real status strings.

## Free - "Manual Actions Only"

`ActionInterface::execute()` takes a `Recommendation`, not a `Finding` -
since a manual run has no `RuleInterface` match behind it,
`ManualActionRunner::build_recommendation()` builds a synthetic one
directly off the real Finding row (`rule_id = 'manual'`), the same kind of
honest synthetic marker `KNOWLEDGE-GRAPH-MODULE.md`'s synthetic entity ids
already establish for "there's no real matched-rule here, and pretending
there is would be dishonest."

## What's not here yet

- **A generic condition-tree/AND-OR builder.** Deliberately out of scope,
  same reasoning `RULE-ENGINE.md` already gives for `RuleInterface` itself
  - nothing here needs composable boolean logic yet, just a flat ANDed
  list.
- **Retry backoff strategies** (exponential, jitter). `automation_retry_delay_minutes`
  is a single fixed delay reused for every retry attempt of a given run,
  not an increasing one - a real, simple v1, not a full backoff policy.
- **A dedicated GET /automation-conditions endpoint.** `AutomationPanel.tsx`
  hardcodes `CONDITION_TYPE_OPTIONS` client-side, matching how
  `TRIGGER_TYPE_OPTIONS`/`ACTION_TYPE_OPTIONS` already do - not fetched
  from `ConditionRegistry` over REST.
