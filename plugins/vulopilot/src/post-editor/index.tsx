import { registerPlugin } from '@wordpress/plugins';
import { PluginSidebar, PluginSidebarMoreMenuItem } from '@wordpress/edit-post';
import { dispatch } from '@wordpress/data';
import { useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';
import PostSeoPanel from './PostSeoPanel';
import {
	getEditorTargetForScanner,
	SEO_ISSUE_QUERY_PARAM,
	PAGE_ANALYSIS_CHECK_QUERY_PARAM,
	SeoIssueEditorTab,
} from '../services/seoIssueEditorTarget';
import './style.scss';

const SIDEBAR_NAME = 'vulopilot-seo-sidebar';

interface DeepLinkTarget {
	wasPresent: boolean;
	tab?: SeoIssueEditorTab;
	target?: string;
}

/**
 * Two independent deep-link sources land here, both stripped from the URL
 * immediately so a page refresh doesn't keep re-triggering the highlight,
 * and both read once, on module load (before first render — matches
 * TabPanel's own mount-time-only `initialTabName` prop):
 *
 * - "All SEO Issues" table's "Fix with AI" link
 *   (`src/pages/GEO/SeoIssuesByPageTable.tsx`) and
 *   `Content/ContentQualityCard.tsx`'s own check rows, as
 *   `?vulopilot_seo_issue={scannerId}` — resolved via
 *   `SEO_ISSUE_EDITOR_TARGETS`, the same shared map those callers used to
 *   build the link, so both sides agree on what "general/description_length"
 *   etc. means without either duplicating the other's logic.
 * - `GEO/PageAnalysisPanel.tsx`'s own checklist, as
 *   `?vulopilot_page_analysis_check={checkKey}` — always resolves straight
 *   to the "Page Analysis" tab, highlighting the row whose `key` matches
 *   (see `PAGE_ANALYSIS_CHECK_QUERY_PARAM`'s own docblock for why this one
 *   doesn't go through the scanner-id map at all).
 *
 * `wasPresent` is tracked separately from the resolved tab/target — the
 * first source's query param can be present but resolve to nothing (a
 * scanner id with no editor-sidebar equivalent); the sidebar should still
 * open in that case so the user isn't left staring at a plain redirect with
 * nothing visibly changed, it just won't have a specific tab/highlight.
 */
const readDeepLinkTarget = (): DeepLinkTarget => {
	const params = new URLSearchParams( window.location.search );
	const scannerId = params.get( SEO_ISSUE_QUERY_PARAM );
	const pageAnalysisCheckKey = params.get( PAGE_ANALYSIS_CHECK_QUERY_PARAM );

	if ( ! scannerId && ! pageAnalysisCheckKey ) {
		return { wasPresent: false };
	}

	params.delete( SEO_ISSUE_QUERY_PARAM );
	params.delete( PAGE_ANALYSIS_CHECK_QUERY_PARAM );
	const query = params.toString();
	window.history.replaceState(
		{},
		'',
		window.location.pathname + ( query ? `?${ query }` : '' ) + window.location.hash
	);

	if ( pageAnalysisCheckKey ) {
		return { wasPresent: true, tab: 'page-analysis', target: pageAnalysisCheckKey };
	}

	const resolved = getEditorTargetForScanner( scannerId as string );
	return { wasPresent: true, tab: resolved?.tab, target: resolved?.target };
};

// Read once at module scope, before first render — deep-link state is
// static for the lifetime of this editor page load, so there's no need to
// re-derive it on every render the way component state would.
const { wasPresent: shouldOpenSidebar, tab: deepLinkTab, target: deepLinkHighlight } = readDeepLinkTarget();

/**
 * "Meta Box Appearing in Single Posts & Pages" — VuloPilot's first Block
 * Editor integration (react-frontend.md's mounting rules cover the
 * dashboard app at `#admin-main-wrapper`/`#vulolabs-store-dashboard`,
 * a different surface entirely). Registered as a `PluginSidebar` rather
 * than a classic `add_meta_box()` panel — RankMath's own primary,
 * most-recognized surface (the icon in the editor's top toolbar opening
 * this same sidebar), not its secondary below-content metabox. (This
 * briefly moved to that below-content metabox instead, on the theory that
 * it avoids the sidebar's own internal scroll on a long panel — reverted
 * per direct instruction; see PostEditorAssets.php's own class docblock.)
 *
 * Only enqueued for post/page/product screens
 * (Services\PostEditorAssets::enqueue_assets()), so this module never runs
 * anywhere else.
 */
const VuloPilotSeoPlugin = () => {
	useEffect( () => {
		if ( ! shouldOpenSidebar ) {
			return;
		}

		// core/edit-post's own store — the same one PluginSidebar/
		// PluginSidebarMoreMenuItem below are already registered against,
		// and the one `wp-edit-post` (a real script dependency of this
		// bundle, see PostEditorAssets.php) backs.
		// `${pluginName}/${sidebarName}` is openGeneralSidebar()'s own
		// required identifier shape.
		const open = () =>
			dispatch( 'core/edit-post' ).openGeneralSidebar( `vulopilot-seo/${ SIDEBAR_NAME }` );

		// The editor restores its own last-used general sidebar (from
		// `core/preferences`) as part of its own boot sequence, which can
		// still be settling when this effect first runs — confirmed live:
		// dispatching once on mount alone was silently overridden back to
		// 'edit-post/document'. Dispatching again shortly after beats that
		// race without needing to hook into the editor's own internal
		// readiness signal.
		open();
		const timeout = setTimeout( open, 500 );

		return () => clearTimeout( timeout );
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [] );

	return (
		<>
			<PluginSidebarMoreMenuItem target={ SIDEBAR_NAME }>
				{ __( 'VuloPilot SEO', 'vulopilot' ) }
			</PluginSidebarMoreMenuItem>
			<PluginSidebar name={ SIDEBAR_NAME } title={ __( 'VuloPilot SEO', 'vulopilot' ) }>
				<PostSeoPanel
					initialTabName={ deepLinkTab }
					highlightTarget={ deepLinkHighlight }
				/>
			</PluginSidebar>
		</>
	);
};

registerPlugin( 'vulopilot-seo', { render: VuloPilotSeoPlugin } );
