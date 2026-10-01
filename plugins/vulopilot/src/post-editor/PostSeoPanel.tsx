import { __ } from '@wordpress/i18n';
import { useState } from '@wordpress/element';
import { TabPanel } from '@wordpress/components';
import GeneralTab from './tabs/GeneralTab';
import SocialTab from './tabs/SocialTab';
import SchemaTab from './tabs/SchemaTab';
import PageAnalysisTab from './tabs/PageAnalysisTab';
import PostScoreBadges from './PostScoreBadges';
import { usePostData } from './usePostData';

import type { SeoIssueEditorTab } from '../services/seoIssueEditorTarget';

/**
 * `icon` (a Dashicon slug) is what gives icon-only tabs: TabPanel renders `children: !tab.icon &&
 * tab.title`.
 */
const TABS = [
	{ name: 'general', title: __( 'General', 'vulopilot' ), icon: 'admin-generic', Component: GeneralTab },
	{ name: 'social', title: __( 'Social', 'vulopilot' ), icon: 'share', Component: SocialTab },
	{ name: 'schema', title: __( 'Schema', 'vulopilot' ), icon: 'editor-code', Component: SchemaTab },
	{ name: 'page-analysis', title: __( 'Page Analysis', 'vulopilot' ), icon: 'chart-bar', Component: PageAnalysisTab },
];

interface PostSeoPanelProps {
	/** "All SEO Issues" table's "Fix with AI" deep link (post-editor/index.tsx) - which tab to land on. */
	initialTabName?: SeoIssueEditorTab;
	/** Same deep link's specific field/checklist-item id to scroll to and highlight, within whichever tab it names. */
	highlightTarget?: string;
}

/**
 * The metabox's tab shell. "Page Analysis" is VuloPilot's own addition.
 */
export default function PostSeoPanel( { initialTabName, highlightTarget }: PostSeoPanelProps ) {
	const [ navTarget, setNavTarget ] = useState< { tab: SeoIssueEditorTab; target?: string } | null >( null );
	const { postId } = usePostData();

	const activeTabName = navTarget?.tab ?? initialTabName;
	const activeHighlight = navTarget ? navTarget.target : highlightTarget;

	const navigateTo = ( tab: SeoIssueEditorTab, target?: string ) => {
		setNavTarget( { tab, target } );
	};

	return (
		<div className="vulopilot-seo-panel">
			{ postId && <PostScoreBadges postId={ postId } /> }
			<TabPanel
				key={ activeTabName ?? 'general' }
				tabs={ TABS.map( ( { name, title, icon } ) => ( { name, title, icon } ) ) }
				initialTabName={ activeTabName }
			>
				{ ( tab ) => {
					const active = TABS.find( ( candidate ) => candidate.name === tab.name );
					const ActiveComponent = active ? active.Component : GeneralTab;

					return (
						<ActiveComponent
							highlightTarget={ activeHighlight }
							onNavigate={ navigateTo }
						/>
					);
				} }
			</TabPanel>
		</div>
	);
}
