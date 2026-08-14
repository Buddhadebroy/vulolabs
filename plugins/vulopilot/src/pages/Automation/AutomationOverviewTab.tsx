import { ColumnComponent, ContainerComponent } from '@zyra/components';
import AutomationHeroRow from './AutomationHeroRow';
import AutomationOverviewGrid from './AutomationOverviewGrid';
import AutomationAttentionCard from './AutomationAttentionCard';
import AutomationPeriodStatsCard from './AutomationPeriodStatsCard';
import AutomationComposerCard from './AutomationComposerCard';
import AutomationActivityCard from './AutomationActivityCard';
import AiForemanCard from './AiForemanCard';
import AutomationLinksRow from './AutomationLinksRow';
import AutomationExploreBanner from './AutomationExploreBanner';

interface AutomationOverviewTabProps {
	onManageAutomations: () => void;
}

/**
 * "Automate Work"'s "Overview" tab — merges the new dashboard-style
 * mockup (watching-status hero, real automations grid, real period
 * stats, real "needs attention" list, closing banner) with the real,
 * already-built cards from the previous rebuild that the new mockup
 * doesn't show but don't duplicate anything in it either
 * (AutomationComposerCard's workflow prompt composer, AiForemanCard,
 * AutomationLinksRow, AutomationActivityCard). Dropped rather than kept:
 * ActiveWorkflowCard.tsx (single most-recent-automation detail — now
 * subsumed by AutomationOverviewGrid.tsx showing several at once),
 * AutomationStatusCard.tsx (its real success-rate gauge now lives inside
 * AutomationPeriodStatsCard.tsx instead of a separate card duplicating
 * the same `automation-dashboard-stats` data), AiAgentsPlaceholderCard.tsx
 * (declined a mockup section — "Running AI Agents" — that this new
 * mockup no longer has, so there's nothing left to honestly decline),
 * and UpcomingJobsCard.tsx (its schedule-cadence info now shows per-card
 * in AutomationOverviewGrid.tsx instead of a separate sidebar list of the
 * same automations). See each remaining/replacing file's own docblock
 * for its specific real-data mapping.
 */
const AutomationOverviewTab = ({
	onManageAutomations,
}: AutomationOverviewTabProps) => {
	return (
		<ColumnComponent>
			<AutomationHeroRow onManageAutomations={onManageAutomations} />

			<ContainerComponent>
				<ColumnComponent grid={8}>
					<AutomationOverviewGrid
						onManageAutomations={onManageAutomations}
					/>
				</ColumnComponent>
				<ColumnComponent grid={4}>
					<AutomationAttentionCard onViewAll={onManageAutomations} />
				</ColumnComponent>
			</ContainerComponent>

			<AutomationPeriodStatsCard
				onScrollToCreate={onManageAutomations}
				onScrollToManage={onManageAutomations}
			/>

			<AutomationComposerCard />

			<ContainerComponent>
				<ColumnComponent grid={8}>
					<AutomationActivityCard />
				</ColumnComponent>
				<ColumnComponent grid={4}>
					<AiForemanCard onScrollToCreate={onManageAutomations} />
				</ColumnComponent>
			</ContainerComponent>

			<AutomationLinksRow onScrollToCreate={onManageAutomations} />

			<AutomationExploreBanner onExplore={onManageAutomations} />
		</ColumnComponent>
	);
};

export default AutomationOverviewTab;
