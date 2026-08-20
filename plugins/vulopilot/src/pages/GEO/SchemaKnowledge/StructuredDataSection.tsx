import { useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import {
	CardComponent,
	ColumnComponent,
	ModuleGuardComponent,
	BadgeComponent,
	PopupComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { formatWpDate } from '../../../services/formatWpDate';
import { useSchemaCoverage } from './useSchemaCoverage';
import type { SchemaCoverageRow } from './useSchemaCoverage';

/**
 * Per real schema.org @type icon — purely cosmetic, every value here is a
 * real, already-used-elsewhere-in-this-codebase adminfont- icon class
 * (confirmed live: search/attachment/error/check/product/location/
 * category/shield/link), not a guessed/invented icon name. Falls back to
 * the same generic 'attachment' icon the rest of this codebase already
 * uses for "content/document" schema types when a @type has no more
 * specific real-world icon (a theme/plugin can emit a @type not in this
 * list at all — the fallback keeps that row rendering, not blank).
 */
const TYPE_ICONS: Record<string, string> = {
	Organization: 'shield',
	WebSite: 'link',
	Product: 'product',
	LocalBusiness: 'location',
	BreadcrumbList: 'category',
};
const getTypeIcon = (type: string): string => TYPE_ICONS[type] ?? 'attachment';

/**
 * Real 3-tier status per row, computed from the same two real numbers the
 * table already shows (`found_on`, `problems` — SchemaCoverageAnalyzer's
 * own honest proportional estimate, see this file's own docblock) — no
 * new/fabricated signal. 0 problems is unambiguous ("Good"); otherwise
 * the tier is the real share of sampled pages of this type the estimate
 * says are affected: under half → "Check", half or more → "Problems".
 */
type CoverageStatus = 'good' | 'check' | 'problems';

const getRowStatus = (row: SchemaCoverageRow): CoverageStatus => {
	if (0 === row.problems) {
		return 'good';
	}
	const affectedShare = row.found_on > 0 ? row.problems / row.found_on : 1;
	return affectedShare >= 0.5 ? 'problems' : 'check';
};

const STATUS_CONFIG: Record<
	CoverageStatus,
	{ color: string; icon: string; label: string }
> = {
	good: { color: 'green', icon: 'check', label: __('Good', 'vulopilot') },
	check: { color: 'yellow', icon: 'alarm', label: __('Check', 'vulopilot') },
	problems: { color: 'red', icon: 'error', label: __('Problems', 'vulopilot') },
};

/**
 * "Structured Data" section of the merged "Schema & Knowledge" tab — the
 * real "Schema Coverage" table moved here unchanged from the standalone
 * Schema tab (`GET`/`POST /schema/coverage`, SchemaCoverageAnalyzer, Free):
 * samples up to 15 recently-modified real pages (plus the real homepage),
 * fetches each one's actual rendered HTML, and extracts real `@type`
 * values from whatever `application/ld+json` blocks are actually there —
 * no AI, no fabricated types or counts. The per-type "problems" figure is
 * an honest proportional estimate (this plugin's own finding data is
 * scoped per-post, not per-schema-@type — see
 * SchemaCoverageAnalyzer::analyze()'s own docblock), labelled as such
 * rather than presented as an exact count.
 *
 * "Inspect a specific page"/Developer Tools moved out to InspectorSection.tsx
 * (now real, see that file's own docblock) rather than staying here as
 * "not built yet" stubs.
 *
 * "View pages" opens a real popup listing exactly which real sampled
 * page(s)/the homepage carried that row's specific @type
 * (SchemaCoverageAnalyzer::analyze() now records `pages` per row, not
 * just a count) — replaces an earlier version where every row's "View
 * pages" was the exact same static link to the SEO tab regardless of
 * which type was clicked.
 */
const StructuredDataSection = () => {
	const { snapshot, isLoading, isAnalyzing, analyze } = useSchemaCoverage();
	// The real row a "View pages" click is showing — SchemaCoverageAnalyzer
	// now records exactly which sampled post(s)/the homepage actually
	// carried each @type (`row.pages`), so this opens a real list scoped
	// to that specific type instead of a generic, undifferentiated redirect
	// every row used to point at.
	const [pagesRow, setPagesRow] = useState<SchemaCoverageRow | null>(null);

	const totalProblems = snapshot
		? snapshot.coverage.reduce((sum, row) => sum + row.problems, 0)
		: 0;

	return (
		<ColumnComponent>
			{snapshot && (
				<CardComponent
					title={__('Schema Status', 'vulopilot')}
					titleIcon="info"
					desc={__(
						'VuloPilot checked how your website describes its pages, products, articles and business to search engines.',
						'vulopilot'
					)}
					isLoading={isLoading}
				>
					<div className="schema-status-grid">
						<div className="schema-status-item">
							<div className="schema-status-icon schema-status-icon--purple">
								<i className="adminfont-attachment" />
							</div>
							<div>
								<div className="schema-status-value">
									{snapshot.pages_checked}
								</div>
								<div className="schema-status-label">
									{__('Pages checked', 'vulopilot')}
								</div>
							</div>
						</div>
						<div className="schema-status-item">
							<div className="schema-status-icon schema-status-icon--green">
								<i className="adminfont-check" />
							</div>
							<div>
								<div className="schema-status-value">
									{snapshot.pages_with_valid_schema}
								</div>
								<div className="schema-status-label">
									{__('Pages with valid schema', 'vulopilot')}
								</div>
							</div>
						</div>
						<div className="schema-status-item">
							<div className="schema-status-icon schema-status-icon--orange">
								<i className="adminfont-alarm" />
							</div>
							<div>
								<div className="schema-status-value">
									{snapshot.pages_needing_attention}
								</div>
								<div className="schema-status-label">
									{__('Need attention', 'vulopilot')}
								</div>
							</div>
						</div>
						<div className="schema-status-item">
							<div className="schema-status-icon schema-status-icon--blue">
								<i className="adminfont-category" />
							</div>
							<div>
								<div className="schema-status-value">
									{snapshot.coverage.length}
								</div>
								<div className="schema-status-label">
									{__('Schema types detected', 'vulopilot')}
								</div>
							</div>
						</div>
					</div>
				</CardComponent>
			)}

			<CardComponent
				title={__('Schema Coverage', 'vulopilot')}
				titleIcon="attachment"
				desc={__(
					'See what structured information is on your website and where something is missing or incorrect — a real sample from its own live pages.',
					'vulopilot'
				)}
				isLoading={isLoading}
				action={
					<ButtonInput
						buttons={{
							text: isAnalyzing
								? __('Analyzing…', 'vulopilot')
								: snapshot
									? __('Re-analyze', 'vulopilot')
									: __('Run Schema Check', 'vulopilot'),
							onClick: analyze,
							disabled: isAnalyzing,
						}}
					/>
				}
			>
				{!isLoading && !snapshot && !isAnalyzing && (
					<ModuleGuardComponent
						icon="info"
						title={__('Not analyzed yet', 'vulopilot')}
						desc={__(
							'Click "Run Schema Check" to sample this site’s real pages and see what structured data they actually output. This makes real HTTP requests to your own site, so it only runs when you ask.',
							'vulopilot'
						)}
					/>
				)}

				{snapshot && (
					<>
						<p className="desc schema-generated-at">
							{sprintf(
								/* translators: %s is when this real schema sample was generated. */
								__('Last analyzed %s', 'vulopilot'),
								formatWpDate(snapshot.generated_at)
							)}
						</p>

						{0 === snapshot.coverage.length ? (
							<div className="desc">
								{__(
									'No structured data (JSON-LD) was found on any sampled page.',
									'vulopilot'
								)}
							</div>
						) : (
							<table className="crawler-table schema-coverage-table">
								<thead>
									<tr>
										<th>{__('Schema type', 'vulopilot')}</th>
										<th>{__('Plain-English meaning', 'vulopilot')}</th>
										<th>{__('Found on', 'vulopilot')}</th>
										<th>{__('Problems', 'vulopilot')}</th>
										<th>{__('Status', 'vulopilot')}</th>
										<th>{__('Action', 'vulopilot')}</th>
									</tr>
								</thead>
								<tbody>
									{snapshot.coverage.map((row) => {
										const status = getRowStatus(row);
										const statusConfig = STATUS_CONFIG[status];

										return (
											<tr key={row.type}>
												<td>
													<div className="schema-type-cell">
														<div className="schema-type-icon">
															<i
																className={`adminfont-${getTypeIcon(row.type)}`}
															/>
														</div>
														<span className="schema-type-name">
															{row.type}
														</span>
													</div>
												</td>
												<td>{row.meaning}</td>
												<td>
													{sprintf(
														/* translators: %d is how many of the real sampled pages carried this schema type. */
														__('%d pages', 'vulopilot'),
														row.found_on
													)}
												</td>
												<td>{row.problems}</td>
												<td>
													<BadgeComponent
														color={statusConfig.color}
														icon={statusConfig.icon}
														text={statusConfig.label}
													/>
												</td>
												<td>
													<button
														type="button"
														className="schema-view-pages-link"
														onClick={() => setPagesRow(row)}
													>
														{__('View pages', 'vulopilot')}
														<i className="adminfont-arrow-right" />
													</button>
												</td>
											</tr>
										);
									})}
								</tbody>
							</table>
						)}

						{totalProblems > 0 && (
							<p className="desc schema-see-seo-tab">
								{__(
									'The real findings behind these numbers already live in the "What Needs Fixing"/"All Business Identity Issues" sections above.',
									'vulopilot'
								)}
							</p>
						)}
					</>
				)}
			</CardComponent>

			<CardComponent title={__('Not seeing a schema type you need?', 'vulopilot')}>
				<p className="desc">
					{__(
						'Custom schema is added per page or post — open any post’s editor, then its SEO panel’s Schema tab.',
						'vulopilot'
					)}
				</p>
				<ButtonInput
					buttons={{
						text: __('Add custom schema', 'vulopilot'),
						onClick: () => {
							window.location.href = 'edit.php';
						},
					}}
				/>
			</CardComponent>

			<PopupComponent
				open={null !== pagesRow}
				onClose={() => setPagesRow(null)}
				width={28}
				height="auto"
				position="lightbox"
				header={{
					title: pagesRow
						? sprintf(
								/* translators: %s is a real schema.org @type, e.g. "Product". */
								__('Pages with %s schema', 'vulopilot'),
								pagesRow.type
							)
						: '',
				}}
			>
				{pagesRow && (
					<ul className="schema-view-pages-list">
						{pagesRow.pages.map((page) => (
							<li key={page.id} className="schema-view-pages-row">
								<div className="schema-view-pages-title">
									{page.title}
								</div>
								<div className="schema-view-pages-actions">
									<a href={page.url} target="_blank" rel="noreferrer">
										{__('View', 'vulopilot')}
									</a>
									{page.edit_url && (
										<a href={page.edit_url} target="_blank" rel="noreferrer">
											{__('Edit', 'vulopilot')}
										</a>
									)}
								</div>
							</li>
						))}
					</ul>
				)}
			</PopupComponent>
		</ColumnComponent>
	);
};

export default StructuredDataSection;
