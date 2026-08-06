import { __ } from '@wordpress/i18n';
import { CardComponent, ColumnComponent, TooltipComponent } from '@zyra/components';
import SuggestedActionsList from './SuggestedActionsList';

const FIX_ALL_DISABLED_REASON = __(
	"Fixing every open finding automatically isn't available yet — review and fix items individually below.",
	'vulopilot'
);

/**
 * Full-width version of the Chat tab sidebar's "Suggested Actions"
 * preview — same live `/findings` data, just untruncated. "Fix all with
 * AI" is honestly disabled (no batch/one-click fix engine exists for
 * findings — same real gap SuggestedActionsList.tsx's per-row "Fix with
 * AI" button already discloses).
 */
const SuggestedActionsTab = () => (
		<ColumnComponent>
			<CardComponent
				title={__('Suggested Actions', 'vulopilot')}
				titleIcon="ai"
				desc={__(
					'Everything VuloPilot has found across your site, ranked by severity.',
					'vulopilot'
				)}
				action={
					<TooltipComponent text={FIX_ALL_DISABLED_REASON}>
						<span
							role="button"
							aria-disabled="true"
							className="suggested-actions-fix-all disabled"
						>
							<i className="adminfont-ai" />
							{__('Fix all with AI', 'vulopilot')}
						</span>
					</TooltipComponent>
				}
			>
				<SuggestedActionsList />
			</CardComponent>
		</ColumnComponent>
);

export default SuggestedActionsTab;
