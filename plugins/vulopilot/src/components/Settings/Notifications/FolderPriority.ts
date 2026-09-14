export default {
	// This folder replaces the old flat Notifications.ts with its own
	// inner tab bar (Email Settings / Alert Preferences), same "folder of
	// sub-tab files" shape Settings/Scanning/ already established. See
	// EmailSettings.ts's own docblock for why.
	// Current top-level order: Get Started 1, Site Identity 2, Scanning 3,
	// Automation 4, Reports 5, Notifications 6, Developer Tools 7, Modules 8
	// — shifted down by one again to make room for the new Site Identity folder.
	priority: 6,
};
