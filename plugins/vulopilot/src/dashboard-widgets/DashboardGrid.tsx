/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { ReactSortable } from 'react-sortablejs';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import { ColumnComponent } from '@zyra/components';
import { DEFAULT_DASHBOARD_WIDGETS } from './registry';
import { DashboardSummary, WidgetLayoutEntry, WidgetDefinition } from './types';
import './DashboardGrid.scss';

interface DashboardGridProps {
	summary: DashboardSummary;
	isLoading: boolean;
	/** Gates drag/hide affordances — see Dashboard.tsx's own state comment. */
	isCustomizing: boolean;
}

/** What ReactSortable actually needs on every list item — see react-sortablejs's own usage in PanelEditor.tsx (Zyra's builders package) for this exact `list`/`setList` shape. */
interface SortableEntry extends WidgetLayoutEntry {
	key: string;
}

const WIDGETS_BY_ID = new Map(
	DEFAULT_DASHBOARD_WIDGETS.map((widget) => [widget.id, widget])
);

/**
 * The drag-and-drop widget grid — fetches the current user's saved
 * layout (`/dashboard-layout`, per-user meta, see
 * Controllers/DashboardLayout.php's docblock for why it's user meta and
 * not a site-wide setting), renders each enabled widget in saved order,
 * and persists a new order back whenever the user drags a widget.
 *
 * Uses `react-sortablejs`'s `ReactSortable` — not a new drag-and-drop
 * dependency: it's already a peer dependency of `@multivendorx/zyra` and
 * is the exact primitive Zyra's own builders package
 * (`PanelEditor.tsx`) uses for its drag-and-drop block canvas, so this
 * follows the dominant drag-and-drop pattern already established in this
 * monorepo rather than introducing a different library.
 *
 * `isCustomizing` (Dashboard.tsx's "Customize dashboard" header toggle)
 * gates whether any of this is reachable at all: when off, widgets render
 * in the same saved order as a plain (non-sortable) grid with no drag
 * handle/hide control and no hidden-widgets chip strip — a normal
 * read-only dashboard. The saved layout itself and the REST calls that
 * read/write it are unaffected either way.
 */
const DashboardGrid: React.FC<DashboardGridProps> = ({
	summary,
	isLoading,
	isCustomizing,
}) => {
	const [layout, setLayout] = useState<WidgetLayoutEntry[]>([]);
	const [isLayoutLoading, setIsLayoutLoading] = useState(true);

	useEffect(() => {
		getApiResponse<WidgetLayoutEntry[]>(
			getApiLink(appLocalizer, 'dashboard-layout'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setLayout(response);
				}
			})
			.finally(() => setIsLayoutLoading(false));
	}, []);

	const persistLayout = (nextLayout: WidgetLayoutEntry[]) => {
		setLayout(nextLayout);
		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, 'dashboard-layout'),
			{ widgets: nextLayout }
		);
	};

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
				className="dashboard-widget-cell"
			>
				<Widget
					summary={summary}
					isLoading={isLoading}
					onHide={() => handleHide(widget.id)}
					isCustomizing={isCustomizing}
				/>
			</ColumnComponent>
		);
	};

	return (
		<>
			{isCustomizing ? (
				// ReactSortable needs to own the actual sortable DOM node
				// itself (it takes a ref to it), so it can't render
				// ContainerComponent as a child the way the read-only
				// branch below does — `className` is set to the exact
				// same `container-wrapper general-wrapper` markup
				// ContainerComponent's own `general` variant renders
				// (ContainerComponent.tsx), so the grid looks and behaves
				// identically either way.
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
							<button
								key={widget.id}
								type="button"
								className="admin-badge dashboard-hidden-widget-chip"
								onClick={() => handleRestore(widget.id)}
							>
								<i className="adminfont-plus" />
								{widget.title}
							</button>
						);
					})}
				</div>
			)}
		</>
	);
};

export default DashboardGrid;
