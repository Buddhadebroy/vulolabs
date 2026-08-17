import { __ } from '@wordpress/i18n';
import { TabPanel } from '@wordpress/components';
import GeneralTab from './tabs/GeneralTab';
import AdvancedTab from './tabs/AdvancedTab';
import SocialTab from './tabs/SocialTab';
import SchemaTab from './tabs/SchemaTab';

import type { SeoIssueEditorTab } from '../services/seoIssueEditorTarget';

const TABS = [
	{ name: 'general', title: __( 'General', 'vulopilot' ), Component: GeneralTab },
	{ name: 'advanced', title: __( 'Advanced', 'vulopilot' ), Component: AdvancedTab },
	{ name: 'social', title: __( 'Social', 'vulopilot' ), Component: SocialTab },
	{ name: 'schema', title: __( 'Schema', 'vulopilot' ), Component: SchemaTab },
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
				tabs={ TABS.map( ( { name, title } ) => ( { name, title } ) ) }
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
