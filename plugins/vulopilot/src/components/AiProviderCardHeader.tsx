import type { ReactNode } from 'react';

interface AiProviderCardHeaderProps {
	/** adminfont icon name, rendered as `adminfont-${icon}`. */
	icon: string;
	title: ReactNode;
	desc: ReactNode;
	/** The header's own right-side content — a status span, a `ToggleInput`, or omitted entirely. */
	action?: ReactNode;
	/** Extra class(es) on the outer `.ai-provider-card-header` div — e.g. `'is-clickable'`. */
	wrapperClass?: string;
	onClick?: () => void;
}

/**
 * The icon + title + desc (+ optional right-side action) row every
 * Settings → Connections panel's own "ai-provider-card" starts with —
 * GoogleServicesPanel.tsx, SiteVerificationPanel.tsx, AiProvidersPanel.tsx,
 * and PageSpeedStatusPanel.tsx each hand-rolled this same
 * `.ai-provider-card-header` > `.ai-provider-card-icon` +
 * `.ai-provider-card-title` markup before this. Styling is unchanged —
 * still Settings.scss's own `.ai-provider-card-header`/`-icon`/`-title`
 * rules, this component just stops duplicating the JSX that wires them up.
 */
const AiProviderCardHeader = ({
	icon,
	title,
	desc,
	action,
	wrapperClass = '',
	onClick,
}: AiProviderCardHeaderProps) => (
	<div
		className={`ai-provider-card-header${wrapperClass ? ` ${wrapperClass}` : ''}`}
		onClick={onClick}
	>
		<div className="ai-provider-card-icon">
			<i className={`adminfont-${icon}`} />
		</div>
		<div className="ai-provider-card-title">
			<strong>{title}</strong>
			<span className="desc">{desc}</span>
		</div>
		{action}
	</div>
);

export default AiProviderCardHeader;
