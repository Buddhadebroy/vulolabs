// Copied from vulocart/src/components/TableCard (VuloCart Free) with TableCard.tsx; keep the two in step.
/* eslint-disable no-unused-vars -- `row` below names parameters in type signatures, not variables. */
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { IconComponent, TooltipComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';

type Row = Record<string, unknown>;
type Value<T> = T | ((row: Row) => T);

/** One entry of a table column's `actions` (same shape zyra's `type: 'action'` column takes). */
export interface RowAction {
	label: Value<string>;
	icon?: Value<string | ReactNode>;
	color?: Value<string>;
	className?: string;
	/** `button`: a worded action (Approve, Adjust stock). Anything else is an icon action. */
	type?: string;
	hidden?: (row: Row) => boolean;
	 
	onClick: (row: Row) => void;
}

/** Up to this many icon actions show inline; past it, the first two do and the rest go in the "more" menu. */
export const MAX_INLINE_ACTIONS = 4;
const INLINE_WHEN_OVERFLOWING = 2;

const resolve = <T,>(value: Value<T> | undefined, row: Row) =>
	'function' === typeof value ? (value as (row: Row) => T)(row) : value;

/**
 * A row's actions, in zyra's own markup (so the table styles in app.scss apply unchanged), with a different overflow
 * rule: zyra always shows two icons and puts the rest behind "more"; here every icon shows while there are at most
 * four, and only a fifth one sends all but the first two into the menu. Worded actions (`type: 'button'`) come first.
 */
export function RowActions({
	row,
	actions,
}: {
	row: Row;
	actions: RowAction[];
}) {
	const [open, setOpen] = useState(false);
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!open) {
			return undefined;
		}

		const close = (event: MouseEvent) => {
			if (!ref.current?.contains(event.target as Node)) {
				setOpen(false);
			}
		};
		const onKey = (event: KeyboardEvent) =>
			'Escape' === event.key && setOpen(false);

		document.addEventListener('mousedown', close);
		document.addEventListener('keydown', onKey);

		return () => {
			document.removeEventListener('mousedown', close);
			document.removeEventListener('keydown', onKey);
		};
	}, [open]);

	const visible = actions.filter((action) => !action.hidden?.(row));
	const worded = visible.filter((action) => 'button' === action.type);
	const icons = visible.filter((action) => 'button' !== action.type);
	const overflowing = icons.length > MAX_INLINE_ACTIONS;
	const inline = overflowing
		? icons.slice(0, INLINE_WHEN_OVERFLOWING)
		: icons;
	const menu = overflowing ? icons.slice(INLINE_WHEN_OVERFLOWING) : [];

	return (
		<div className="table-action" ref={ref}>
			{worded.length > 0 && (
				<div className="table-action-buttons">
					{worded.map((action, index) => {
						const icon = resolve(action.icon, row);

						return (
							<ButtonInput
								key={index}
								buttons={{
									text: resolve(action.label, row) ?? '',
									rightIcon:
										'string' === typeof icon
											? icon
											: 'pagination-next-arrow',
									color:
										resolve(action.color, row) ??
										'text-purple',
									className: action.className,
									onClick: () => action.onClick(row),
								}}
							/>
						);
					})}
				</div>
			)}
			{inline.length > 0 && (
				<div className="inline-actions">
					{inline.map((action, index) => (
						<TooltipComponent
							key={index}
							text={resolve(action.label, row) ?? ''}
							position="top-right"
						>
							<IconComponent
								name={String(resolve(action.icon, row) ?? '')}
								onClick={() => action.onClick(row)}
							/>
						</TooltipComponent>
					))}
				</div>
			)}
			{menu.length > 0 && (
				<div className="action-icons">
					<IconComponent
						name="more-vertical"
						onClick={() => setOpen((value) => !value)}
					/>
					<div className={`action-dropdown ${open ? 'show' : ''}`}>
						<ul>
							{menu.map((action, index) => (
								<li
									key={index}
									role="button"
									tabIndex={0}
									onClick={() => {
										action.onClick(row);
										setOpen(false);
									}}
									onKeyDown={(event) => {
										if (
											'Enter' === event.key ||
											' ' === event.key
										) {
											event.preventDefault();
											action.onClick(row);
											setOpen(false);
										}
									}}
								>
									<IconComponent
										name={String(
											resolve(action.icon, row) ?? ''
										)}
									/>
									<span className="tooltip-name">
										{resolve(action.label, row)}
									</span>
								</li>
							))}
						</ul>
					</div>
				</div>
			)}
		</div>
	);
}

export default RowActions;
