/* global appLocalizer */
import { __ } from '@wordpress/i18n';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
	NavigatorHeaderComponent,
	PopupComponent,
} from '@zyra/components';
import { TableCard } from '@zyra/table';
import ShowProPopup from '../../components/Popup/Popup';
import RunScanHeaderExtra from '../../components/RunScanHeaderExtra';
import { useFindingsTable } from '../../services/useFindingsTable';
import HealthScoreSummary from './HealthScoreSummary';

/**
 * Every finding across every scanner category — the SEO/GEO/WooCommerce
 * pages are this same view pre-filtered to one category.
 *
 * Wrapped in the same NavigatorHeaderComponent + ContainerComponent +
 * ColumnComponent shape every real vulolabs admin tab page uses
 * (e.g. components/Commissions/Commissions.tsx) — a bare `<TableCard>`
 * with no container renders with none of the page padding/title-bar
 * styling those two components provide, which is what made this page
 * (and every other page below it) look broken rather than an actual
 * data/functionality bug.
 *
 * HealthScoreSummary renders readme.txt's "Website Health Score"/"Health
 * Score Trend Timeline" above the findings table — previously only the
 * Dashboard surfaced that data, this page (the one the sidebar actually
 * calls "Health") had none of it.
 */
const Health = () => {
	const title = __('Site health', 'vulopilot');
	const { tableCardProps, error, refetch, isProPopupOpen, closeProPopup } =
		useFindingsTable({
			description: __(
				'No open findings — your site is looking healthy.',
				'vulopilot'
			),
		});

	return (
		<>
			<NavigatorHeaderComponent
				headerIcon="home"
				headerTitle={title}
				headerDescription={__(
					'Every open finding across every scanner category.',
					'vulopilot'
				)}
				headerCustomContent={
					<RunScanHeaderExtra settingsSubtab="general" />
				}
			/>
			<ContainerComponent general>
				<ColumnComponent>
					<HealthScoreSummary />
					{error ? (
						<CardComponent title={title}>
							<ModuleGuardComponent
								icon="error"
								title={__(
									'Could not load findings',
									'vulopilot'
								)}
								desc={error}
								buttonText={__('Retry', 'vulopilot')}
								onButtonClick={refetch}
							/>
						</CardComponent>
					) : (
						<TableCard {...tableCardProps} />
					)}
				</ColumnComponent>
			</ContainerComponent>
			<PopupComponent
				open={isProPopupOpen}
				onClose={closeProPopup}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{appLocalizer.khali_dabba ? (
					<ShowProPopup moduleName="one-click-fix" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</>
	);
};

export default Health;
