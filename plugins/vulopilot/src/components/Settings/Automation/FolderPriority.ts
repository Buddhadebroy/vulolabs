export default {
	// Same slot the old flat Settings/Automation.ts occupied in the
	// top-level bar (General 1, Modules 1.5, Notifications 2, Scanning 3,
	// Automation 4, ...) — this folder replaces that single file with its
	// own inner tab bar (How VuloPilot Handles Issues / Approval Settings /
	// Automation Schedule / Activity Log), same "folder of sub-tab files"
	// shape Settings/Scanning/ and Settings/Notifications/ already
	// established. See HowVuloPilotHandlesIssues.ts's own docblock for why.
	priority: 4,
};
