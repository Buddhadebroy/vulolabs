import React from 'react';
import { ScoreRingComponent, ModuleGuardComponent } from '@zyra/components';
import DashboardWidget from './DashboardWidget';
import { DashboardSummary, WidgetProps } from './types';

export interface CategoryScoreWidgetConfig {
	id: string;
	title: string;
	icon: string;
	color: 'primary' | 'secondary' | 'accent' | 'good' | 'warn' | 'crit';
	/* eslint-disable no-unused-vars -- see StatWidget.tsx's identical disable for why */
	getScore: (summary: DashboardSummary) => number | null;
	getDesc: (summary: DashboardSummary) => React.ReactNode;
	getUnavailableState?: (
		summary: DashboardSummary
	) => { title: string; desc: string } | null;
	/* eslint-enable no-unused-vars */
}

interface CategoryScoreWidgetProps {
	config: CategoryScoreWidgetConfig;
	summary: DashboardSummary;
	isLoading: boolean;
	onHide: () => void;
	isCustomizing: boolean;
}

/**
 * Binds a CategoryScoreWidgetConfig into a WidgetProps-shaped component —
 * same config-driven factory pattern as StatWidget.tsx's
 * createStatWidgetComponent, applied to the mockup's 4 score-ring mini
 * cards (Visibility/Health/Commerce/Performance) instead of one-number
 * tiles. No sparkline/trend sub-label: there's no per-category historical
 * data to compute a real one from (registry.ts's own docblock note on
 * why the old per-category stat tiles were removed applies here too) —
 * getDesc supplies a static description instead of a fabricated delta.
 */
export const createCategoryScoreWidgetComponent = (
	config: CategoryScoreWidgetConfig
): React.FC<WidgetProps> => {
	const Component: React.FC<WidgetProps> = ({
		summary,
		isLoading,
		onHide,
		isCustomizing,
	}) => (
		<CategoryScoreWidget
			config={config}
			summary={summary}
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
		/>
	);
	Component.displayName = `CategoryScoreWidget(${config.id})`;
	return Component;
};

const CategoryScoreWidget: React.FC<CategoryScoreWidgetProps> = ({
	config,
	summary,
	isLoading,
	onHide,
	isCustomizing,
}) => {
	const unavailable = config.getUnavailableState?.(summary);
	const score = config.getScore(summary);

	return (
		<DashboardWidget
			title={config.title}
			icon={config.icon}
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
		>
			{unavailable ? (
				<ModuleGuardComponent
					icon={config.icon}
					title={unavailable.title}
					desc={unavailable.desc}
				/>
			) : (
				<div className="category-score-widget">
					<ScoreRingComponent
						score={score ?? 0}
						color={config.color}
						size={7}
						isLoading={isLoading}
					/>
					<div className="category-score-desc">
						{config.getDesc(summary)}
					</div>
				</div>
			)}
		</DashboardWidget>
	);
};

export default CategoryScoreWidget;
