export default {
	// Same slot the old flat Notifications.ts occupied in the top-level bar
	// (General 1, Modules 1.5, Notifications 2, Scanning 3, ...) — this
	// folder replaces that single file with its own inner tab bar (Email
	// Settings / Alert Preferences), same "folder of sub-tab files" shape
	// Settings/Scanning/ already established. See EmailSettings.ts's own
	// docblock for why.
	priority: 6,
};
