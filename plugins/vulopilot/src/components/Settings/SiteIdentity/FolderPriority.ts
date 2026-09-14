export default {
	// New top-level folder, slotted in between Get Started and Scanning per
	// direct instruction. Only one sub-tab today (Title Formats) — same
	// "folder of sub-tab files" shape every other Settings folder uses, so
	// Basic Info/Breadcrumbs/Hero & Branding/Business Info can each become
	// their own sibling file here later without restructuring anything.
	// templateService.ts's own `formatFolderName()` derives this tab's
	// display title ("Site Identity") from this literal folder name.
	// Current top-level order: Get Started 1, Site Identity 2, Scanning 3,
	// Automation 4, Reports 5, Notifications 6, Developer Tools 7, Modules 8
	// — every folder from Scanning on shifted down by one to make room.
	priority: 2,
};
