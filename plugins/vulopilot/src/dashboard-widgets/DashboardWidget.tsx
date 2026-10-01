import React from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent, TooltipComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';

interface DashboardWidgetProps {
	title: React.ReactNode;
	icon: string;
	isLoading?: boolean;
	onHide: () => void;
	isCustomizing: boolean;
	children: React.ReactNode;
	/** Passed straight through to CardComponent - e.g. BrandBreakdownWidget's pink accent. */
	borderColor?: string;
	/** Passed straight through to CardComponent - a short subtitle under the title. */
	desc?: React.ReactNode;
	/**
	 * An optional always-visible header link (e.g. "Show details" linking to another page).
	 */
	headerAction?: React.ReactNode;
}

/**
 * The one reusable shell every dashboard widget renders inside.
 */
const DashboardWidget: React.FC<DashboardWidgetProps> = ({
	title,
	icon,
	isLoading,
	onHide,
	isCustomizing,
	children,
	borderColor,
	desc,
	headerAction,
}) => {
	return (
		<CardComponent
			className={`dashboard-widget${isCustomizing ? ' is-customizing' : ''}`}
			titleIcon={icon}
			title={title}
			isLoading={isLoading}
			borderColor={borderColor}
			desc={desc}
			action={
				isCustomizing ? (
					<>
						<ButtonInput
							buttons={{
								text: __('Hide', 'vulopilot'),
								color: 'text-purple',
								icon: 'eye-blocked',
								onClick: onHide,
							}}
						/>
						<TooltipComponent text={__('Drag to reorder', 'vulopilot')}>
							{/* The whole button is the sortable handle (DashboardGrid.tsx's `handle=".widget-drag-handle"`), not just its icon. */}
							<span className="widget-drag-handle">
								<ButtonInput
									buttons={{
										color: 'purple',
										icon: 'move',
									}}
								/>
							</span>
						</TooltipComponent>
					</>
				) : (
					headerAction ?? undefined
				)
			}
		>
			{children}
		</CardComponent>
	);
};

export default DashboardWidget;
