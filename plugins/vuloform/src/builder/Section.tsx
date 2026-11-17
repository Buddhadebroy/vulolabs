import type { Dispatch, ReactNode } from 'react';
import { FormGroupComponent, FormGroupWrapperComponent } from '@zyra/components';

/**
 * The settings layout the other VuloLabs screens use: a panel of sections, each with its title and
 * explanation on the left and its settings on the right. The class names are zyra's own, so the
 * look comes from the shared design system rather than from VuloForm.
 */
export const Sections = ({ children }: { children: ReactNode }) => (
	<div className="admin-settings vuloform-sections">
		<div className="form-group-wrapper">{children}</div>
	</div>
);

interface SectionProps {
	icon: string;
	title: string;
	desc?: ReactNode;
	/** Shown under the description, for example a Remove button. */
	action?: ReactNode;
	children: ReactNode;
}

export const Section = ({ icon, title, desc, action, children }: SectionProps) => (
	<div className="settings-section-group">
		<div className="settings-left-section">
			<div className="divider-section">
				<div className="title-wrapper">
					<div className="typography typography-title">
						<i className={`adminfont-${icon}`} aria-hidden="true" />
						<span>{title}</span>
					</div>
				</div>
				{desc && <span className="typography typography-desc">{desc}</span>}
				{action && <div className="vuloform-section-action">{action}</div>}
			</div>
		</div>
		<div className="settings-right-section">
			<FormGroupWrapperComponent>{children}</FormGroupWrapperComponent>
		</div>
	</div>
);

/** One setting: its name and explanation, then its control. */
export const Row = ({ label, desc, children }: { label?: string; desc?: ReactNode; children: ReactNode }) => (
	<FormGroupComponent row label={label} desc={desc}>
		{children}
	</FormGroupComponent>
);

/** A setting that needs the full width, such as a switch or a notice. */
export const Wide = ({ children }: { children: ReactNode }) => <div className="form-group vuloform-wide">{children}</div>;

/** A choice between a few options that are all worth seeing at once. */
export const Segmented = ({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: Dispatch<string> }) => (
	<div className="vuloform-segmented" role="radiogroup" aria-label={label}>
		{options.map((option) => (
			<button
				type="button"
				role="radio"
				key={option.value}
				aria-checked={option.value === value}
				className={option.value === value ? 'is-active' : ''}
				onClick={() => onChange(option.value)}
			>
				{option.label}
			</button>
		))}
	</div>
);
