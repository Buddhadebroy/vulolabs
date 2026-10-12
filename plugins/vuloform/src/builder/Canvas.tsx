import type { ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { ReactSortable } from 'react-sortablejs';
import { BadgeComponent } from '@zyra/components';
import type { Field } from '../services/types';
import { createField, fieldType, fieldTypes } from './fields';

interface CanvasProps {
	fields: Field[];
	selectedId: string;
	// eslint-disable-next-line no-unused-vars
	onChange: (fields: Field[], selectId?: string) => void;
	// eslint-disable-next-line no-unused-vars
	onSelect: (id: string) => void;
	// eslint-disable-next-line no-unused-vars
	onDuplicate: (id: string) => void;
	// eslint-disable-next-line no-unused-vars
	onDelete: (id: string) => void;
	/** Shown under the fields: what belongs to the form as a whole but is managed alongside them. */
	footer?: ReactNode;
}

/** What the palette hands to the canvas when a field type is dragged across. */
interface PaletteItem {
	id: string;
	paletteType: string;
}

const GROUPS: { id: string; label: string }[] = [
	{ id: 'basic', label: __('Questions', 'vuloform') },
	{ id: 'layout', label: __('Text and layout', 'vuloform') },
	{ id: 'advanced', label: __('Special fields', 'vuloform') },
];

const SORT_GROUP = 'vuloform-fields';

/**
 * The field library and the form canvas.
 *
 * A field is added by dragging its type onto the canvas, or by clicking it (or pressing Enter on
 * it), which appends it after the selected field. Fields are reordered by dragging their handle or
 * with the Move up / Move down buttons, so everything works without a pointer.
 */
const Canvas = ({ fields, selectedId, onChange, onSelect, onDuplicate, onDelete, footer }: CanvasProps) => {
	const add = (type: string) => {
		const field = createField(type, fields);
		const index = fields.findIndex((item) => item.id === selectedId);
		const next = [...fields];

		next.splice(index >= 0 ? index + 1 : next.length, 0, field);
		onChange(next, field.id);
	};

	const move = (index: number, delta: number) => {
		const target = index + delta;

		if (target < 0 || target >= fields.length) {
			return;
		}

		const next = [...fields];

		[next[index], next[target]] = [next[target], next[index]];
		onChange(next);
	};

	/** Sortable reports the canvas list after a drop; a palette item in it becomes a real field. */
	const handleSetList = (list: (Field | PaletteItem)[]) => {
		let added = '';
		const next: Field[] = [];

		list.forEach((item) => {
			if ('paletteType' in item) {
				const field = createField(item.paletteType as string, [...fields, ...next]);

				added = field.id;
				next.push(field);
			} else {
				// Sortable decorates items with its own flags; keep only the field.
				const { chosen, selected, filtered, ...field } = item as Field & Record<string, unknown>;

				void chosen;
				void selected;
				void filtered;
				next.push(field as Field);
			}
		});

		const changed = added || next.length !== fields.length || next.some((field, index) => field.id !== fields[index]?.id);

		if (changed) {
			onChange(next, added || undefined);
		}
	};

	let page = 1;

	return (
		<div className="vuloform-builder-main">
			<aside className="vuloform-palette" aria-label={__('Field library', 'vuloform')}>
				<div className="vuloform-palette-head">
					<i className="adminfont-plus" aria-hidden="true" />
					<span className="vuloform-palette-head-text">
						<strong>{__('Add a field', 'vuloform')}</strong>
						<span>{__('Click one, or drag it onto the form.', 'vuloform')}</span>
					</span>
				</div>
				<div className="vuloform-palette-body">
				{GROUPS.map((group) => {
					const items: PaletteItem[] = fieldTypes()
						.filter((type) => type.group === group.id)
						.map((type) => ({ id: `palette-${type.id}`, paletteType: type.id }));

					return (
						<div className="vuloform-palette-group" key={group.id}>
							<h3>{group.label}</h3>
							<ReactSortable
								list={items}
								setList={() => {}}
								sort={false}
								group={{ name: SORT_GROUP, pull: 'clone', put: false }}
								className="vuloform-palette-items"
							>
								{items.map((item) => {
									const type = fieldType(item.paletteType);

									return (
										<button
											type="button"
											className="vuloform-palette-item"
											key={item.id}
											onClick={() => add(item.paletteType)}
										>
											<i className={`adminfont-${type?.icon}`} aria-hidden="true" />
											<span>{type?.label}</span>
										</button>
									);
								})}
							</ReactSortable>
						</div>
					);
				})}
				</div>
			</aside>
			<section className="vuloform-canvas" aria-label={__('Form', 'vuloform')}>
				{0 === fields.length && (
					<div className="vuloform-canvas-empty">
						<i className="adminfont-form" aria-hidden="true" />
						<strong>{__('Your form is empty', 'vuloform')}</strong>
						<span>{__('Drag a field here, or click one in the field library on the left.', 'vuloform')}</span>
					</div>
				)}
				<ReactSortable
					list={fields}
					setList={handleSetList}
					group={{ name: SORT_GROUP, pull: false, put: true }}
					handle=".vuloform-card-handle"
					animation={150}
					className={`vuloform-canvas-list${0 === fields.length ? ' is-empty' : ''}`}
				>
					{fields.map((field, index) => {
						const type = fieldType(field.type);
						const isBreak = 'page_break' === field.type;

						if (isBreak) {
							page++;
						}

						return (
							<div
								key={field.id}
								className={`vuloform-card vuloform-card-w${field.width}${field.id === selectedId ? ' is-selected' : ''}${
									isBreak ? ' is-break' : ''
								}`}
							>
								<span className="vuloform-card-handle" title={__('Drag to reorder', 'vuloform')} aria-hidden="true">
									<i className="adminfont-drag" />
								</span>
								<button type="button" className="vuloform-card-body" onClick={() => onSelect(field.id)}>
									<i className={`adminfont-${type?.icon ?? 'lock'}`} aria-hidden="true" />
									<span className="vuloform-card-text">
										<strong>
											{isBreak
												? sprintf(
														/* translators: %d: page number. */
														__('Page %d starts here', 'vuloform'),
														page
												  )
												: field.label || type?.label}
											{field.required && (
												<span className="vuloform-card-required" title={__('Required', 'vuloform')}>
													{' '}
													*
												</span>
											)}
										</strong>
										<span>{type?.label ?? __('Needs an extension that is not active', 'vuloform')}</span>
									</span>
									{field.conditions?.enabled && field.conditions.rules.length > 0 && (
										<BadgeComponent color="blue" text={__('Conditional', 'vuloform')} />
									)}
								</button>
								<span className="vuloform-card-actions">
									<button
										type="button"
										onClick={() => move(index, -1)}
										disabled={0 === index}
										aria-label={sprintf(
											/* translators: %s: field label. */
											__('Move %s up', 'vuloform'),
											field.label
										)}
									>
										<i className="adminfont-arrow-up" aria-hidden="true" />
									</button>
									<button
										type="button"
										onClick={() => move(index, 1)}
										disabled={index === fields.length - 1}
										aria-label={sprintf(
											/* translators: %s: field label. */
											__('Move %s down', 'vuloform'),
											field.label
										)}
									>
										<i className="adminfont-arrow-down" aria-hidden="true" />
									</button>
									<button
										type="button"
										onClick={() => onDuplicate(field.id)}
										aria-label={sprintf(
											/* translators: %s: field label. */
											__('Duplicate %s', 'vuloform'),
											field.label
										)}
									>
										<i className="adminfont-copy" aria-hidden="true" />
									</button>
									<button
										type="button"
										className="is-danger"
										onClick={() => onDelete(field.id)}
										aria-label={sprintf(
											/* translators: %s: field label. */
											__('Delete %s', 'vuloform'),
											field.label
										)}
									>
										<i className="adminfont-delete" aria-hidden="true" />
									</button>
								</span>
							</div>
						);
					})}
				</ReactSortable>
				{footer}
			</section>
		</div>
	);
};

export default Canvas;
