/* global vulopilotAppLocalizer */
import React, { useEffect, useRef, useState } from 'react';
import { ReactSortable } from 'react-sortablejs';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import { ColumnComponent, BadgeComponent } from '@zyra/components';
import { DEFAULT_DASHBOARD_WIDGETS } from './registry';
import { DashboardSummary, WidgetLayoutEntry } from './types';
import './DashboardGrid.scss';

interface DashboardGridProps {
	summary: DashboardSummary;
	isLoading: boolean;
	/** Gates drag/hide affordances - see Dashboard.tsx's own state comment. */
	isCustomizing: boolean;
	/**
	 * Incremented by Dashboard.tsx's "Restore default" header button.
	 */
	restoreDefaultSignal?: number;
	/** Forwarded straight through to every widget's own `onRefreshSummary` (WidgetProps' own docblock) - Dashboard.tsx's own `loadDashboard`. */
	onRefreshSummary: () => void;
}

/** What ReactSortable actually needs on every list item. */
interface SortableEntry extends WidgetLayoutEntry {
	key: string;
}

const WIDGETS_BY_ID = new Map(
	DEFAULT_DASHBOARD_WIDGETS.map((widget) => [widget.id, widget])
);

/**
 * Drag-and-drop widget grid: loads the user's saved layout, renders enabled widgets in order and
 * saves a new order on drag.
 */
const DashboardGrid: React.FC<DashboardGridProps> = ({
	summary,
	isLoading,
	isCustomizing,
	restoreDefaultSignal,
	onRefreshSummary,
}) => {
	const [layout, setLayout] = useState<WidgetLayoutEntry[]>([]);
	const [isLayoutLoading, setIsLayoutLoading] = useState(true);

	useEffect(() => {
		getApiResponse<WidgetLayoutEntry[]>(
			getApiLink(vulopilotAppLocalizer, 'dashboard-layout'),
			{ headers: { 'X-WP-Nonce': vulopilotAppLocalizer.nonce } }
		)
			.then((response) => {
				// DashboardLayout.php's get_items() always reconciles against every registered
				// widget id and returns a non-empty array on success.
				if (response && response.length > 0) {
					setLayout(response);
				} else {
					setLayout(
						DEFAULT_DASHBOARD_WIDGETS.map((widget) => ({
							id: widget.id,
							enabled: true,
						}))
					);
				}
			})
			.finally(() => setIsLayoutLoading(false));
	}, []);

	const persistLayout = (nextLayout: WidgetLayoutEntry[]) => {
		setLayout(nextLayout);
		sendApiResponse(
			vulopilotAppLocalizer,
			getApiLink(vulopilotAppLocalizer, 'dashboard-layout'),
			{ widgets: nextLayout }
		);
	};

	// `restoreDefaultSignal` starts at 0 and only ever increments from a real button click
	// (Dashboard.tsx).
	const isFirstRestoreRender = useRef(true);
	useEffect(() => {
		if (isFirstRestoreRender.current) {
			isFirstRestoreRender.current = false;
			return;
		}

		persistLayout(
			DEFAULT_DASHBOARD_WIDGETS.map((widget) => ({
				id: widget.id,
				enabled: true,
			}))
		);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [restoreDefaultSignal]);

	const handleHide = (id: string) => {
		persistLayout(
			layout.map((entry) =>
				entry.id === id ? { ...entry, enabled: false } : entry
			)
		);
	};

	const handleRestore = (id: string) => {
		persistLayout(
			layout.map((entry) =>
				entry.id === id ? { ...entry, enabled: true } : entry
			)
		);
	};

	const handleReorder = (newVisibleOrder: SortableEntry[]) => {
		const hidden = layout.filter((entry) => !entry.enabled);
		persistLayout([
			...newVisibleOrder.map(({ id, enabled }) => ({ id, enabled })),
			...hidden,
		]);
	};

	if (isLoading || isLayoutLoading) {
		return (
			<>
				{DEFAULT_DASHBOARD_WIDGETS.slice(0, 4).map((widget) => {
					const Widget = widget.component;
					return (
						<ColumnComponent
							key={widget.id}
							grid={widget.grid}
							className="dashboard-widget-cell"
						>
							<Widget
								summary={summary}
								isLoading
								onHide={() => {}}
								isCustomizing={false}
							/>
						</ColumnComponent>
					);
				})}
			</>
		);
	}

	const visible: SortableEntry[] = layout
		.filter((entry) => entry.enabled && WIDGETS_BY_ID.has(entry.id))
		.map((entry) => ({ ...entry, key: entry.id }));

	const hidden = layout.filter(
		(entry) => !entry.enabled && WIDGETS_BY_ID.has(entry.id)
	);

	const renderWidgetCell = (entry: SortableEntry) => {
		const widget = WIDGETS_BY_ID.get(entry.id);
		if (!widget) {
			return null;
		}
		const Widget = widget.component;
		return (
			<ColumnComponent
				key={widget.id}
				grid={widget.grid}
				className={`dashboard-widget-cell${isCustomizing ? ' is-customizing' : ''}`}
			>
				<Widget
					summary={summary}
					isLoading={isLoading}
					onHide={() => handleHide(widget.id)}
					isCustomizing={isCustomizing}
					onRefreshSummary={onRefreshSummary}
				/>
			</ColumnComponent>
		);
	};

	return (
		<>
			{isCustomizing ? (
				// ReactSortable needs to own the actual sortable DOM node itself (it takes a ref
				// to it).
				<ReactSortable
					list={visible}
					setList={handleReorder}
					handle=".widget-drag-handle"
					animation={150}
					className="container-wrapper"
				>
					{visible.map(renderWidgetCell)}
				</ReactSortable>
			) : (
				<>{visible.map(renderWidgetCell)}</>
			)}

			{isCustomizing && hidden.length > 0 && (
				<div className="dashboard-hidden-widgets">
					<span className="dashboard-hidden-widgets-label">
						{__('Hidden widgets:', 'vulopilot')}
					</span>
					{hidden.map((entry) => {
						const widget = WIDGETS_BY_ID.get(entry.id);
						if (!widget) {
							return null;
						}
						return (
							<BadgeComponent
								key={widget.id}
								className="dashboard-hidden-widget-chip"
								icon="plus"
								text={widget.title}
								role="button"
								tabIndex={0}
								onClick={() => handleRestore(widget.id)}
							/>
						);
					})}
				</div>
			)}
		</>
	);
};

export default DashboardGrid;
