export default {
	// New top-level folder, slotted in between Get Started and Scanning per
	// direct instruction. Two sub-tabs today — Title Formats (priority 1)
	// and Business Information (priority 2, BusinessInformation.ts, moved
	// in from Scanning → AI Visibility per a later, separate direct
	// instruction) — same "folder of sub-tab files" shape every other
	// Settings folder uses, so Basic Info/Breadcrumbs/Hero & Branding can
	// each become their own sibling file here later without restructuring
	// anything. templateService.ts's own `formatFolderName()` derives this
	// tab's display title ("Site Identity") from this literal folder name.
	// Current top-level order: Get Started 1, Site Identity 2, Scanning 3,
	// Automation 4, Reports 5, Notifications 6, Developer Tools 7, Modules 8
	// — every folder from Scanning on shifted down by one to make room.
	priority: 2,
};
