import type { ComponentType } from 'react';
import { applyFilters } from '@wordpress/hooks';
import type { FormSettingsSection, InspectorSection } from '@zyra/builderform';

export type { FormSettingsSection, InspectorSection, SectionKit } from '@zyra/builderform';

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

const list = <T>(hook: string): T[] => {
	const entries = applyFilters(hook, []);

	return Array.isArray(entries) ? (entries as T[]) : [];
};

export const adminTabs = () => list<AdminTab>('vuloform_admin_tabs');
export const settingsTabs = () => list<SettingsTab>('vuloform_settings_tabs');
export const formSettingsSections = () => list<FormSettingsSection>('vuloform_form_settings_sections');
export const inspectorSections = () => list<InspectorSection>('vuloform_inspector_sections');
