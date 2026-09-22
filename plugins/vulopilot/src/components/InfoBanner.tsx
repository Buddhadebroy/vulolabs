import React from 'react';
import { ButtonInput } from '@zyra/inputs';
import infoBannerBg from '../assets/images/info-banner-bg.png';
import infoBanner from '../assets/images/info-banner.png';
import './InfoBanner.scss';

interface InfoBannerProps {
	/** adminfont icon name shown in the leading circle badge (e.g. `'info'`). */
	icon?: string;
	title: React.ReactNode;
	desc: React.ReactNode;
	actionLabel?: string;
	onAction?: () => void;
	/** Omit for a non-dismissible banner - no close control rendered at all. */
	onDismiss?: () => void;
}

/**
 * Shared full-width illustrated banner - real `info-banner-bg.png` (the
 * gradient/dot-pattern background) + `info-banner.png` (the right-side
 * server/shield illustration), same asset pair the mockup this replaces
 * `BackupProtectionNotice.tsx`'s own plain `NoticeComponent` with. Kept
 * generic (title/desc/action/icon as props) rather than baked into that
 * one file, since any other "single real status line + illustration"
 * notice in this app can reuse it instead of hand-rolling its own markup.
 */
const InfoBanner: React.FC<InfoBannerProps> = ({
	icon = 'info',
	title,
	desc,
	actionLabel,
	onAction,
	onDismiss,
}) => {
	return (
		<div
			className="info-banner"
			style={{ backgroundImage: `url(${infoBannerBg})` }}
		>
			{onDismiss && (
				<i
					className="adminfont-close info-banner-close"
					role="button"
					tabIndex={0}
					onClick={onDismiss}
					onKeyDown={(e) => {
						if (e.key === 'Enter' || e.key === ' ') {
							e.preventDefault();
							onDismiss();
						}
					}}
				/>
			)}

			<div className="info-banner-icon">
				<i className={`adminfont-${icon}`} />
			</div>

			<div className="info-banner-content">
				<div className="info-banner-title">{title}</div>
				<div className="desc">{desc}</div>
			</div>

			<img className="info-banner-illustration" src={infoBanner} alt="" />

			{actionLabel && onAction && (
				<ButtonInput
					wrapperClass="info-banner-action"
					buttons={{
						text: actionLabel,
						rightIcon: 'pagination-right-arrow',
						color: 'purple-bg',
						onClick: onAction,
					}}
				/>
			)}
		</div>
	);
};

export default InfoBanner;
