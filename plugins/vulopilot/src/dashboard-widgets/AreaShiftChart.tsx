import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { Delta } from '../components/ui';
import type { AreaScore } from '../pages/Dashboard/scoring';

/**
 * Each area's score a week ago and today on one shared scale: a hollow dot for then, a filled dot for now, the
 * segment between them coloured by direction (a "dumbbell" chart). Rows never overlap, unlike a slope chart, and the
 * scale fits the data so a 3-point drop is visible. Every row opens the page that improves that area.
 */
const AreaShiftChart: React.FC<{ areas: AreaScore[] }> = ({ areas }) => {
	const values = areas.flatMap((area) => [area.score, area.score - area.delta]);
	let lo = Math.max(0, Math.floor((Math.min(...values) - 3) / 5) * 5);
	const hi = Math.min(100, Math.ceil((Math.max(...values) + 3) / 5) * 5);

	if (hi - lo < 20) {
		lo = Math.max(0, hi - 20);
	}

	// An even span, so the middle tick is a round number too (80 · 90 · 100, not 85 · 93 · 100).
	if ((hi - lo) % 10) {
		lo = Math.max(0, lo - 5);
	}

	const pos = (value: number) => `${((Math.max(lo, Math.min(hi, value)) - lo) / (hi - lo)) * 100}%`;
	const ticks = [lo, Math.round((lo + hi) / 2), hi];

	return (
		<div className="vp-shift">
			<div className="vp-shift-scale" aria-hidden="true">
				<span />
				<span className="vp-shift-axis">
					{ticks.map((tick) => (
						<em key={tick} style={{ left: pos(tick) }}>
							{tick}
						</em>
					))}
				</span>
				<span />
			</div>

			<ul>
				{areas.map((area) => {
					const before = area.score - area.delta;
					const direction = area.delta > 0 ? 'is-up' : area.delta < 0 ? 'is-down' : 'is-flat';
					const left = Math.min(before, area.score);
					const right = Math.max(before, area.score);

					return (
						<li key={area.key}>
							<a
								href={area.href}
								className={direction}
								aria-label={sprintf(
									/* translators: 1: area name, 2: score 7 days ago, 3: score today. */
									__('%1$s: %2$d a week ago, %3$d today', 'vulopilot'),
									area.label,
									before,
									area.score
								)}
							>
								<span className="vp-shift-name">
									<i className={`adminfont-${area.icon}`} aria-hidden="true" />
									{area.label}
								</span>
								<span className="vp-shift-track" aria-hidden="true">
									{ticks.map((tick) => (
										<b key={tick} style={{ left: pos(tick) }} />
									))}
									<span className="vp-shift-span" style={{ left: pos(left), width: `calc(${pos(right)} - ${pos(left)})` }} />
									<i className="vp-shift-then" style={{ left: pos(before) }} />
									<i className="vp-shift-now" style={{ left: pos(area.score) }} />
								</span>
								<span className="vp-shift-score">
									{area.score}
									<span className="vp-shift-delta">
										{0 === area.delta ? <em>{__('steady', 'vulopilot')}</em> : <Delta change={area.delta} suffix="" />}
									</span>
								</span>
							</a>
						</li>
					);
				})}
			</ul>

			<div className="vp-shift-legend" aria-hidden="true">
				<span>
					<i className="vp-shift-then" />
					{__('7 days ago', 'vulopilot')}
				</span>
				<span>
					<i className="vp-shift-now" />
					{__('Today', 'vulopilot')}
				</span>
			</div>
		</div>
	);
};

export default AreaShiftChart;
