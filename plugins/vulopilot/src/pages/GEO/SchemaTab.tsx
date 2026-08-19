import { __, sprintf } from '@wordpress/i18n';
import {
	CardComponent,
	ColumnComponent,
	ModuleGuardComponent,
	BadgeComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { formatWpDate } from '../../services/formatWpDate';
import { useSchemaCoverage } from './useSchemaCoverage';

const DEV_TOOLS: { key: string; icon: string; title: string; desc: string }[] = [
	{
		key: 'inspector',
		icon: 'search',
		title: __('Schema Inspector', 'vulopilot'),
		desc: __(
			'See all schema detected on one specific page and where it comes from.',
			'vulopilot'
		),
	},
	{
		key: 'jsonld',
		icon: 'editor-code',
		title: __('JSON-LD Viewer', 'vulopilot'),
		desc: __(
			'View, copy and export the raw JSON-LD structured data from any page.',
			'vulopilot'
		),
	},
	{
		key: 'validator',
		icon: 'security',
		title: __('Schema Validator', 'vulopilot'),
		desc: __(
			"Validate this site's structured data against Google's Rich Results Test.",
			'vulopilot'
		),
	},
	{
		key: 'conflict',
		icon: 'analytics',
		title: __('Conflict Detection', 'vulopilot'),
		desc: __(
			'Detect duplicate or conflicting schema output by more than one plugin or theme.',
			'vulopilot'
		),
	},
];

/**
 * "Schema" tab of "Grow My Traffic" — restyled around a real "Schema
 * Coverage" table: `GET`/`POST /schema/coverage`
 * (SchemaCoverageAnalyzer, Free) samples up to 15 recently-modified real
 * pages (plus the real homepage), fetches each one's actual rendered HTML,
 * and extracts real `@type` values from whatever `application/ld+json`
 * blocks are actually there — no AI, no fabricated types or counts. The
 * per-type "problems" figure is an honest proportional estimate (this
 * plugin's own finding data is scoped per-post, not per-schema-@type — see
 * SchemaCoverageAnalyzer::analyze()'s own docblock), labelled as such
 * rather than presented as an exact count; the real underlying findings
 * themselves already live on the SEO tab's own "Links & schema" section
 * (same real `schema`/`structured-data`/`sitewide-structured-data`
 * scanners), linked to from here instead of duplicated into a second
 * table. "Inspect a specific page"/Developer Tools stay an honest
 * not-built-yet notice — no per-page JSON-LD viewer, live Rich Results
 * validation, or cross-plugin conflict detection exists anywhere in this
 * codebase today, Free or Pro.
 */
const SchemaTab = () => {
	const { snapshot, isLoading, isAnalyzing, analyze } = useSchemaCoverage();

	const totalProblems = snapshot
		? snapshot.coverage.reduce((sum, row) => sum + row.problems, 0)
		: 0;
	const typesWithProblems = snapshot
		? snapshot.coverage.filter((row) => row.problems > 0).length
		: 0;

	return (
		<ColumnComponent>
				<CardComponent
					title={__('Schema Coverage', 'vulopilot')}
					titleIcon="attachment"
					desc={__(
						'A real sample of what structured information this site actually outputs, sampled from its own live pages.',
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
										: __('Analyze schema coverage', 'vulopilot'),
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
								'Click "Analyze schema coverage" to sample this site’s real pages and see what structured data they actually output. This makes real HTTP requests to your own site, so it only runs when you ask.',
								'vulopilot'
							)}
						/>
					)}

					{snapshot && (
						<>
							<div className="kg-glance-grid schema-status-row">
								<div className="kg-glance-item">
									<div className="kg-glance-icon">
										<i className="adminfont-search" />
									</div>
									<div>
										<div className="kg-glance-label">
											{__('Pages checked', 'vulopilot')}
										</div>
										<div className="kg-glance-value">
											{snapshot.pages_checked}
										</div>
									</div>
								</div>
								<div className="kg-glance-item">
									<div className="kg-glance-icon">
										<i className="adminfont-attachment" />
									</div>
									<div>
										<div className="kg-glance-label">
											{__('Schema types detected', 'vulopilot')}
										</div>
										<div className="kg-glance-value">
											{snapshot.coverage.length}
										</div>
									</div>
								</div>
								<div className="kg-glance-item">
									<div className="kg-glance-icon">
										<i className="adminfont-error" />
									</div>
									<div>
										<div className="kg-glance-label">
											{__('Types with real open issues', 'vulopilot')}
										</div>
										<div className="kg-glance-value">
											{typesWithProblems}
										</div>
									</div>
								</div>
							</div>
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
											<th>{__('Est. problems', 'vulopilot')}</th>
											<th>{__('Status', 'vulopilot')}</th>
										</tr>
									</thead>
									<tbody>
										{snapshot.coverage.map((row) => (
											<tr key={row.type}>
												<td>{row.type}</td>
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
														color={row.problems === 0 ? 'green' : 'yellow'}
														text={
															row.problems === 0
																? __('Good', 'vulopilot')
																: __('Check', 'vulopilot')
														}
													/>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							)}

							{totalProblems > 0 && (
								<p className="desc schema-see-seo-tab">
									{__(
										'The real findings behind these numbers already live on the SEO tab’s "Links & schema" section.',
										'vulopilot'
									)}
								</p>
							)}
						</>
					)}
				</CardComponent>

				<CardComponent
					title={__('Inspect a specific page', 'vulopilot')}
					titleIcon="search"
				>
					<ModuleGuardComponent
						icon="info"
						title={__('Not built yet', 'vulopilot')}
						desc={__(
							'A per-page JSON-LD inspector (pick any page, see exactly what structured data it outputs) isn’t built yet — flag if you want it scoped next.',
							'vulopilot'
						)}
					/>
				</CardComponent>

				<CardComponent
					title={__('Developer Tools', 'vulopilot')}
					titleIcon="editor-code"
				>
					<div className="schema-dev-tools-grid">
						{DEV_TOOLS.map((tool) => (
							<div key={tool.key} className="schema-dev-tool-tile">
								<div className="kg-glance-icon">
									<i className={`adminfont-${tool.icon}`} />
								</div>
								<div>
									<div className="kg-check-title">{tool.title}</div>
									<div className="kg-check-desc">{tool.desc}</div>
									<BadgeComponent text={__('Not built yet', 'vulopilot')} />
								</div>
							</div>
						))}
					</div>
				</CardComponent>
		</ColumnComponent>
	);
};

export default SchemaTab;
