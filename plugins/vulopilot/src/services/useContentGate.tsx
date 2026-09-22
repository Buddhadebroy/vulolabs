/* global appLocalizer */
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import ShowProPopup from '../components/Popup/Popup';
import { ConnectVuloCloudPromptContent } from '../components/AiCredits/ConnectVuloCloudPopup';
import DummyDataNotice from '../components/DummyDataNotice';
import { BlurredProContent } from '../components/UpgradeToProOverlay';
import MODULES_CATALOG, { isModuleCatalogEntry } from '../components/Modules';
import { useAiCredits } from './useAiCredits';
import './useContentGate.scss';

const MODULE_CATALOG_BY_ID = new Map(
	MODULES_CATALOG.modules.filter(isModuleCatalogEntry).map((module) => [module.id, module])
);

/**
 * Fallback preview used when a caller doesn't supply `dummyContent` to
 * `wrap()`. Deliberately generic, not derived from the caller's real
 * content - a locked section shouldn't render its own real data (findings
 * counts, etc.) at all while gated, even faded.
 */
const DEFAULT_DUMMY_CONTENT = (
	<div className="content-gate-dummy-content" aria-hidden="true">
		<div className="desc">
			{__('Unlock this to see real, live data for your site here.', 'vulopilot')}
		</div>
		<ButtonInput
			position="full-width"
			buttons={{ text: __('Take Action', 'vulopilot'), icon: 'ai', color: 'orange-bg', disabled: true, onClick: () => {} }}
		/>
	</div>
);

/**
 * Shared logic behind content-gated cards (originally AiSpeedAssistantCard.tsx) -
 * a hook, not a wrapper component, so any section can reuse the same
 * checks/popup state while still rendering its own `CardComponent`:
 *
 * ```tsx
 * const { wrap } = useContentGate('ai-copilot');
 * return (
 *   <CardComponent title="…" titleIcon="ai" desc="…" isLoading={isLoading}>
 *     {wrap(realContent, dummyContent)}
 *   </CardComponent>
 * );
 * ```
 *
 * `wrap()` returns `realContent` unchanged once every check below passes;
 * otherwise renders a Pro/module tag row
 * (`.admin-tag.pro-tag`/`.admin-tag.module-tag`, same classes
 * InputRenderer.tsx's locked settings fields use) plus either
 * `realContent` blurred in place (VuloCloud) or `dummyContent`
 * (Pro/module) - two different lock treatments by design. Checked in
 * order VuloCloud → Pro → module; each gate's locked state
 * short-circuits the ones after it.
 *
 * 1. **VuloCloud connection** (`useAiCredits()`'s `status.connected`) -
 *    `realContent` blurred underneath a clickable label opening
 *    `ConnectVuloCloudPromptContent` (the passwordless broker redirect
 *    every free AI surface uses).
 * 2. **Pro** (`appLocalizer.khali_dabba` false) - `dummyContent` (or
 *    `DEFAULT_DUMMY_CONTENT` if omitted) rendered behind the shared
 *    blurred "Upgrade to Pro" overlay (`BlurredProContent`/
 *    `UpgradeToProOverlay`) plus `DummyDataNotice`. No separate
 *    `.admin-tag.pro-tag` here - the overlay text already says "Upgrade
 *    to Pro". Clicking opens the generic upgrade popup (`ShowProPopup`,
 *    no `moduleName`).
 * 3. **Module** (`moduleId` missing from `appLocalizer.active_modules`) -
 *    same `dummyContent` treatment, tag shows the module's display name
 *    (Modules/index.ts catalog). Clicking skips the popup and navigates
 *    straight to `?page=vulopilot#&tab=settings&subtab=modules&module=<id>`
 *    (same shape zyra's `ModuleGridComponent` already consumes to scroll
 *    to and highlight the module card). Pass `null` as `moduleId` to skip
 *    this check. `isModuleActive` is an escape hatch for callers unlocked
 *    by more than one module (e.g. AeoTab.tsx's `isCitationCheckActive()`
 *    checks `geo-insights` OR `aeo-insights`) - pass the already-correct
 *    boolean straight through instead of re-deriving a single-id check.
 *    `moduleId` still drives the tag's display name/redirect target.
 */
export const useContentGate = (
	moduleId: string | null,
	isModuleActive?: boolean
) => {
	const [isPopupOpen, setIsPopupOpen] = useState(false);
	const { status: creditsStatus } = useAiCredits();

	// `creditsStatus` starts null while the first `ai-credits/status` fetch
	// is in flight - treated as locked (same fail-closed default every
	// other real-data gate in this codebase already applies) rather than
	// briefly unlocking, since this drives whether `realContent` itself
	// gets blurred.
	const isVuloCloudLocked = !creditsStatus?.connected;
	const isProLocked = !isVuloCloudLocked && !appLocalizer.khali_dabba;
	const isModuleLocked =
		!isVuloCloudLocked &&
		!isProLocked &&
		!!moduleId &&
		!(isModuleActive ?? appLocalizer.active_modules.includes(moduleId));

	const gateReason: 'vulocloud' | 'pro' | 'module' | null = isVuloCloudLocked
		? 'vulocloud'
		: isProLocked
			? 'pro'
			: isModuleLocked
				? 'module'
				: null;

	// Module: no popup step - straight to Settings → Modules, highlighted.
	// Pro/VuloCloud: still open the popup (upgrade pitch / connect flow),
	// same as before. See this hook's own docblock, gate 3.
	const handleActivate = () => {
		if ('module' === gateReason && moduleId) {
			window.location.href = `${appLocalizer.admin_url}#&tab=settings&subtab=modules&module=${moduleId}`;
			return;
		}
		setIsPopupOpen(true);
	};

	const handleSectionKeyDown = (event: KeyboardEvent) => {
		if ('Enter' === event.key || ' ' === event.key) {
			event.preventDefault();
			handleActivate();
		}
	};

	// Purely visual once the whole-section overlay below owns the click -
	// a real `<button disabled>` inside `dummyContent` (AiSpeedAssistantCard.tsx's
	// own mock preview) never dispatches a click at all, so this tag can't
	// rely on bubbling from there either; it needs one click target
	// covering the entire section, not just this tag. Not called for
	// 'pro' at all anymore - `BlurredProContent`'s own overlay already
	// says "Upgrade to Pro" (see this hook's own docblock, gate 2).
	const renderTag = (): ReactNode => {
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
				{__('Connect to VuloCloud to use this', 'vulopilot')}
			</span>
		);
	};

	const wrap = (realContent: ReactNode, dummyContent: ReactNode = DEFAULT_DUMMY_CONTENT): ReactNode => {
		if (null === gateReason) {
			return realContent;
		}

		const isVuloCloud = 'vulocloud' === gateReason;
		const isPro = 'pro' === gateReason;

		// 'pro' renders through `BlurredProContent` instead of this hook's
		// own tag+click-overlay markup - that component owns its own
		// blur-wrapper, "Upgrade to Pro" overlay, and whole-content click
		// target already (see its own docblock), so duplicating
		// `.content-gate-tag`/`.content-gate-click-overlay` around it here
		// would just be a second, redundant click surface. 'vulocloud'/
		// 'module' keep the original shape - genuinely different CTAs
		// (blurred real content + "Connect to VuloCloud", vs. a straight
		// navigate to Settings → Modules) that `BlurredProContent`'s own
		// fixed "Upgrade to Pro" copy doesn't fit.
		if (isPro) {
			return (
				<div className="content-gate">
					<BlurredProContent
						contentClassName="content-gate-dummy-content"
						onClick={handleActivate}
					>
						{dummyContent}
					</BlurredProContent>
					<DummyDataNotice />
					<PopupComponent
						open={isPopupOpen}
						onClose={() => setIsPopupOpen(false)}
						width={31.25}
						height="auto"
						position="lightbox"
					>
						<ShowProPopup />
					</PopupComponent>
				</div>
			);
		}

		return (
			<div className="content-gate">
				<div className="content-gate-tag">{renderTag()}</div>
				{/* VuloCloud: the real content itself, blurred in place.
				 * Module: the caller's own dummy preview, plus the shared
				 * "This is dummy data" notice (DummyDataNotice) - per direct
				 * instruction, every module-gated section showing fabricated
				 * content gets this same notice. See this hook's own
				 * docblock for why the two look different. */}
				{isVuloCloud ? (
					<div className="content-gate-blur-content" aria-hidden="true">
						{realContent}
					</div>
				) : (
					<>
						{dummyContent}
						<DummyDataNotice />
					</>
				)}
				{/* Covers the whole section (tag + dummy/blurred content) so
				 * a click anywhere within it activates - not just on the tag
				 * itself. VuloCloud opens the popup; Module navigates
				 * straight to Settings → Modules, highlighted (handleActivate
				 * above). */}
				<div
					className="content-gate-click-overlay"
					role="button"
					tabIndex={0}
					aria-label={
						isVuloCloud
							? __('Connect to VuloCloud', 'vulopilot')
							: sprintf(
									/* translators: %s is the real module's own display name. */
									__('Activate %s', 'vulopilot'),
									MODULE_CATALOG_BY_ID.get(moduleId ?? '')?.name ?? moduleId ?? ''
								)
					}
					onClick={handleActivate}
					onKeyDown={handleSectionKeyDown}
				/>
				{/* Only 'vulocloud' ever sets isPopupOpen here - 'module'
				 * navigates directly instead (handleActivate above). 'pro'
				 * has its own PopupComponent above. */}
				<PopupComponent
					open={isPopupOpen}
					onClose={() => setIsPopupOpen(false)}
					width={31.25}
					height="auto"
					position="lightbox"
				>
					{isVuloCloud ? <ConnectVuloCloudPromptContent /> : <ShowProPopup />}
				</PopupComponent>
			</div>
		);
	};

	return { isLocked: null !== gateReason, gateReason, wrap };
};
