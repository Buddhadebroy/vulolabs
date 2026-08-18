/* global appLocalizer */
import React from 'react';
import { ButtonInput } from '@zyra/inputs';
import { __, sprintf } from '@wordpress/i18n';
import MODULES_CATALOG, { isModuleCatalogEntry } from '../Modules';
import '../Popup/Popup.scss';

interface PopupProps {
	moduleName?: string;
	plugin?: string;
}

const formatModuleName = (name: string): string => {
	return name
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
};

/**
 * Every real module id from ../Modules/index.ts's own catalog, keyed for a
 * cheap lookup below — 'geo-insights' resolves to whichever of its two
 * cards (GEO Radar/AEO Autopilot, both real 'geo-insights') comes first in
 * that file, since both represent the same underlying module and this
 * popup has no way to know which specific feature the caller meant.
 */
const MODULE_CATALOG_BY_ID = new Map(
	MODULES_CATALOG.modules
		.filter(isModuleCatalogEntry)
		.map((module) => [module.id, module])
);

/**
 * Resolves a real module id to the SAME name Settings → Modules shows for
 * it — used to render `Activate {name}` below. Falls back to a plain
 * Title-Cased-from-kebab guess only for the handful of real, backend
 * modules that have no card on that page at all ('advanced-reports',
 * 'one-click-fix' — see Modules/index.ts's own docblock for why), since
 * there's no human-authored name anywhere in this catalog to look up for
 * those. Fixes a real mismatch this popup used to always have: every
 * moduleName call site with a real card (`automation`, `accessibility-
 * audits`, `geo-insights`, …) previously showed this same guessed name
 * ("Activate Automation") instead of that module's own real, branded name
 * ("Activate Workflow Autopilot — Automation Engine") — two different
 * names for the same module, depending on which part of the app you saw
 * it locked from.
 */
const resolveModuleDisplayName = (moduleId: string): string =>
	MODULE_CATALOG_BY_ID.get(moduleId)?.name ?? formatModuleName(moduleId);

/**
 * Real icons for the 2 real backend modules with no catalog entry at all
 * (see Modules/index.ts's own ModuleCatalogEntry.icon docblock) — kept
 * local here rather than added to that catalog, which would misleadingly
 * imply these two have a real card to point `moduleName`'s "Enable Now"
 * link at.
 */
const CARDLESS_MODULE_ICONS: Record<string, string> = {
	'advanced-reports': 'report',
	'one-click-fix': 'tools',
};

/**
 * Resolves a real module id to a real `adminfont-*` glyph — every id in
 * Modules/index.ts's own catalog uses that entry's `icon` field; the 2
 * cardless ids above use CARDLESS_MODULE_ICONS; anything else (there
 * shouldn't be one) falls back to the id itself, same as before this
 * lookup existed. Fixes a real regression this popup would otherwise have:
 * `module.id` values (`geo-insights`, `accessibility-audits`, …) aren't
 * real icon glyph names in zyra's fonts.scss — confirmed only 1 of the 15
 * real module ids used across this file (`automation`) happens to also be
 * a defined `adminfont-automation` glyph, so deriving icons straight from
 * id would silently render a blank icon for the other 14.
 */
const resolveModuleIcon = (moduleId: string): string =>
	MODULE_CATALOG_BY_ID.get(moduleId)?.icon ??
	CARDLESS_MODULE_ICONS[moduleId] ??
	moduleId;

/**
 * The generic "what Pro adds" pitch's feature list — derived straight from
 * ../Modules/index.ts's own catalog (the real Settings → Modules page data,
 * already kept in sync with the backend's real module ids/proFeatures)
 * rather than a second, separately hand-maintained copy of the same
 * information. That second copy is what used to live here: an 11-entry
 * array of module names/blurbs, manually kept in sync "by hand" per its own
 * former docblock — the exact kind of duplicated, hardcoded module list
 * this repo's module-architecture.md and this refactor both ask to avoid.
 */
const proPopupContent = {
	messages: MODULES_CATALOG.modules
		.filter(isModuleCatalogEntry)
		.filter((module) => module.proModule)
		.map((module) => ({
			icon: resolveModuleIcon(module.id),
			text: module.name,
			des: (module.proFeatures ?? []).join(', '),
		})),
};

const ShowProPopup: React.FC<PopupProps> = (props) => {
	if (props.plugin) {
		return (
			<div className="popup-wrapper">
				<div className="popup-header">
					<i className={`adminfont-${props.plugin}`} />
				</div>
				<div className="popup-body">
					<div className="module-name">
						{sprintf(
							/* translators: %s: Plugin name. */
							__('Plugin Required: %s', 'vulopilot'),
							props.plugin
						)}
					</div>
					<div className="module-desc">
						{sprintf(
							__(
								'This feature requires the "%s" plugin to be active.',
								'vulopilot'
							),
							props.plugin
						)}
					</div>
					<ButtonInput
						position="center"
						buttons={[
							{
								icon: 'eye',
								text: __('Activate Plugin', 'vulopilot'),
								onClick: () => {
									window.open(
										`${appLocalizer.admin_url.replace(/admin\.php.*/, '')}plugins.php`,
										'_blank'
									);
								},
							},
						]}
					/>
				</div>
			</div>
		);
	}

	if (props.moduleName) {
		const displayName = resolveModuleDisplayName(props.moduleName);
		const displayIcon = resolveModuleIcon(props.moduleName);

		return (
			<div className="popup-wrapper">
				<div className="popup-header">
					<i className={`adminfont-${displayIcon}`} />
				</div>
				<div className="popup-body">
					<div className="module-name">
						{sprintf(
							/* translators: %s: Module name. */
							__('Activate %s', 'vulopilot'),
							displayName
						)}
					</div>
					<div className="module-desc">
						{sprintf(
							/* translators: %s: Module name. */
							__(
								'This feature is currently unavailable. To activate it, please enable the %s module.',
								'vulopilot'
							),
							displayName
						)}
					</div>
					<ButtonInput
						position="center"
						buttons={[
							{
								icon: 'eye',
								text: __('Enable Now', 'vulopilot'),
								onClick: () => {
									// Same admin page, just a different
									// hash tab — '_self' matches this
									// plugin's own same-page navigation
									// convention. Omitting the
									// target opens a new background tab
									// instead (real browser behavior,
									// despite MDN's prose default of
									// '_self'), which silently left the
									// user looking at the still-locked
									// widget with no visible feedback.
									window.open(
										`${appLocalizer.admin_url}#&tab=modules&module=${props.moduleName}`,
										'_self'
									);
								},
							},
						]}
					/>
				</div>
			</div>
		);
	}

	return (
		<div className="popup-wrapper">
			<div className="top-section">
				<div className="heading">
					{__(
						'Unlock the full VuloPilot toolkit',
						'vulopilot'
					)}
				</div>
				<div className="description">
					{__(
						'Automated fixes, scheduled scans, security monitoring, and WooCommerce AI — on top of everything Free already does.',
						'vulopilot'
					)}
				</div>
				<a
					className="admin-btn"
					href={appLocalizer.shop_url}
					target="_blank"
					rel="noreferrer"
				>
					{__('Upgrade to Pro', 'vulopilot')}
					<i className="adminfont-arrow-right arrow-icon"></i>
				</a>
			</div>
			<div className="popup-details">
				<div className="heading-text">
					{__('What Pro adds', 'vulopilot')}
				</div>
				<ul>
					{proPopupContent.messages.map((message, index) => (
						<li key={index}>
							<div className="title">
								<i className={`adminfont-${message.icon}`} />
								{message.text}
							</div>
							<div className="desc">{message.des}</div>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
};

export default ShowProPopup;
