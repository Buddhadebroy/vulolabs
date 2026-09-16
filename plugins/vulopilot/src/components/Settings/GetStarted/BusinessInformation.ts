import { __ } from '@wordpress/i18n';
import BusinessInformationPanel from './BusinessInformationPanel';

/**
 * Settings → Get Started → Business Information.
 *
 * Moved here from the old Site Identity folder per direct instruction
 * ("move this 2 sub tab in Get Started" / "Get Started have 3 tab 1 his
 * own and two tab from Site Identity") — Site Identity had only these 2
 * sub-tabs (this one and Title Formats), so that top-level folder is gone
 * now that both live here instead. Same real `id: 'business-information'`
 * as before, so every existing `?...&subtab=business-information` deep
 * link (KnowledgeGraphSection.tsx's own `ENTITY_SETTINGS_URL`,
 * Modules/index.ts's own `settingsLink`) still resolves (`getSettingById()`
 * recurses by id alone, with no concept of which folder a tab lives in).
 *
 * Now a real `PanelComponent` (BusinessInformationPanel.tsx) rather than
 * InputRenderer's own declarative `modal`, per direct instruction ("move
 * image 1 settings before image 2 settings") — "Preferences"
 * (`site_tone`) and "PageSpeed Insights" moved here from the Connections
 * sub-tab, rendered above this tab's own "Business" fields; see that
 * component's own docblock for why a `PanelComponent` was needed (a
 * `PanelComponent` replaces InputRenderer entirely rather than composing
 * with it — a `type: 'section'`/`type: 'text'` `modal` couldn't add
 * PageSpeedStatusPanel.tsx, a real hand-built component, alongside its
 * own declarative fields). `modal` below still lists every real flat key
 * so Settings.tsx's own per-tab seeding logic (`fieldKeys` from
 * `modal[].key`) populates SettingContext with their current values
 * first.
 *
 * `entity_business_type`: free-text, owner-provided — shown as-is on the
 * Business Profile card, never written into any real Organization/
 * LocalBusiness JSON-LD anywhere in this codebase (Services\EntityExtractor's
 * own docblock). `entity_service_pages`/`entity_business_locations`:
 * newline-separated owner-curated lists (page URL/ID; "Name | Address"),
 * since this codebase has no existing Service/LocalBusiness concept to
 * derive these from automatically.
 */
export default {
	id: 'business-information',
	priority: 3,
	headerTitle: __('Business Information', 'vulopilot'),
	headerDescription: __(
		'Tell VuloPilot about your business so it can build a more complete Knowledge Graph and Business Profile.',
		'vulopilot'
	),
	hideSettingHeader: true,
	headerIcon: 'category',
	submitUrl: 'settings',
	modal: [
		{ key: 'site_tone', type: 'text', label: '' },
		{ key: 'psi_api_key', type: 'text', label: '' },
		{ key: 'psi_daily_limit', type: 'text', label: '' },
		{ key: 'entity_business_type', type: 'text', label: '' },
		{ key: 'entity_service_pages', type: 'textarea', label: '' },
		{ key: 'entity_business_locations', type: 'textarea', label: '' },
	],
	PanelComponent: BusinessInformationPanel,
};
