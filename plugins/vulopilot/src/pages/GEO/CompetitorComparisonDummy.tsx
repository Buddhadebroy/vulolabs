import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import './SeoVisibility.scss';

interface CompetitorComparisonDummyProps {
	badgeText: string;
	onClick: () => void;
}

/**
 * Dummy stand-in for vulopilot-pro's own BrandIntelligence module
 * CompetitorComparisonCard.tsx (the real 11-signal "your site vs.
 * competitor URLs" table) — same PRO-tag-plus-immediate-popup treatment
 * AuthorityTrendsDummy.tsx/KnowledgePanelDummy.tsx/OffSiteMentionsDummy.tsx
 * (this tab's other 3 Brand Intelligence cards) already use, so this
 * section stays visible instead of the previous `{Card && <Card />}`,
 * which rendered nothing at all when the filter slot hadn't resolved.
 *
 * Every row/cell here is fabricated (no real fetch behind any of them) and
 * inert (`.brand-competitor-comparison-dummy-table { pointer-events: none }`,
 * SeoVisibility.scss) — the whole table plus both header buttons all open
 * the same Pro popup. Rows read as "(Example competitor N)", not a
 * real-looking URL, per the same "don't let a fabricated row be mistaken
 * for real coverage" reasoning KnowledgePanelDummy.tsx's own docblock
 * documents (its "Hello world!"/"Sample Page" first pass collided with
 * WordPress's own real default posts).
 */
const SIGNAL_COLUMNS: string[] = [
	__('Organization schema', 'vulopilot'),
	__('Author schema', 'vulopilot'),
	__('FAQ schema', 'vulopilot'),
	__('Meta description', 'vulopilot'),
	__('Open Graph tags', 'vulopilot'),
];

const DUMMY_ROWS: { label: string; score: string; isSelf: boolean; signals: boolean[] }[] = [
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

const CompetitorComparisonDummy = ({ badgeText, onClick }: CompetitorComparisonDummyProps) => (
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
								{SIGNAL_COLUMNS.map((label) => (
									<th key={label}>{label}</th>
								))}
							</tr>
						</thead>
						<tbody>
							{DUMMY_ROWS.map((row) => (
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
										<td key={SIGNAL_COLUMNS[index]}>
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

export default CompetitorComparisonDummy;
