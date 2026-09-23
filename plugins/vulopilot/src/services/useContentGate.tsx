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
 * `wrap()` returns `realContent` unchanged once every check below passes.
 * VuloCloud and Pro both render through the same reusable
 * `BlurredProContent`/`UpgradeToProOverlay` overlay card now
 * (`icon`/`title`/`desc`/`buttonText` swapped per gate - see that
 * component's own docblock) rather than each hand-rolling its own locked
 * treatment; Module still gets its own `.admin-tag.module-tag` tag row +
 * plain (unblurred) `dummyContent`, a genuinely different shape (no blur,
 * no popup - a straight navigate). Checked in order VuloCloud → Pro →
 * module; each gate's locked state short-circuits the ones after it.
 *
 * 1. **VuloCloud connection** (`useAiCredits()`'s `status.connected`) -
 *    `realContent` blurred behind the overlay card ("Connect to
 *    VuloCloud" copy), opening `ConnectVuloCloudPromptContent` (the
 *    passwordless broker redirect every free AI surface uses).
 * 2. **Pro** (`appLocalizer.khali_dabba` false) - `dummyContent` (or
 *    `DEFAULT_DUMMY_CONTENT` if omitted) blurred behind the same overlay
 *    card (default "Upgrade to Pro" copy) plus `DummyDataNotice`.
 *    Clicking opens the generic upgrade popup (`ShowProPopup`, no
 *    `moduleName`).
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
	// covering the entire section, not just this tag. Only ever called for
	// 'module' now - 'pro'/'vulocloud' both render through
	// `BlurredProContent`'s own overlay instead (see this hook's own
	// docblock, gates 1-2).
	const renderTag = (): ReactNode => {
		const moduleName = (moduleId && MODULE_CATALOG_BY_ID.get(moduleId)?.name) ?? moduleId ?? '';

		return (
			<span className="admin-tag module-tag">
				<i className="adminfont-lock" />
				{moduleName}
			</span>
		);
	};

	const wrap = (realContent: ReactNode, dummyContent: ReactNode = DEFAULT_DUMMY_CONTENT): ReactNode => {
		if (null === gateReason) {
			return realContent;
		}

		const isPro = 'pro' === gateReason;
		const isVuloCloud = 'vulocloud' === gateReason;

		// 'pro'/'vulocloud' both render through the same reusable
		// `BlurredProContent` overlay card now (icon/title/desc/buttonText
		// swapped per gate - see UpgradeToProOverlay.tsx's own docblock),
		// rather than 'vulocloud' hand-rolling a second, plainer
		// tag+click-overlay version of the same "locked content" shape.
		// 'module' keeps its own shape below - a straight navigate to
		// Settings → Modules with no blur/popup, genuinely different from
		// either (see this hook's own docblock, gate 3).
		if (isPro || isVuloCloud) {
			return (
				<div className="content-gate">
					<BlurredProContent
						contentClassName="content-gate-dummy-content"
						onClick={handleActivate}
						icon={isVuloCloud ? 'cloud-upload purple' : undefined}
						title={isVuloCloud ? __('Connect to VuloCloud', 'vulopilot') : undefined}
						desc={
							isVuloCloud
								? __('Connect your account to see real, live data here.', 'vulopilot')
								: undefined
						}
						buttonText={isVuloCloud ? __('Connect to VuloCloud', 'vulopilot') : undefined}
					>
						{isVuloCloud ? realContent : dummyContent}
					</BlurredProContent>
					{!isVuloCloud && <DummyDataNotice />}
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
		}

		return (
			<div className="content-gate">
				<div className="content-gate-tag">{renderTag()}</div>
				{/* Module: the caller's own dummy preview, plus the shared
				 * "This is dummy data" notice (DummyDataNotice) - per direct
				 * instruction, every module-gated section showing fabricated
				 * content gets this same notice. */}
				{dummyContent}
				<DummyDataNotice />
				{/* Covers the whole section (tag + dummy content) so a click
				 * anywhere within it activates - not just on the tag itself.
				 * Module navigates straight to Settings → Modules,
				 * highlighted (handleActivate above); no popup for this
				 * gate. */}
				<div
					className="content-gate-click-overlay"
					role="button"
					tabIndex={0}
					aria-label={sprintf(
						/* translators: %s is the real module's own display name. */
						__('Activate %s', 'vulopilot'),
						MODULE_CATALOG_BY_ID.get(moduleId ?? '')?.name ?? moduleId ?? ''
					)}
					onClick={handleActivate}
					onKeyDown={handleSectionKeyDown}
				/>
			</div>
		);
	};

	return { isLocked: null !== gateReason, gateReason, wrap };
};
