import React, { useId, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';

export interface ScorePoint {
	/** `Y-m-d`. */
	date: string;
	score: number;
}

/** "Nov 4" for a `Y-m-d` day, in the visitor's locale. */
export const shortDate = (day: string): string =>
	new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

const W = 600;
const H = 200;
const PAD_TOP = 12;
const PAD_BOTTOM = 8;

/** Score bands drawn as quiet reference lines: where "Good" and "Excellent" begin. */
const BANDS = [
	{ value: 90, label: __('Excellent', 'vulopilot') },
	{ value: 70, label: __('Good', 'vulopilot') },
];

/**
 * The overall score per day as one smooth line with a soft fill, the same drawing as VuloCart's sales chart and
 * VuloForm's submissions chart. The y-axis fits the data (a 96→98 week is not a flat line on a 0–100 scale), and
 * hovering a day reads it out.
 */
const ScoreTrendChart: React.FC<{ points: ScorePoint[]; label: string }> = ({ points, label }) => {
	const [hover, setHover] = useState<number | null>(null);
	const gradientId = `vp-trend-${useId().replace(/:/g, '')}`;
	const scores = points.map((point) => point.score);
	const count = points.length;

	// A range that leaves room around the line, in steps of 10, never narrower than 20 points.
	let lo = Math.max(0, Math.floor((Math.min(...scores) - 5) / 10) * 10);
	let hi = Math.min(100, Math.ceil((Math.max(...scores) + 5) / 10) * 10);

	if (hi - lo < 20) {
		hi = Math.min(100, lo + 20);
		lo = Math.max(0, hi - 20);
	}

	const x = (index: number) => (count > 1 ? (index / (count - 1)) * W : W / 2);
	const y = (value: number) => PAD_TOP + (1 - (value - lo) / (hi - lo)) * (H - PAD_TOP - PAD_BOTTOM);

	// Catmull-Rom → bezier: smooth through every day, never overshooting between two of them.
	const path = scores.reduce((d, value, index) => {
		if (0 === index) {
			return `M ${x(0)} ${y(value)}`;
		}

		const p0 = scores[Math.max(0, index - 2)];
		const p1 = scores[index - 1];
		const p3 = scores[Math.min(count - 1, index + 1)];
		const top = Math.min(y(p1), y(value));
		const bottom = Math.max(y(p1), y(value));
		const clamp = (v: number) => Math.min(bottom, Math.max(top, v));
		const c1x = x(index - 1) + (x(index) - x(Math.max(0, index - 2))) / 6;
		const c1y = clamp(y(p1) + (y(value) - y(p0)) / 6);
		const c2x = x(index) - (x(Math.min(count - 1, index + 1)) - x(index - 1)) / 6;
		const c2y = clamp(y(value) - (y(p3) - y(p1)) / 6);

		return `${d} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${x(index)} ${y(value)}`;
	}, '');

	const ticks = count > 2 ? [0, Math.floor((count - 1) / 2), count - 1] : points.map((_, index) => index);
	const active = null === hover ? null : points[hover];
	const pct = (v: number) => `${(v / H) * 100}%`;

	return (
		<div className="vp-trend">
			<div className="vp-trend-y" aria-hidden="true">
				<span style={{ top: pct(y(hi)) }}>{hi}</span>
				<span style={{ top: pct(y((hi + lo) / 2)) }}>{Math.round((hi + lo) / 2)}</span>
				<span style={{ top: pct(y(lo)) }}>{lo}</span>
			</div>

			<div className="vp-trend-plot" role="img" aria-label={label} onMouseLeave={() => setHover(null)}>
				<svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
					<defs>
						<linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
							<stop offset="0%" stopColor="#5007aa" stopOpacity="0.18" />
							<stop offset="100%" stopColor="#5007aa" stopOpacity="0" />
						</linearGradient>
					</defs>
					{[hi, (hi + lo) / 2, lo].map((value) => (
						<line key={value} x1="0" x2={W} y1={y(value)} y2={y(value)} className="vp-trend-grid" />
					))}
					{BANDS.filter((band) => band.value > lo && band.value < hi).map((band) => (
						<line key={band.value} x1="0" x2={W} y1={y(band.value)} y2={y(band.value)} className="vp-trend-band" />
					))}
					<path d={`${path} L ${x(count - 1)} ${H} L ${x(0)} ${H} Z`} fill={`url(#${gradientId})`} />
					<path d={path} className="vp-trend-line" />
				</svg>

				{BANDS.filter((band) => band.value > lo && band.value < hi).map((band) => (
					<span key={band.value} className="vp-trend-band-label" style={{ top: pct(y(band.value)) }} aria-hidden="true">
						{band.label}
					</span>
				))}

				{/* The latest day, marked. */}
				<i className="vp-trend-dot is-last" style={{ left: `${(x(count - 1) / W) * 100}%`, top: pct(y(scores[count - 1])) }} />

				{points.map((point, index) => (
					<span
						key={point.date}
						className="vp-trend-hit"
						style={{ left: `${(index / count) * 100}%`, width: `${100 / count}%` }}
						onMouseEnter={() => setHover(index)}
					/>
				))}

				{active && null !== hover && (
					<>
						<i className="vp-trend-cursor" style={{ left: `${(x(hover) / W) * 100}%` }} aria-hidden="true" />
						<i className="vp-trend-dot" style={{ left: `${(x(hover) / W) * 100}%`, top: pct(y(active.score)) }} aria-hidden="true" />
						<div
							className={`vp-trend-tip${hover > count * 0.7 ? ' is-left' : ''}`}
							style={{ left: `${(x(hover) / W) * 100}%` }}
						>
							<strong>
								{sprintf(
									/* translators: %d: overall score that day. */
									__('Score %d', 'vulopilot'),
									active.score
								)}
							</strong>
							<span>{shortDate(active.date)}</span>
						</div>
					</>
				)}
			</div>

			<div className="vp-trend-x" aria-hidden="true">
				{ticks.map((index) => (
					<span key={index} style={{ left: `${(x(index) / W) * 100}%` }}>
						{points[index] ? shortDate(points[index].date) : ''}
					</span>
				))}
			</div>
		</div>
	);
};

export default ScoreTrendChart;
