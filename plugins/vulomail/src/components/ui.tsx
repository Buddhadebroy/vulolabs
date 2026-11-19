import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';

/**
 * VuloMail's own building blocks, drawn the way VuloCart draws its admin (vulocart/src/pages/Dashboard): white
 * cards with a hairline border and a small bordered icon tile beside the title, KPI tiles, a segmented control,
 * status pills, empty states and loading placeholders. Every screen uses these instead of its own copies, so
 * type sizes, spacing and colours stay the same everywhere. Styles: ui.scss.
 */

export type Tone = 'neutral' | 'violet' | 'blue' | 'green' | 'amber' | 'red';
export type Status = 'good' | 'warn' | 'bad' | 'off' | 'info';

/** A zyra icon, hidden from screen readers. */
export const Icon = ({ name }: { name: string }) => <i className={`adminfont-${name}`} aria-hidden="true" />;

/** A rounded square holding an icon, tinted by tone. */
export const IconTile = ({ icon, tone = 'neutral', size = 'md' }: { icon: string; tone?: Tone; size?: 'sm' | 'md' | 'lg' }) => (
	<span className={`vm-icon is-${tone} is-${size}`} aria-hidden="true">
		<i className={`adminfont-${icon}`} />
	</span>
);

/** A white card: an optional icon tile, the title and one line, an action or link on the right, then content. */
export const Card = ({
	id,
	title,
	icon,
	desc,
	action,
	link,
	className = '',
	children,
}: {
	id?: string;
	title?: string;
	icon?: string;
	desc?: ReactNode;
	action?: ReactNode;
	link?: { label: string; href: string };
	className?: string;
	children: ReactNode;
}) => (
	<section className={`vm-card ${className}`.trim()} id={id}>
		{title && (
			<header className="vm-card-head">
				<div className="vm-card-title">
					{icon && (
						<span className="vm-card-icon" aria-hidden="true">
							<i className={`adminfont-${icon}`} />
						</span>
					)}
					<div>
						<h3>{title}</h3>
						{desc && <p>{desc}</p>}
					</div>
				</div>
				{(action || link) && (
					<div className="vm-card-actions">
						{action}
						{link && (
							<a className="vm-card-link" href={link.href}>
								{link.label}
								<i className="adminfont-arrow-right" aria-hidden="true" />
							</a>
						)}
					</div>
				)}
			</header>
		)}
		<div className="vm-card-body">{children}</div>
	</section>
);

/** A heading between groups of cards ("Performance"), with an optional control on the right. */
export const SectionHead = ({ title, children }: { title: string; children?: ReactNode }) => (
	<div className="vm-section-head">
		<h2>{title}</h2>
		{children}
	</div>
);

/** One grey track, the chosen option a raised white tab. */
export const Segmented = ({
	options,
	value,
	onChange,
	label,
	size = 'md',
	stretch = false,
}: {
	options: { value: string; label: string; icon?: string }[];
	value: string;
	// eslint-disable-next-line no-unused-vars -- parameter name in a type signature, not a variable.
	onChange: (next: string) => void;
	label: string;
	size?: 'sm' | 'md';
	stretch?: boolean;
}) => (
	<div className={`vm-seg is-${size}${stretch ? ' is-stretch' : ''}`} role="group" aria-label={label}>
		{options.map((option) => (
			<button
				key={option.value}
				type="button"
				className={value === option.value ? 'is-active' : ''}
				aria-pressed={value === option.value}
				onClick={() => onChange(option.value)}
			>
				{option.icon && <i className={`adminfont-${option.icon}`} aria-hidden="true" />}
				{option.label}
			</button>
		))}
	</div>
);

/** A change against the previous period as a coloured chip; nothing when there is nothing to compare. */
const Delta = ({ change, inverse = false }: { change: number | null; inverse?: boolean }) => {
	if (null === change || 0 === change || !Number.isFinite(change)) {
		return null;
	}

	const good = inverse ? change < 0 : change > 0;

	return (
		<span className={`vm-delta ${good ? 'is-good' : 'is-bad'}`}>
			<i className={`adminfont-arrow-${change > 0 ? 'up' : 'down'}`} aria-hidden="true" />
			{Math.abs(change)}%
		</span>
	);
};

/** Percentage change from `before` to `now`, or null when there is no "before" to compare with. */
export const percentChange = (now: number, before: number): number | null =>
	before > 0 ? Math.round(((now - before) / before) * 100) : null;

/** One KPI tile: icon and label, the figure with its change, one line of context. A link when `href` is set. */
export const Kpi = ({
	icon,
	label,
	value,
	hint,
	change = null,
	inverse = false,
	href,
	tone,
}: {
	icon: string;
	label: string;
	value: ReactNode;
	hint?: ReactNode;
	change?: number | null;
	inverse?: boolean;
	href?: string;
	tone?: Tone;
}) => {
	const inner = (
		<>
			<span className="vm-kpi-label">
				<span className="vm-kpi-icon" aria-hidden="true">
					<i className={`adminfont-${icon}`} />
				</span>
				{label}
			</span>
			<span className="vm-kpi-value">
				{value}
				<Delta change={change} inverse={inverse} />
			</span>
			{hint && <span className="vm-kpi-hint">{hint}</span>}
		</>
	);
	const className = `vm-kpi${tone ? ` is-${tone}` : ''}`;

	return href ? (
		<a className={className} href={href}>
			{inner}
		</a>
	) : (
		<div className={className}>{inner}</div>
	);
};

export const KpiGrid = ({ label, children, cols = 4 }: { label: string; children: ReactNode; cols?: 3 | 4 }) => (
	<section className={`vm-kpis is-${cols}`} aria-label={label}>
		{children}
	</section>
);

/** A state as a coloured dot and a word ("● Working"). */
export const Pill = ({ status, children }: { status: Status; children: ReactNode }) => (
	<span className={`vm-pill is-${status}`}>{children}</span>
);

/** What a card shows when it has nothing yet: an icon tile, one bold line, one quiet line, an optional action. */
export const EmptyState = ({
	icon,
	tone = 'violet',
	title,
	text,
	action,
	compact = false,
}: {
	icon: string;
	tone?: Tone;
	title: string;
	text?: ReactNode;
	action?: ReactNode;
	compact?: boolean;
}) => (
	<div className={`vm-empty${compact ? ' is-compact' : ''}`}>
		<IconTile icon={icon} tone={tone} size={compact ? 'md' : 'lg'} />
		<div className="vm-empty-text">
			<strong>{title}</strong>
			{text && <span>{text}</span>}
		</div>
		{action && <div className="vm-empty-action">{action}</div>}
	</div>
);

/** A shimmering placeholder while data loads. */
export const Skeleton = ({ size = 'row' }: { size?: 'row' | 'block' | 'hero' | 'chart' | 'tall' }) => (
	<div className={`vm-skel is-${size}`} aria-hidden="true" />
);

/** An accessible on/off switch. */
export const Switch = ({
	checked,
	onChange,
	label,
	disabled = false,
}: {
	checked: boolean;
	onChange: () => void;
	label: string;
	disabled?: boolean;
}) => (
	<label className={`vulomail-switch${disabled ? ' is-disabled' : ''}`}>
		<input type="checkbox" role="switch" checked={checked} onChange={onChange} aria-label={label} disabled={disabled} />
		<span className="vulomail-switch-track" />
	</label>
);

/** "Good morning", "Good afternoon" or "Good evening" for the current hour. */
export const greeting = (): string => {
	const hour = new Date().getHours();

	if (hour < 12) {
		return __('Good morning', 'vulomail');
	}

	return hour < 18 ? __('Good afternoon', 'vulomail') : __('Good evening', 'vulomail');
};
