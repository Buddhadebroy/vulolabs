import type { ReactNode } from 'react';
import { __ } from '@wordpress/i18n';
import './UpgradeToProOverlay.scss';

/**
 * The "Upgrade to Pro" card floating over a dummy card's own blurred
 * content — originally one-off markup `BrandVisibilityProDummies.tsx`'s
 * `KnowledgePanelDummy` alone carried, then reused by its 3 siblings.
 * Pulled out here so every Pro-gated "still show the section, fabricated
 * content behind a click-through popup" card across the plugin (dashboard
 * widgets, Automations, Brand Visibility, …) renders the exact same
 * overlay (icon/title/desc/button, `upgrade-to-pro.png` background)
 * instead of each hand-rolling its own copy.
 */
export const UpgradeToProOverlay = ({ onClick }: { onClick?: () => void }) => (
	// The overlay sits on top of (z-index above) the blurred content, so a
	// click on it never reaches that content's own onClick — it has to
	// carry the same handler itself, or the "Upgrade to Pro" card is inert.
	<div
		className="pro-section-wrapper"
		style={onClick ? { cursor: 'pointer' } : undefined}
		role={onClick ? 'button' : undefined}
		tabIndex={onClick ? 0 : undefined}
		onClick={onClick}
		onKeyDown={
			onClick
				? (event) => {
						if ('Enter' === event.key || ' ' === event.key) {
							onClick();
						}
					}
				: undefined
		}
	>
		<div
			className="pro-section"
		>
			<i className="adminfont-lock purple"></i>
			<div className="title">{__('Upgrade to Pro', 'vulopilot')}</div>
			<span>{__('Unlock the full VuloPilot toolkit', 'vulopilot')}</span>
			<div
				className="admin-btn btn-purple-bg"
				role={onClick ? 'button' : undefined}
				tabIndex={onClick ? 0 : undefined}
				onKeyDown={(event) => {
					if (onClick && ('Enter' === event.key || ' ' === event.key)) {
						event.preventDefault();
						onClick();
					}
				}}
			>
				{__('Upgrade to pro', 'vulopilot')}
			</div>
		</div>
	</div>
);

/**
 * The full "blurred dummy content behind an Upgrade-to-Pro overlay" shell
 * — `.blur-wrapper` (positioned ancestor) + `<UpgradeToProOverlay />` +
 * the dummy's own click-through content, blurred via `.blur-wrapper-content`
 * (UpgradeToProOverlay.scss). Replaces every call site's own hand-assembled
 * `<div className="blur-wrapper"><div className="pro-section-wrapper">…</div><div className="…" onClick={…}>…</div></div>`
 * copy, and the separate floating `.admin-tag.pro-tag` badge some of those
 * call sites used to carry alongside it — redundant once this overlay
 * itself already says "Upgrade to Pro" the moment the blurred content
 * renders.
 */
export const BlurredProContent = ({
	contentClassName,
	onClick,
	children,
}: {
	/** This dummy's own content class (e.g. `health-timeline-dummy`) — `blur-wrapper-content` is appended automatically. */
	contentClassName: string;
	onClick: () => void;
	children: ReactNode;
}) => (
	<div className="blur-wrapper">
		<UpgradeToProOverlay onClick={onClick} />
		<div
			className={`${contentClassName} blur-wrapper-content`}
			role="button"
			tabIndex={0}
			onClick={onClick}
			onKeyDown={(event) => {
				if ('Enter' === event.key || ' ' === event.key) {
					onClick();
				}
			}}
		>
			{children}
		</div>
	</div>
);
