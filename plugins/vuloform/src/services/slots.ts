import type { ComponentType, ReactNode } from 'react';
import { applyFilters } from '@wordpress/hooks';
import type { Field, FormSettings } from './types';

/**
 * Extension points of the admin app. An extension (VuloForm Pro) registers with `addFilter()` from
 * `@wordpress/hooks` in its own script, which WordPress loads after this one and before the app
 * mounts. Each filter receives a list and returns it with entries added.
 */

/** `vuloform_admin_tabs`: a top-level screen, reached at `#&tab={tab}`. */
export interface AdminTab {
	tab: string;
	name: string;
	desc: string;
	Component: ComponentType;
}

/** `vuloform_settings_tabs`: a sub-tab of Settings, reached at `#&tab=settings&subtab={id}`. */
export interface SettingsTab {
	id: string;
	title: string;
	desc: string;
	icon: string;
	Component: ComponentType;
}

/** Layout pieces handed to a form-settings section, so it looks like the built-in ones. */
export interface SectionKit {
	Section: ComponentType<{ icon: string; title: string; desc?: ReactNode; action?: ReactNode; children: ReactNode }>;
	Row: ComponentType<{ label?: string; desc?: ReactNode; children: ReactNode }>;
	Wide: ComponentType<{ children: ReactNode }>;
	/** One collapsible line of a list, as notifications and webhooks use. */
	Item: ComponentType<{
		icon: string;
		name: string;
		fallbackName: string;
		// eslint-disable-next-line no-unused-vars
		onRename: (name: string) => void;
		summary: string;
		enabled: boolean;
		isOpen: boolean;
		onToggleOpen: () => void;
		// eslint-disable-next-line no-unused-vars
		onEnabled: (enabled: boolean) => void;
		onRemove: () => void;
		children: ReactNode;
	}>;
	// eslint-disable-next-line no-unused-vars
	Segmented: ComponentType<{ label: string; value: string; options: { value: string; label: string }[]; onChange: (value: string) => void }>;
	// eslint-disable-next-line no-unused-vars
	Switch: ComponentType<{ name: string; label: string; desc?: string; checked: boolean; onChange: (checked: boolean) => void }>;
}

/** `vuloform_form_settings_sections`: a sub-tab on the Settings tab of the builder. */
export interface FormSettingsSection {
	/** The extension id: the key its value is stored under in `settings.extensions`. */
	id: string;
	title: string;
	icon: string;
	/**
	 * `integrations` puts it inside the Integrations group, above the webhooks, instead of giving it
	 * a sub-tab. Its stored value should then keep its entries in an `items` array, which is what the
	 * count on the Integrations tab adds up.
	 */
	placement?: 'integrations';
	/**
	 * For `placement: 'integrations'`: what this extension adds to the form's one "Add integration"
	 * chooser, and how to add one. `add` returns the extension's new value; it must not change
	 * anything else. The component then draws the extension's entries and nothing around them.
	 */
	connectors?: { id: string; label: string; desc: string; icon?: string }[];
	// eslint-disable-next-line no-unused-vars
	add?: (connector: string, value: Record<string, unknown>, fields: Field[]) => Record<string, unknown>;
	Component: ComponentType<{
		ui: SectionKit;
		/** This extension's stored settings for the form (`settings.extensions[id]`). */
		value: Record<string, unknown>;
		// eslint-disable-next-line no-unused-vars
		onChange: (value: Record<string, unknown>) => void;
		settings: FormSettings;
		fields: Field[];
	}>;
}

/** `vuloform_inspector_sections`: a section in the settings of the selected field. */
export interface InspectorSection {
	id: string;
	// eslint-disable-next-line no-unused-vars
	applies: (field: Field) => boolean;
	Component: ComponentType<{
		field: Field;
		fields: Field[];
		// eslint-disable-next-line no-unused-vars
		onChange: (patch: Partial<Field>) => void;
	}>;
}

const list = <T>(hook: string): T[] => {
	const entries = applyFilters(hook, []);

	return Array.isArray(entries) ? (entries as T[]) : [];
};

export const adminTabs = () => list<AdminTab>('vuloform_admin_tabs');
export const settingsTabs = () => list<SettingsTab>('vuloform_settings_tabs');
export const formSettingsSections = () => list<FormSettingsSection>('vuloform_form_settings_sections');
export const inspectorSections = () => list<InspectorSection>('vuloform_inspector_sections');
