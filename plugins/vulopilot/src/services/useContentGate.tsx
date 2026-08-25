/* global appLocalizer */
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import ShowProPopup from '../components/Popup/Popup';
import MODULES_CATALOG, { isModuleCatalogEntry } from '../components/Modules';
import { useVuloCloudAccountLogin } from './useVuloCloudAccountLogin';
import './useContentGate.scss';

const MODULE_CATALOG_BY_ID = new Map(
	MODULES_CATALOG.modules.filter(isModuleCatalogEntry).map((module) => [module.id, module])
);

/**
 * Generic "content would be here" preview, used only when a caller doesn't
 * supply its own `dummyContent` to `wrap()` — real, readable copy and a
 * real (disabled) `ButtonInput`, not abstract skeleton-loading bars, per
 * direct instruction. Deliberately generic rather than derived from
 * whatever real content a caller has on hand: a locked section shouldn't
 * render its own real data (findings counts, etc.) at all while gated,
 * even faded — this is a stand-in, not that real content in disguise.
 */
const DEFAULT_DUMMY_CONTENT = (
	<div className="content-gate-dummy-content" aria-hidden="true">
		<div className="desc">
			{__('Unlock this to see real, live data for your site here.', 'vulopilot')}
		</div>
		<ButtonInput
			position="full-width"
			buttons={{ text: __('Take Action', 'vulopilot'), icon: 'ai', disabled: true, onClick: () => {} }}
		/>
	</div>
);

/**
 * Shared logic behind AiSpeedAssistantCard.tsx's own 3 real content gates
 * — a hook, not a wrapper component (per direct instruction: "no extra
 * component create checking add in existing cardcomponent"), so any
 * section can reuse the same checks/popup state without hand-copying that
 * card's own branching into every new call site while still rendering its
 * own real `CardComponent` (or whatever it already uses) directly:
 *
 * ```tsx
 * const { wrap } = useContentGate('ai-copilot');
 * return (
 *   <CardComponent title="…" titleIcon="ai" isLoading={isLoading}>
 *     {wrap(realContent, dummyContent)}
 *   </CardComponent>
 * );
 * ```
 *
 * `wrap()` returns `realContent` unchanged once every check below passes.
 * Otherwise it renders a real Settings-style Pro/module tag row
 * (`.admin-tag.pro-tag`/`.admin-tag.module-tag`, the exact same classes
 * InputRenderer.tsx's own locked settings fields already use) on top, then
 * — per direct instruction, the two kinds of lock look different on
 * purpose, not the same shape — either `realContent` itself blurred in
 * place (VuloCloud) or `dummyContent` (Pro/module). Checked in this order
 * — VuloCloud, then Pro, then module (per direct instruction) — each
 * gate's own locked state short-circuits the ones after it, so a
 * not-logged-in-VuloCloud site sees the blurred content even if Pro and
 * its module are also off:
 *
 * 1. **VuloCloud account** (`useVuloCloudAccountLogin()`) — a plain label,
 *    not a clickable tag (no real "log into VuloCloud" flow exists
 *    anywhere in this codebase yet for it to open — see that hook's own
 *    docblock for what it actually reports today), with `realContent`
 *    itself blurred underneath instead of `dummyContent` — its real shape
 *    stays visible, just unreadable/non-interactive, rather than being
 *    replaced by a mock preview.
 * 2. **Pro** (`appLocalizer.khali_dabba` false) — a "Pro" tag on top,
 *    `dummyContent` below it — a caller's own mock preview of its real
 *    shape (e.g. AiSpeedAssistantCard.tsx passes a fake count line plus
 *    disabled versions of its own two real buttons), or
 *    `DEFAULT_DUMMY_CONTENT` above if omitted; never `realContent` itself.
 *    Clicking anywhere in the section (not just the tag itself — see
 *    `.content-gate-click-overlay` below) opens the same generic upgrade
 *    popup (`ShowProPopup`, no `moduleName`) Settings' own locked Pro
 *    fields already use.
 * 3. **Module** (`moduleId` missing from `appLocalizer.active_modules`) —
 *    same `dummyContent` + whole-section-clickable treatment as Pro above,
 *    but the tag shows that module's own real display name (looked up
 *    from Modules/index.ts's own catalog, the same data Settings →
 *    Modules itself renders from); clicking opens `ShowProPopup` with
 *    `moduleName` set, which points an already-Pro user at "Activate
 *    {name}" instead of re-pitching an upgrade they already have — same
 *    branch ProLockedCard.tsx already relies on. Pass `null` as `moduleId`
 *    to skip this check for a section with no module dependency of its
 *    own.
 */
export const useContentGate = (moduleId: string | null) => {
	const [isPopupOpen, setIsPopupOpen] = useState(false);
	const { isLoggedIn: isVuloCloudLoggedIn } = useVuloCloudAccountLogin();

	const isVuloCloudLocked = !isVuloCloudLoggedIn;
	const isProLocked = !isVuloCloudLocked && !appLocalizer.khali_dabba;
	const isModuleLocked =
		!isVuloCloudLocked &&
		!isProLocked &&
		!!moduleId &&
		!appLocalizer.active_modules.includes(moduleId);

	const gateReason: 'vulocloud' | 'pro' | 'module' | null = isVuloCloudLocked
		? 'vulocloud'
		: isProLocked
			? 'pro'
			: isModuleLocked
				? 'module'
				: null;

	const handleSectionKeyDown = (event: KeyboardEvent) => {
		if ('Enter' === event.key || ' ' === event.key) {
			event.preventDefault();
			setIsPopupOpen(true);
		}
	};

	// Purely visual once the whole-section overlay below owns the click —
	// a real `<button disabled>` inside `dummyContent` (AiSpeedAssistantCard.tsx's
	// own mock preview) never dispatches a click at all, so this tag can't
	// rely on bubbling from there either; it needs one click target
	// covering the entire section, not just this tag.
	const renderTag = (): ReactNode => {
		if ('pro' === gateReason) {
			return (
				<span className="admin-tag pro-tag">
					<i className="adminfont-pro-tag" />
					{__('Pro', 'vulopilot')}
				</span>
			);
		}

		if ('module' === gateReason && moduleId) {
			const moduleName = MODULE_CATALOG_BY_ID.get(moduleId)?.name ?? moduleId;

			return (
				<span className="admin-tag module-tag">
					<i className="adminfont-lock" />
					{moduleName}
				</span>
			);
		}

		return (
			<span className="content-gate-vulocloud-label">
				<i className="adminfont-lock" />
				{__('Log in to your VuloCloud account to use this', 'vulopilot')}
			</span>
		);
	};

	const wrap = (realContent: ReactNode, dummyContent: ReactNode = DEFAULT_DUMMY_CONTENT): ReactNode => {
		if (null === gateReason) {
			return realContent;
		}

		// Pro/module: dummy content, whole section clickable → popup.
		// VuloCloud: the real content itself, blurred in place — no popup
		// to open (see this hook's own docblock for why), so no click
		// target either.
		if ('vulocloud' === gateReason) {
			return (
				<div className="content-gate">
					<div className="content-gate-tag">{renderTag()}</div>
					<div className="content-gate-blur-content" aria-hidden="true">
						{realContent}
					</div>
				</div>
			);
		}

		return (
			<div className="content-gate">
				<div className="content-gate-tag">{renderTag()}</div>
				{dummyContent}
				{/* Covers the whole section (tag + dummy content) so a click
				 * anywhere within it opens the popup — not just on the tag
				 * itself. */}
				<div
					className="content-gate-click-overlay"
					role="button"
					tabIndex={0}
					aria-label={
						'pro' === gateReason
							? __('Upgrade to Pro', 'vulopilot')
							: sprintf(
									/* translators: %s is the real module's own display name. */
									__('Activate %s', 'vulopilot'),
									MODULE_CATALOG_BY_ID.get(moduleId ?? '')?.name ?? moduleId ?? ''
								)
					}
					onClick={() => setIsPopupOpen(true)}
					onKeyDown={handleSectionKeyDown}
				/>
				<PopupComponent
					open={isPopupOpen}
					onClose={() => setIsPopupOpen(false)}
					width={31.25}
					height="auto"
					position="lightbox"
				>
					{'pro' === gateReason ? <ShowProPopup /> : <ShowProPopup moduleName={moduleId ?? ''} />}
				</PopupComponent>
			</div>
		);
	};

	return { isLocked: null !== gateReason, gateReason, wrap };
};
