export default {
	// "Get Started" — back to a folder (was briefly flattened to a single
	// top-level file, GetStarted.ts, when it only ever had one real
	// sub-tab, Connections). Now 6 real sub-tabs, in priority order:
	// Connections (this folder's own original content, `priority: 1`),
	// Title Formats and Business Information (moved in from the old Site
	// Identity folder per direct instruction, "move this 2 sub tab in Get
	// Started" / "Get Started have 3 tab 1 his own and two tab from Site
	// Identity" — Site Identity had nothing left once both moved out, so
	// that top-level folder is gone rather than left empty), Sitemap
	// (moved in from Scanning → SEO & Content), and Instant Indexing/
	// Backups (both moved in from Scanning per direct instruction, "shift
	// this two tabs in get started section after sitemap").
	// Current top-level order: Get Started 1, Scanning 2, Automation 3,
	// Reports 4, Notifications 5, Developer Tools 6, Modules 7 — every
	// folder after Get Started shifted up one to fill the old Site
	// Identity slot.
	priority: 1,
};
