import { __ } from '@wordpress/i18n';
import { TabPanel } from '@wordpress/components';
import GeneralTab from './tabs/GeneralTab';
import AdvancedTab from './tabs/AdvancedTab';
import SocialTab from './tabs/SocialTab';
import SchemaTab from './tabs/SchemaTab';

import type { SeoIssueEditorTab } from '../services/seoIssueEditorTarget';

/**
 * `icon` (a Dashicon slug — always available in wp-admin, no extra
 * dependency needed) is what actually gives these RankMath-style
 * icon-only tabs: TabPanel's own rendering is `children: !tab.icon &&
 * tab.title` — supplying `icon` here suppresses the visible text label
 * entirely and shows the icon instead, with `title` surviving only as the
 * button's accessible name/tooltip (`label: tab.icon && tab.title`,
 * `showTooltip: !!tab.icon` — both confirmed straight from the installed
 * `@wordpress/components` build, not undocumented behavior this relies on
 * by accident).
 */
const TABS = [
	{ name: 'general', title: __( 'General', 'vulopilot' ), icon: 'admin-generic', Component: GeneralTab },
	{ name: 'advanced', title: __( 'Advanced', 'vulopilot' ), icon: 'portfolio', Component: AdvancedTab },
	{ name: 'social', title: __( 'Social', 'vulopilot' ), icon: 'share', Component: SocialTab },
	{ name: 'schema', title: __( 'Schema', 'vulopilot' ), icon: 'editor-code', Component: SchemaTab },
];

interface PostSeoPanelProps {
	/** "All SEO Issues" table's "Fix with AI" deep link (post-editor/index.tsx) — which tab to land on. TabPanel reads this once at mount (it's uncontrolled), which matches this prop's own once-per-page-load nature. */
	initialTabName?: SeoIssueEditorTab;
	/** Same deep link's specific field/checklist-item id to scroll to and highlight, within whichever tab it names. */
	highlightTarget?: string;
}

/**
 * The metabox's own tab shell — General/Advanced/Social/Schema, mirroring
 * RankMath's own meta box structure (rankmath.com/kb/on-page-seo/) as
 * researched for the readme rewrite pass. Rendered inside the PluginSidebar
 * registered by src/post-editor/index.tsx.
 */
export default function PostSeoPanel( { initialTabName, highlightTarget }: PostSeoPanelProps ) {
	return (
		<div className="vulopilot-seo-panel">
			<TabPanel
				tabs={ TABS.map( ( { name, title, icon } ) => ( { name, title, icon } ) ) }
				initialTabName={ initialTabName }
			>
				{ ( tab ) => {
					const active = TABS.find( ( candidate ) => candidate.name === tab.name );
					const ActiveComponent = active ? active.Component : GeneralTab;

					return <ActiveComponent highlightTarget={ highlightTarget } />;
				} }
			</TabPanel>
		</div>
	);
}
