export default {
	// Same slot the old flat Settings/AiProviders.ts occupied in the
	// top-level bar — this folder replaces that single tab with its own
	// inner tab bar, same "folder of sub-tab files" shape Settings/
	// Scanning/, Settings/Notifications/, and Settings/Automation/ already
	// use. Folder itself renamed from "Connections" to "GetStarted" per
	// direct instruction ("rename the connections tab to Get started") —
	// templateService.ts's own `formatFolderName()` derives this tab's
	// real display title from the literal folder name (camelCase → spaced
	// words), so renaming the directory is what renames the tab; there's
	// no separate `headerTitle` a folder-level tab can override. Sorts
	// first (Settings → General has since been removed entirely — every
	// field it ever had moved elsewhere per direct instruction — so this
	// folder is now the first top-level tab).
	//
	// Inner tab bar used to be 5 sub-tabs (AI Providers / Google Services /
	// PageSpeed Insights / Site Verification / Preferences); per a later,
	// separate direct instruction ("merge all tabs into one tab under get
	// started called connections") those 5 were merged into one single
	// sub-tab, GetStarted/Connections.ts, itself now literally named
	// "Connections" — a coincidental full-circle back to this folder's own
	// old, pre-rename name, one level down. See Connections.ts's own
	// docblock.
	priority: 1,
};
