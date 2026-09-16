import { __ } from '@wordpress/i18n';
import { AnalyticsComponent, BadgeComponent, CardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
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

interface DummyCardProps {
	badgeText: string;
	onClick: () => void;
}

/**
 * BrandVisibilityTab.tsx's 4 Pro-gated "still show the section, PRO-tagged,
 * with fabricated content behind a click-through popup" cards, one file per
 * the AutomationsProDummies.tsx precedent (Automations folder) —
 * AuthorityTrendsDummy/KnowledgePanelDummy/OffSiteMentionsDummy/
 * CompetitorComparisonDummy used to be 4 separate files, each a single-use
 * dummy stand-in for one real vulopilot-pro BrandIntelligence card
 * (AuthorityTrendsCard.tsx/KnowledgePanelCard.tsx/OffSiteMentionsCard.tsx/
 * CompetitorComparisonCard.tsx), consolidated here since none of the 4 has
 * any other consumer. Every row/stat in all 4 is fabricated (no real fetch
 * behind any of them) and inert — each card's own dummy content class is
 * `pointer-events: none` (SeoVisibility.scss) so a click always reaches the
 * wrapping overlay, which opens the same Pro popup either way.
 */

const DUMMY_AUTHORITY_HISTORY = [
	{ day: __('Day 1', 'vulopilot'), brand: 92, trust: 96, authority: 88, entity: 85 },
	{ day: __('Day 2', 'vulopilot'), brand: 90, trust: 96, authority: 86, entity: 85 },
	{ day: __('Day 3', 'vulopilot'), brand: 89, trust: 95, authority: 85, entity: 84 },
	{ day: __('Day 4', 'vulopilot'), brand: 89, trust: 95, authority: 85, entity: 84 },
	{ day: __('Day 5', 'vulopilot'), brand: 89, trust: 95, authority: 85, entity: 84 },
	{ day: __('Day 6', 'vulopilot'), brand: 89, trust: 95, authority: 85, entity: 84 },
	{ day: __('Day 7', 'vulopilot'), brand: 89, trust: 95, authority: 85, entity: 84 },
];

/**
 * Dummy stand-in for vulopilot-pro's own BrandIntelligence module
 * AuthorityTrendsCard.tsx (the real Brand/Trust/Authority/Entity score
 * history chart).
 */
export const AuthorityTrendsDummy = ({ badgeText, onClick }: DummyCardProps) => (
	<>
		{/* Docks against `.card-wrapper` (ColumnComponent's own root div,
		 * always `position: relative` in zyra) rather than a wrapper div of
		 * its own — CardComponent's own `badges` prop drops any custom
		 * class. */}
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
					<LineChart data={DUMMY_AUTHORITY_HISTORY}>
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

/**
 * Deliberately NOT plausible real post titles ("Hello world!"/"Sample
 * Page" — WordPress's own default posts, present on virtually every
 * install — were tried here first and read as real scan results about
 * this site's own content, the opposite of what a fabricated example
 * should do) — "(Example post N)" so this list can never be mistaken for
 * a real finding regardless of what's actually on the site it renders on.
 * Same reasoning behind OffSiteMentionsDummy's "(Example mention N)"/
 * CompetitorComparisonDummy's "(Example competitor N)" below.
 */
const DUMMY_KNOWLEDGE_PANEL_FINDINGS: { title: string }[] = [
	{ title: __('No author schema found: (Example post 1)', 'vulopilot') },
	{ title: __('No author schema found: (Example post 2)', 'vulopilot') },
	{ title: __('No author schema found: (Example post 3)', 'vulopilot') },
	{ title: __('No author schema found: (Example post 4)', 'vulopilot') },
];

/**
 * Dummy stand-in for vulopilot-pro's own BrandIntelligence module
 * KnowledgePanelCard.tsx (the real Organization/author Person schema
 * one-click optimizer).
 */
export const KnowledgePanelDummy = ({ badgeText, onClick }: DummyCardProps) => (
	<>
		<span className="admin-tag pro-tag">
			<i className="adminfont-pro-tag" />
			{badgeText}
		</span>
		<CardComponent
			title={__('Knowledge Panel Optimization', 'vulopilot')}
			titleIcon="identity-verification"
			desc={__(
				'Adds Organization schema (homepage) and author Person schema (posts/pages) wherever missing — the structured data Google Knowledge Panels and AI answer engines read. Deterministic, no AI cost.',
				'vulopilot'
			)}
			action={
				<ButtonInput
					buttons={{
						text: __('Optimize Knowledge Panel', 'vulopilot'),
						rightIcon: 'pagination-right-arrow',
						color: 'text-purple',
						onClick,
					}}
				/>
			}
		>
			<div
				className="brand-knowledge-panel-dummy"
				role="button"
				tabIndex={0}
				onClick={onClick}
				onKeyDown={(event) => {
					if ('Enter' === event.key || ' ' === event.key) {
						onClick();
					}
				}}
			>
				<AnalyticsComponent
					variant="small-card"
					cols={3}
					data={[
						{
							icon: 'person',
							colorClass: 'yellow',
							number: 4,
							text: __(
								'pages missing an author schema',
								'vulopilot'
							),
						},
					]}
				/>
				<ul className="brand-knowledge-panel-dummy-list">
					{DUMMY_KNOWLEDGE_PANEL_FINDINGS.map((finding) => (
						<li
							key={finding.title}
							className="brand-knowledge-panel-dummy-item"
							aria-hidden="true"
						>
							<span className="brand-knowledge-panel-dummy-icon">
								<i className="adminfont-error" />
							</span>
							<div className="brand-knowledge-panel-dummy-title">
								{finding.title}
							</div>
							<BadgeComponent
								text={__('Author Schema', 'vulopilot')}
								color="purple"
								variant="dot"
							/>
						</li>
					))}
				</ul>
			</div>
		</CardComponent>
	</>
);

const DUMMY_MENTIONS: { title: string; source: string }[] = [
	{ title: __('(Example mention 1)', 'vulopilot'), source: 'r/example' },
	{ title: __('(Example mention 2)', 'vulopilot'), source: 'r/example' },
	{ title: __('(Example mention 3)', 'vulopilot'), source: 'r/example' },
	{ title: __('(Example mention 4)', 'vulopilot'), source: 'r/example' },
];

/**
 * Dummy stand-in for vulopilot-pro's own BrandIntelligence module
 * OffSiteMentionsCard.tsx (the real Google News/Bing News/Reddit mention
 * tracker).
 */
export const OffSiteMentionsDummy = ({ badgeText, onClick }: DummyCardProps) => (
	<>
		<span className="admin-tag pro-tag">
			<i className="adminfont-pro-tag" />
			{badgeText}
		</span>
		<CardComponent
			title={__('Off-site mentions', 'vulopilot')}
			titleIcon="web-page-website"
			desc={__(
				'Real mentions of your site, found via Google News, Bing News, and Reddit — 3 free, keyless sources. This covers what those 3 indexes surface, not the full web (blogs, other forums, other social platforms, review sites), so treat counts as a real but partial signal, not a comprehensive total the way a paid tool like Ahrefs Brand Radar would be.',
				'vulopilot'
			)}
		>
			<div
				className="brand-offsite-mentions-dummy"
				role="button"
				tabIndex={0}
				onClick={onClick}
				onKeyDown={(event) => {
					if ('Enter' === event.key || ' ' === event.key) {
						onClick();
					}
				}}
			>
				<div className="brand-offsite-mentions-dummy-summary">
					<div className="brand-offsite-mentions-dummy-stat">
						<span className="brand-offsite-mentions-dummy-value">
							12
						</span>
						<span className="desc">{__('mentions', 'vulopilot')}</span>
					</div>
					<div className="brand-offsite-mentions-dummy-stat">
						<span className="brand-offsite-mentions-dummy-value">
							5
						</span>
						<span className="desc">
							{__('citing domains', 'vulopilot')}
						</span>
					</div>
				</div>

				<ul className="brand-offsite-mentions-dummy-list">
					{DUMMY_MENTIONS.map((mention) => (
						<li
							key={mention.title}
							className="brand-offsite-mentions-dummy-item"
							aria-hidden="true"
						>
							<div className="brand-offsite-mentions-dummy-title">
								{mention.title}
							</div>
							<div className="desc brand-offsite-mentions-dummy-meta">
								{mention.source} · {__('today', 'vulopilot')}
							</div>
						</li>
					))}
				</ul>
			</div>
		</CardComponent>
	</>
);

const COMPETITOR_SIGNAL_COLUMNS: string[] = [
	__('Organization schema', 'vulopilot'),
	__('Author schema', 'vulopilot'),
	__('FAQ schema', 'vulopilot'),
	__('Meta description', 'vulopilot'),
	__('Open Graph tags', 'vulopilot'),
];

const DUMMY_COMPETITOR_ROWS: { label: string; score: string; isSelf: boolean; signals: boolean[] }[] = [
	{
		label: __('Your Site', 'vulopilot'),
		score: '—',
		isSelf: true,
		signals: [true, false, false, true, true],
	},
	{
		label: __('(Example competitor 1)', 'vulopilot'),
		score: '82/100',
		isSelf: false,
		signals: [true, true, false, true, true],
	},
	{
		label: __('(Example competitor 2)', 'vulopilot'),
		score: '74/100',
		isSelf: false,
		signals: [true, false, true, true, false],
	},
];

/**
 * Dummy stand-in for vulopilot-pro's own BrandIntelligence module
 * CompetitorComparisonCard.tsx (the real 11-signal "your site vs.
 * competitor URLs" table).
 */
export const CompetitorComparisonDummy = ({ badgeText, onClick }: DummyCardProps) => (
	<>
		<span className="admin-tag pro-tag">
			<i className="adminfont-pro-tag" />
			{badgeText}
		</span>
		<CardComponent
			title={__('Competitor Comparison', 'vulopilot')}
			titleIcon="tools"
			desc={__(
				'Compares your own site against competitor pages across 11 real signals — Organization/Author/FAQ/Breadcrumb/Review schema, meta description, Open Graph, Twitter Card, an About/Contact link, a Privacy Policy link, and real visible contact info. Real page fetches, no AI involved.',
				'vulopilot'
			)}
			action={
				<ButtonInput
					buttons={[
						{
							text: __('Add competitors', 'vulopilot'),
							onClick,
							icon: 'plus',
							color: 'border-purple',
						},
						{
							text: __('Analyze competitors', 'vulopilot'),
							onClick,
						},
					]}
				/>
			}
		>
			<div
				className="brand-competitor-comparison-dummy"
				role="button"
				tabIndex={0}
				onClick={onClick}
				onKeyDown={(event) => {
					if ('Enter' === event.key || ' ' === event.key) {
						onClick();
					}
				}}
			>
				<div className="brand-competitor-comparison-dummy-table-wrapper">
					<table
						className="brand-competitor-comparison-dummy-table"
						aria-hidden="true"
					>
						<thead>
							<tr>
								<th>{__('URL', 'vulopilot')}</th>
								<th>{__('Score', 'vulopilot')}</th>
								{COMPETITOR_SIGNAL_COLUMNS.map((label) => (
									<th key={label}>{label}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{DUMMY_COMPETITOR_ROWS.map((row) => (
								<tr
									key={row.label}
									className={
										row.isSelf
											? 'brand-competitor-comparison-dummy-row-self'
											: undefined
									}
								>
									<td>{row.label}</td>
									<td>{row.score}</td>
									{row.signals.map((hasSignal, index) => (
										<td key={COMPETITOR_SIGNAL_COLUMNS[index]}>
											{hasSignal ? '✓' : '—'}
										</td>
									))}
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</CardComponent>
	</>
);
