import type { ReactNode } from 'react';
import './CardHeader.scss';

interface CardHeaderProps {
	/** adminfont icon name, rendered as `adminfont-${icon}` - the left column. */
	icon: string;
	/** The center column. */
	title: ReactNode;
	desc: ReactNode;
	/** Rendered inline right after `title`, before `action` - typically a status badge. */
	badge?: ReactNode;
	/** Rendered inline right after `title` (and `badge`) - a `ToggleInput`, a button, or omitted entirely. */
	action?: ReactNode;
	/** Extra class(es) on the outer `.common-card` wrapper. */
	className?: string;
	/** Extra class(es) on the `.common-card-header` row - e.g. `'is-clickable'`. */
	headerClass?: string;
	onClick?: () => void;
	/** Everything below the header - typically one body div, left to the caller rather than auto-wrapped. */
	children?: ReactNode;
}

/** Reusable card with an icon + title/desc header row. */
const CardHeader = ({
	icon,
	title,
	desc,
	badge,
	action,
	className = '',
	headerClass = '',
	onClick,
	children
}: CardHeaderProps) => {
	const header = (
		<div
			className={`common-card-header${headerClass ? ` ${headerClass}` : ''}`}
			onClick={onClick}
		>
			<i className={`common-card-icon adminfont-${icon}`} />
			<div className="common-card-details">
				<div className='title'>
					{title}
					{badge && <span className="common-card-action">{badge}</span>}
					
				</div>
				<span className="desc">{desc}</span>
			</div>
		</div>
	);


	return (
		<div className={`common-card${className ? ` ${className}` : ''}`}>
			{header}
			{children}
			{action && <span className="common-card-action">{action}</span>}
		</div>
	);
};

export default CardHeader;
