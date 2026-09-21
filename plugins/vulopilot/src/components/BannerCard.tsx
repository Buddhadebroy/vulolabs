import { useState, type ComponentProps, type ReactNode } from 'react';
import { ButtonInput } from '@zyra/inputs';
import bannerBackground from '../assets/images/dashboard-banner.png';
import bannerIllustration from '../assets/images/banner.png';

export interface BannerCardProps {
	title: ReactNode;
	desc?: ReactNode;
	/** Optional line between the title and desc (e.g. a live status/count). */
	meta?: ReactNode;
	buttons?: ComponentProps<typeof ButtonInput>['buttons'];
	/** Shows the top-right close control; the banner hides itself once clicked. */
	dismissible?: boolean;
	/** When set, a dismissal is remembered (localStorage, this browser) under this key, so the banner stays gone after a reload instead of returning. */
	dismissKey?: string;
	/** Extra class on the root, for a caller's own sizing/color rules. */
	className?: string;
	/** Right-hand illustration; pass `null` to omit it. */
	image?: string | null;
}

/**
 * The shared purple promotional banner (`dashboard-banner.png` background,
 * title/desc/buttons on the left, illustration on the right) — was
 * Dashboard/GettingStartedCard.tsx's own hand-built markup, now generic so
 * any page can reuse it. Styles are `.getting-started-banner*` (common.scss).
 *
 * Also registered into the `vulopilot_banner_card` filter (see Commerce.tsx)
 * so vulopilot-pro's StoreHealthBanner can render this same component —
 * Pro can't import from Free's src/ tree directly.
 */
const BannerCard = ({
	title,
	desc,
	meta,
	buttons,
	dismissible = false,
	dismissKey,
	className = '',
	image = bannerIllustration,
}: BannerCardProps) => {
	const storageKey = dismissKey ? `vulopilot_banner_dismissed_${dismissKey}` : null;
	const [dismissed, setDismissedState] = useState(() => {
		try {
			return Boolean(storageKey && window.localStorage.getItem(storageKey));
		} catch {
			return false;
		}
	});

	const setDismissed = (value: boolean) => {
		setDismissedState(value);

		try {
			if (storageKey && value) {
				window.localStorage.setItem(storageKey, '1');
			}
		} catch {
			// Storage blocked — the banner still hides for this page view.
		}
	};

	if (dismissed) {
		return null;
	}

	return (
		<div
			className={`getting-started-banner ${className}`.trim()}
			style={{ backgroundImage: `url(${bannerBackground})` }}
		>
			{dismissible && (
				<i
					className="adminfont-close getting-started-banner-close"
					role="button"
					tabIndex={0}
					onClick={() => setDismissed(true)}
					onKeyDown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							setDismissed(true);
						}
					}}
				/>
			)}
			<div className="details-wrapper">
				<div className="getting-started-banner-title">{title}</div>
				{meta}
				{desc && <div className="getting-started-banner-desc">{desc}</div>}
				{buttons && (
					<ButtonInput
						position="left"
						wrapperClass="getting-started-banner-buttons"
						buttons={buttons}
					/>
				)}
			</div>
			{image && <img src={image} alt="" />}
		</div>
	);
};

export default BannerCard;
