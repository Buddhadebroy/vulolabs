import { addFilter } from '@wordpress/hooks';
import CommerceIssuesTable from './CommerceIssuesTable';
import AiSalesAssistantCard from './AiSalesAssistantCard';
import AiSalesOptimizerCard from './AiSalesOptimizerCard';

/**
 * The Commerce tab's real body content (CommerceTab.tsx and most of its
 * children) moved to vulopilot-pro's own Commerce module per direct
 * instruction — but these 3 components stayed here: they depend on large,
 * genuinely shared Free infrastructure (useFindingsTable.tsx's 700+
 * lines, the AI chat widget under components/ChatComposerCard/,
 * AiCopilotGuard) used by many other free pages (GEO, Accessibility,
 * Reports, …), so duplicating that logic into Pro just for this one tab
 * would bloat that plugin and create drift risk — see
 * modules/Commerce/Module.php's own docblock (Pro side) for the full
 * reasoning.
 *
 * Registered here into 3 small filter slots so Pro's own (moved)
 * CommerceTab.tsx can still compose them into the exact same page layout
 * — the SAME `@wordpress/hooks` mechanism every other cross-plugin slot
 * in this app already uses, just in the opposite direction (Free
 * registers, Pro consumes). No script-load-order race to guard against on
 * this side (unlike `useFilterSlot()`'s own Pro-into-Free direction):
 * Free's bundle is a hard script dependency of Pro's
 * (FrontendScriptsPro.php) and always finishes evaluating first, so a
 * plain `addFilter()` here is always registered before Pro's own
 * `applyFilters()` read ever runs.
 *
 * Imported once, unconditionally, from Commerce.tsx (this route's own
 * entry point, itself always eagerly imported by routes.ts) — so these 3
 * registrations exist on every VuloPilot admin page load, not just while
 * the Commerce tab is actually open.
 */
addFilter(
	'vulopilot_commerce_issues_table',
	'vulopilot/commerce',
	() => CommerceIssuesTable
);

addFilter(
	'vulopilot_commerce_ai_sales_assistant',
	'vulopilot/commerce',
	() => AiSalesAssistantCard
);

addFilter(
	'vulopilot_commerce_ai_sales_optimizer',
	'vulopilot/commerce',
	() => AiSalesOptimizerCard
);
