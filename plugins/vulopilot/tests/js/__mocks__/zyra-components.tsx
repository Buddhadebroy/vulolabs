/**
 * Test double for '@zyra/components' — see zyra-core.js's own docblock for
 * why. Minimal markup, just enough structure for RTL's accessible queries
 * (role/text) to find what these tests actually assert on.
 */
import type { ReactNode } from 'react';

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
}: {
	icon?: string;
	title?: ReactNode;
	desc?: ReactNode;
} ) => (
	<div role="status">
		<strong>{ title }</strong>
		<p>{ desc }</p>
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
