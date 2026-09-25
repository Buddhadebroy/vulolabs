# Dashboard Widgets

The dashboard is a grid of widgets defined in the React app. User view: [../user/DASHBOARD.md](../user/DASHBOARD.md).

## Where things are

| Piece | File |
|---|---|
| Widget definitions and default order | `src/dashboard-widgets/registry.ts` |
| Grid, drag and drop, hide | `DashboardGrid.tsx`, `DashboardWidget.tsx` |
| Widget components | `src/dashboard-widgets/*Widget.tsx` |
| Data types for `GET /dashboard` | `src/dashboard-widgets/types.ts` |
| Server summary | `classes/Dashboard/Rest/Dashboard.php` |
| Layout storage | `classes/Dashboard/Rest/DashboardLayout.php` -> user meta `vulopilot_dashboard_widget_layout` |
| Known widget ids | `Utill::DASHBOARD_WIDGET_IDS` |

## Data flow

```
GET /dashboard  ->  summary object (scores by category, findings counts, activity, counts)
   -> widgets read it through props; some widgets call their own endpoints (crawler traffic, entities, reports)
GET/POST /dashboard-layout  ->  the current user's order and hidden widgets
```

## Widget definition

```ts
{ id: 'overall-score', title, desc, icon, grid: 6 | 12 | 4, component }
```

`grid` is the width in a 12-column grid. `DEFAULT_DASHBOARD_WIDGETS` is passed through the `vulopilot_dashboard_widgets` filter, so an add-on can append widgets from its own script.

## Layout rules

- Each user has their own layout (user meta), never shared in `vulopilot_settings`.
- A widget id that is not in `Utill::DASHBOARD_WIDGET_IDS` is rejected on save, so a stale layout cannot reference a widget that no longer exists.
- Ids missing from a saved layout are appended, so newly released widgets appear for existing users.
- "Reset to default" writes the default order back.

## Add a widget

1. Create the component in `src/dashboard-widgets`.
2. Add a definition to the registry (or add it from an extension through the `vulopilot_dashboard_widgets` filter).
3. Add its id to `Utill::DASHBOARD_WIDGET_IDS` so layouts accept it.
4. If it needs new data, extend `GET /dashboard` and `types.ts`, or give the widget its own endpoint.
5. Give it a loading state, an empty state and an error state: dashboard widgets fetch independently.

## Widgets in the core

`overall-score`, `site-snapshot`, `needs-attention`, `crawler-traffic`, `recent-activity`, plus the components in the folder (health timeline, automation status, AI suggestions, brand breakdown, knowledge graph, recent changes, latest reports).
