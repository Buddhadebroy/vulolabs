export default {
	// This folder replaced the old flat Settings/Automation.ts with its own
	// inner tab bar; "How VuloPilot Handles Issues" and "Approval Settings"
	// (Ask before applying AI changes) have since been removed per direct
	// instruction, leaving "Advanced" as the sole sub-tab — kept as a
	// folder rather than flattened back to a single top-level file since
	// that wasn't part of the instruction.
	// Current top-level order: Get Started 1, Site Identity 2, Scanning 3,
	// Automation 4, Reports 5, Notifications 6, Developer Tools 7, Modules 8
	// — shifted down by one again to make room for the new Site Identity folder.
	priority: 4,
};
