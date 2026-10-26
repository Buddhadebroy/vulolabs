import { __ } from '@wordpress/i18n';
import { Button } from '@wordpress/components';
import type { ComponentType } from 'react';
import { usePostData } from '../usePostData';
import { useFilterSlot } from '../../services/useFilterSlot';

interface AeoTabProps {
	// eslint-disable-next-line no-unused-vars
	onNavigate?: ( tab: string, target?: string ) => void;
}

/**
 * AEO (Answer Engine Optimization) citation check - Pro-only. Card shell only: the real
 * check (`CitationCoverageChecker::check_one_post()`, a real AI call) lives in
 * vulopilot-pro's own `src/post-editor/AeoCitationCheckPanel.tsx`, resolved via the
 * `vulopilot_post_editor_aeo_citation_panel` filter.
 */
export default function AeoTab( _props: AeoTabProps ) {
	const { postId } = usePostData();
	const Panel = useFilterSlot< ComponentType< { postId: number } > >(
		'vulopilot_post_editor_aeo_citation_panel'
	);

	if ( Panel && postId ) {
		return <Panel postId={ postId } />;
	}

	return (
		<div className="vulopilot-seo-tab vulopilot-seo-tab--aeo">
			<p className="small desc">
				{ __( 'AEO tests whether an AI model already cites this site, unprompted, when asked this page\'s own question.', 'vulopilot' ) }
			</p>
			<Button variant="primary" href={ window.vulopilotPostSeo.shopUrl } target="_blank" rel="noreferrer">
				{ __( 'Upgrade to Pro to Unlock AEO', 'vulopilot' ) }
			</Button>
		</div>
	);
}
