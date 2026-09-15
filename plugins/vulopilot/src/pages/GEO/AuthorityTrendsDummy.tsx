import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import {
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	XAxis,
	YAxis,
} from 'recharts';
import './SeoVisibility.scss';

interface AuthorityTrendsDummyProps {
	badgeText: string;
	onClick: () => void;
}

/**
 * Dummy stand-in for vulopilot-pro's own BrandIntelligence module
 * AuthorityTrendsCard.tsx (the real Brand/Trust/Authority/Entity score
 * history chart) — same PRO-tag-plus-immediate-popup treatment
 * AutomationsManageDummy.tsx/AutomationsActivityDummy.tsx already use for
 * their own Pro-only cards, so BrandVisibilityTab.tsx shows this section
 * even when Brand Intelligence isn't active instead of leaving it blank.
 *
 * The plotted series is entirely fabricated (same shape/legend as the real
 * card, no real snapshot behind any point) and inert
 * (`.recharts-wrapper { pointer-events: none }`, SeoVisibility.scss) so a
 * click always reaches the wrapping overlay instead, which opens the same
 * Pro popup the rest of this tab uses.
 */
const DUMMY_HISTORY = [
	{ day: __('Day 1', 'vulopilot'), brand: 92, trust: 96, authority: 88, entity: 85 },
	{ day: __('Day 2', 'vulopilot'), brand: 90, trust: 96, authority: 86, entity: 85 },
	{ day: __('Day 3', 'vulopilot'), brand: 89, trust: 95, authority: 85, entity: 84 },
	{ day: __('Day 4', 'vulopilot'), brand: 89, trust: 95, authority: 85, entity: 84 },
	{ day: __('Day 5', 'vulopilot'), brand: 89, trust: 95, authority: 85, entity: 84 },
	{ day: __('Day 6', 'vulopilot'), brand: 89, trust: 95, authority: 85, entity: 84 },
	{ day: __('Day 7', 'vulopilot'), brand: 89, trust: 95, authority: 85, entity: 84 },
];

const AuthorityTrendsDummy = ({ badgeText, onClick }: AuthorityTrendsDummyProps) => (
	<>
		{/* Docks against `.card-wrapper` (ColumnComponent's own root div,
		 * always `position: relative` in zyra) rather than a wrapper div of
		 * its own — same "admin-tag pro-tag" sibling markup
		 * AutomationsManageDummy.tsx already uses, since CardComponent's own
		 * `badges` prop drops any custom class. */}
		<span className="admin-tag pro-tag">
			<i className="adminfont-pro-tag" />
			{badgeText}
		</span>
		<CardComponent
			title={__('Authority Trends', 'vulopilot')}
			titleIcon="identity-verification"
			desc={__(
				'Brand, Trust, Authority, and Entity scores over time, one point per day the snapshot schedule ran.',
				'vulopilot'
			)}
		>
			<div
				className="brand-authority-trends-dummy"
				role="button"
				tabIndex={0}
				onClick={onClick}
				onKeyDown={(event) => {
					if ('Enter' === event.key || ' ' === event.key) {
						onClick();
					}
				}}
			>
				<ResponsiveContainer width="100%" height={240}>
					<LineChart data={DUMMY_HISTORY}>
						<CartesianGrid strokeDasharray="3 3" />
						<XAxis dataKey="day" />
						<YAxis domain={[0, 100]} />
						<Legend />
						<Line
							type="monotone"
							dataKey="authority"
							name={__('Authority', 'vulopilot')}
							stroke="#F59E0B"
							dot={false}
						/>
						<Line
							type="monotone"
							dataKey="brand"
							name={__('Brand', 'vulopilot')}
							stroke="#4B227A"
							dot={false}
						/>
						<Line
							type="monotone"
							dataKey="entity"
							name={__('Entity', 'vulopilot')}
							stroke="#EF4444"
							dot={false}
						/>
						<Line
							type="monotone"
							dataKey="trust"
							name={__('Trust', 'vulopilot')}
							stroke="#00EED0"
							dot={false}
						/>
					</LineChart>
				</ResponsiveContainer>
			</div>
		</CardComponent>
	</>
);

export default AuthorityTrendsDummy;
