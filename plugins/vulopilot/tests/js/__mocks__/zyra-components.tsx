/**
 * Test double for '@zyra/components' — see zyra-core.js's own docblock for
 * why. Minimal markup, just enough structure for RTL's accessible queries
 * (role/text) to find what these tests actually assert on.
 *
 * `@zyra/components`, `@zyra/inputs`, `@zyra/table` and `@zyra/core` are
 * all webpack aliases onto the exact same published `@multivendorx/zyra`
 * package (one entry point — see its package.json's "exports" map), so
 * the real ButtonInput is reachable from any of them; some widgets import
 * it via `@zyra/components` (AISuggestionsWidget.tsx) and others via
 * `@zyra/inputs` (RunAuditWidget.tsx). Re-exported from the inputs mock
 * here so both import paths resolve the same test double, matching that
 * real-world behavior instead of only supporting one alias.
 */
import type { ReactElement, ReactNode } from 'react';
import { cloneElement, isValidElement, useState } from 'react';
export { ButtonInput } from './zyra-inputs';

export const CardComponent = ( {
	title,
	desc,
	action,
	children,
}: {
	title?: ReactNode;
	desc?: ReactNode;
	action?: ReactNode;
	children?: ReactNode;
} ) => (
	<section>
		{ title && <h2>{ title }</h2> }
		{ desc && <p>{ desc }</p> }
		{ action }
		{ children }
	</section>
);

export const ContainerComponent = ( {
	children,
}: {
	children?: ReactNode;
	general?: boolean;
} ) => <div>{ children }</div>;

export const ColumnComponent = ( { children }: { children?: ReactNode } ) => (
	<div>{ children }</div>
);

export const NavigatorHeaderComponent = ( {
	headerTitle,
	headerDescription,
}: {
	headerIcon?: string;
	headerTitle?: ReactNode;
	headerDescription?: ReactNode;
} ) => (
	<header>
		<h1>{ headerTitle }</h1>
		<p>{ headerDescription }</p>
	</header>
);

export const ModuleGuardComponent = ( {
	title,
	desc,
	buttonText,
	onButtonClick,
}: {
	icon?: string;
	title?: ReactNode;
	desc?: ReactNode;
	buttonText?: string;
	onButtonClick?: () => void;
} ) => (
	<div role="status">
		<strong>{ title }</strong>
		<p>{ desc }</p>
		{ buttonText && (
			<button onClick={ onButtonClick }>{ buttonText }</button>
		) }
	</div>
);

/** Real usage: HistoryDetailPanel.tsx wraps its per-category detail sections in this. */
export const FormGroupWrapperComponent = ( {
	children,
}: {
	children?: ReactNode;
} ) => <div>{ children }</div>;

/** Real usage: HistoryDetailPanel.tsx's own scan-row "Status"/"Findings" rows. */
export const FormGroupComponent = ( {
	label,
	children,
}: {
	row?: boolean;
	label?: ReactNode;
	children?: ReactNode;
} ) => (
	<div>
		{ label && <span>{ label }</span> }
		{ children }
	</div>
);

export const AnalyticsComponent = ( {
	data,
}: {
	variant?: string;
	cols?: number;
	data: Array< { icon?: string; number: ReactNode; text: ReactNode } >;
} ) => (
	<dl>
		{ data.map( ( item, index ) => (
			<div key={ index }>
				<dt>{ item.text }</dt>
				<dd>{ item.number }</dd>
			</div>
		) ) }
	</dl>
);

export const NoticeManager = {
	add: jest.fn(),
};

export const PopupComponent = ( {
	open,
	children,
}: {
	open: boolean;
	onClose?: () => void;
	width?: number;
	height?: string | number;
	position?: string;
	children?: ReactNode;
} ) => ( open ? <div role="dialog">{ children }</div> : null );

interface Tab {
	label: string;
	content?: ReactNode;
}

export const TabsComponent = ( {
	tabs,
	defaultActiveIndex = 0,
	activeIndex: controlledActiveIndex,
	onTabChange,
}: {
	tabs: Tab[];
	className?: string;
	defaultActiveIndex?: number;
	activeIndex?: number;
	onTabChange?: ( index: number ) => void;
} ) => {
	const [ internalIndex, setInternalIndex ] = useState( defaultActiveIndex );
	const activeIndex = controlledActiveIndex ?? internalIndex;

	return (
		<div>
			<div role="tablist">
				{ tabs.map( ( tab, index ) => (
					<button
						key={ tab.label }
						role="tab"
						aria-selected={ index === activeIndex }
						onClick={ () => {
							setInternalIndex( index );
							onTabChange?.( index );
						} }
					>
						{ tab.label }
					</button>
				) ) }
			</div>
			<div>{ tabs[ activeIndex ]?.content }</div>
		</div>
	);
};

interface ListItem {
	id?: string;
	title?: string;
	desc?: string;
	value?: string;
	tags?: ReactNode;
	action?: () => void;
	onApprove?: () => void;
	onReject?: () => void;
}

export const ListComponent = ( { items }: { items: ListItem[] } ) => (
	<ul>
		{ items.map( ( item, index ) => {
			// Real "mini-card"/"report" rows show title and desc as two
			// separate lines when both are given (AICopilot.scss's own
			// `.details .item-title`/`.details .desc` target them
			// independently) — `item.title ?? item.desc` alone only covers
			// the "one or the other" rows (e.g. KnowledgeGraphWidget's
			// desc-only items), not both together (e.g. NeedsAttentionCard's
			// title+desc rows).
			const label = ( item.title || item.desc ) && (
				<>
					{ item.title && <span>{ item.title }</span> }
					{ item.desc && <span>{ item.desc }</span> }
				</>
			);

			return (
				<li key={ item.id ?? index }>
					{ item.action ? (
						<button onClick={ item.action }>{ label }</button>
					) : (
						<span>{ label }</span>
					) }
					{ item.value && <span>{ item.value }</span> }
					{ item.tags }
					{ item.onApprove && (
						<button onClick={ item.onApprove }>Approve</button>
					) }
					{ item.onReject && (
						<button onClick={ item.onReject }>Reject</button>
					) }
				</li>
			);
		} ) }
	</ul>
);

interface InformationItemDescription {
	value: ReactNode;
}

interface InformationItemBadge {
	text: string;
	className?: string;
}

/** Real usages: FindingsTable.tsx (compact layout), IssuesList.tsx, AiWorkflowsList.tsx, NeedsAttentionCard.tsx. */
export const InformationItemComponent = ( {
	title,
	isLoading,
	onClick,
	descriptions,
	badges,
	rightContent,
}: {
	title?: ReactNode;
	isLoading?: boolean;
	onClick?: () => void;
	avatar?: { iconClass?: string; color?: string };
	descriptions?: InformationItemDescription[];
	badges?: InformationItemBadge[];
	rightContent?: ReactNode;
} ) => {
	if ( isLoading ) {
		return <div className="info-item-wrapper" aria-busy="true" />;
	}

	const content = (
		<>
			<span>{ title }</span>
			{ badges?.map( ( badge, index ) => (
				<span key={ index }>{ badge.text }</span>
			) ) }
			{ descriptions?.map( ( description, index ) => (
				<span key={ index }>{ description.value }</span>
			) ) }
			{ rightContent }
		</>
	);

	return onClick ? (
		<button onClick={ onClick }>{ content }</button>
	) : (
		<div>{ content }</div>
	);
};

interface ActivityAction {
	label: string;
	onClick?: () => void;
	disabled?: boolean;
}

interface ActivityItem {
	id: string;
	title: ReactNode;
	badge?: ReactNode;
	timestamp?: ReactNode;
	action?: ActivityAction;
}

export const ActivityListComponent = ( {
	items,
}: {
	items: ActivityItem[];
	isLoading?: boolean;
} ) => (
	<ul>
		{ items.map( ( item ) => (
			<li key={ item.id }>
				<span>{ item.title }</span>
				{ item.badge }
				{ item.timestamp }
				{ item.action && (
					<button
						onClick={ item.action.onClick }
						disabled={ item.action.disabled }
					>
						{ item.action.label }
					</button>
				) }
			</li>
		) ) }
	</ul>
);

export const ChartComponent = ( {
	type,
	data,
	centerLabel,
}: {
	type: string;
	data: unknown[];
	centerLabel?: ReactNode;
	[ key: string ]: unknown;
} ) => (
	<div data-testid={ `chart-${ type }` }>
		{ centerLabel }
		{ `${ data.length } points` }
	</div>
);

/**
 * Clones the tooltip's `text` onto its child as `aria-label` rather than
 * just passing children through — several widgets (DashboardWidget.tsx's
 * drag/hide controls) rely on the tooltip to be the icon-only child's only
 * accessible name, and an aria-label-less button is unqueryable by RTL's
 * accessible-name matchers.
 */
export const TooltipComponent = ( {
	text,
	children,
}: {
	text?: string;
	children?: ReactNode;
} ) =>
	isValidElement( children )
		? cloneElement( children as ReactElement< { 'aria-label'?: string } >, {
				'aria-label': text,
			} )
		: children;

export const TrendIndicatorComponent = ( {
	value,
	suffix = '%',
}: {
	value: number;
	suffix?: string;
	decimals?: number;
} ) => (
	<span>
		{ value >= 0 ? '+' : '' }
		{ value }
		{ suffix }
	</span>
);

interface TrendStatItem {
	icon: string;
	label: string;
	value: string | number;
	badge?: { text: string; color: string };
}

/**
 * `trend-stat-list`/`trend-stat-tile` mirror the real compiled component's
 * own classNames (no other distinguishing id/data attribute exists on a
 * real tile) — IssuesSummaryCards.tsx delegates its priority-tile clicks by
 * walking up to the nearest `.trend-stat-tile` and reading its position
 * among siblings, so a mock without these classes would silently no-op
 * every click in a test.
 */
export const TrendStatComponent = ( {
	items,
	isLoading,
}: {
	items: TrendStatItem[];
	cols?: number;
	isLoading?: boolean;
} ) => (
	<div className="trend-stat-list">
		{ items.map( ( item, index ) => (
			<div className="trend-stat-tile" key={ index }>
				<span>{ item.label }</span>
				{ isLoading ? (
					<span>Loading…</span>
				) : (
					<>
						<span>{ item.value }</span>
						{ item.badge && <span>{ item.badge.text }</span> }
					</>
				) }
			</div>
		) ) }
	</div>
);
