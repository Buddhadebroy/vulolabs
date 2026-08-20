import type { ReactNode } from 'react';
import { CardComponent, BadgeComponent } from '@zyra/components';
import './MetricTile.scss';

export type MetricTileVariant =
	| 'performance'
	| 'security'
	| 'accessibility'
	| 'woocommerce';

interface MetricTileBadge {
	color: string;
	text: string;
}

interface MetricTileGridProps {
	variant: MetricTileVariant;
	className?: string;
	children: ReactNode;
}

/**
 * Shared grid wrapper behind the 4 previously independent tile grids this
 * component's own docblock (below, on `MetricTile`) explains — `variant`
 * only changes the column count/breakpoint (Performance breaks to 2
 * columns under 64rem; WooCommerce is `auto-fit` since its cards vary
 * more in content height than the other three's uniform tiles).
 */
export const MetricTileGrid = ({
	variant,
	className,
	children,
}: MetricTileGridProps) => (
	<div
		className={`metric-tile-grid metric-tile-grid--${variant}${
			className ? ` ${className}` : ''
		}`}
	>
		{children}
	</div>
);

interface MetricTileProps {
	id?: string;
	variant: MetricTileVariant;
	icon: string;
	/** Per-tile icon tint override — AccessibilityChecksGrid colors each check's icon by its own `check.color` rather than a fixed variant color; the other 3 variants leave this unset and inherit `--color-primary` from MetricTile.scss instead. */
	iconColor?: string;
	title: string;
	badge?: MetricTileBadge;
	isLoading?: boolean;
	/** Divergent per-tile body — rows, desc, counts, last-scan line, highlight text, … — each page owns its own shape here; this is the one thing that never unified across the 4 call sites. */
	children?: ReactNode;
	/** Usually a single `<ButtonInput>` — wrapped in `.metric-tile-footer`, which supplies the full-width/bordered button treatment (or WooCommerce's plain inline-link treatment, via `metric-tile--woocommerce`). */
	footer?: ReactNode;
	className?: string;
}

/**
 * Shared shell behind 4 previously independent, near-identical tile
 * grids that each duplicated the same icon + title + optional badge +
 * footer-button CSS under their own class names: MetricsGrid.tsx's
 * `.performance-metric-tile` (Improve Speed), SecurityMetricsGrid.tsx's
 * `.security-metric-tile` (Protect My Site), AccessibilityChecksGrid.tsx's
 * `.accessibility-check-tile` (Accessibility, its own top-level page), and
 * WooCommerceCategoryGrid.tsx's `.woocommerce-category-card` (Sell More).
 *
 * `variant` (see MetricTile.scss) is the one real visual difference left
 * between them — icon color, footer-button width/alignment, tile gap —
 * everything else (flex column shell, icon size, title weight, badge
 * placement) is now declared once. Each page keeps its own real
 * data-fetching, badge logic, and — as `children` — whatever divergent
 * body content that tile needs (stat rows, a desc line, a count, a
 * "pages affected" line, a "last scan" line, …), since that part never
 * had a common shape across the 4 to begin with.
 */
const MetricTile = ({
	id,
	variant,
	icon,
	iconColor,
	title,
	badge,
	isLoading,
	children,
	footer,
	className,
}: MetricTileProps) => (
	<CardComponent
		id={id}
		className={`metric-tile metric-tile--${variant}${
			className ? ` ${className}` : ''
		}`}
		isLoading={isLoading}
	>
		<i
			className={`metric-tile-icon adminfont-${icon}`}
			style={iconColor ? { color: iconColor } : undefined}
		/>
		<div className="metric-tile-title">{title}</div>
		{badge && <BadgeComponent color={badge.color} text={badge.text} />}
		{children}
		{footer && <div className="metric-tile-footer">{footer}</div>}
	</CardComponent>
);

export default MetricTile;
