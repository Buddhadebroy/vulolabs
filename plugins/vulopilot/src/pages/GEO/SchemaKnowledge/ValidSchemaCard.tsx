import { __, sprintf } from '@wordpress/i18n';
import { scrollToId } from '@zyra/core';
import {
	AnalyticsComponent,
	CardComponent,
	ColumnComponent,
	ModuleGuardComponent,
} from '@zyra/components';
import { useSchemaCoverage } from './useSchemaCoverage';

/**
 * "Pages with Valid Schema" — replaces the former "We understand your
 * organization, products, categories." headline+tiles card
 * (`BusinessUnderstandingCard`'s own 2nd, grid={8} half) per direct
 * instruction to remove that section and build the 2 cards from a
 * reference mockup instead. Real data — the exact same
 * `useSchemaCoverage()` snapshot `StructuredDataSection.tsx`'s own "Schema
 * Coverage" card already fetches (`GET /schema/coverage`,
 * SchemaCoverageAnalyzer's real per-page JSON-LD sample), just the 2 real
 * numbers it already returns (`pages_checked`/`pages_with_valid_schema`)
 * shown as a headline stat instead of a table. This is a real sample (up
 * to 15 recently-modified pages plus the homepage — see that hook's own
 * docblock), not a literal scan of every page on the site, so the real
 * numbers shown here are smaller-scale than a full-site count would be —
 * honest about what was actually checked rather than a fabricated
 * site-wide total. "View all pages →" scrolls to that same real Schema
 * Coverage table (`schema-knowledge-structured-data`) instead of
 * re-implementing it here.
 */
const ValidSchemaCard = () => {
	const { snapshot, isLoading } = useSchemaCoverage();

	return (
		<ColumnComponent grid={6}>
			<CardComponent
				title={__('Pages with Valid Schema', 'vulopilot')}
				titleIcon="check"
				desc={__(
					'Real sampled pages that have correct, error-free structured data.',
					'vulopilot'
				)}
				isLoading={isLoading}
			>
				{!isLoading && !snapshot ? (
					<ModuleGuardComponent
						icon="info"
						title={__('Not analyzed yet', 'vulopilot')}
						desc={__(
							'Run a Schema Check below to see real page coverage here.',
							'vulopilot'
						)}
					/>
				) : (
					snapshot && (
						<>
							<AnalyticsComponent
								variant="progress"
								cols={1}
								data={[
									{
										number: snapshot.pages_with_valid_schema,
										text: sprintf(
											/* translators: %d is how many of the real sampled pages were actually checked. */
											__('Out of %d pages', 'vulopilot'),
											snapshot.pages_checked
										),
										progress:
											snapshot.pages_checked > 0
												? Math.round(
														(snapshot.pages_with_valid_schema /
															snapshot.pages_checked) *
															100
													)
												: 0,
										colorClass: 'green-color',
									},
								]}
							/>

							<div className="valid-schema-without">
								<div className="valid-schema-without-label">
									{__('Pages without schema', 'vulopilot')}
								</div>
								<div className="valid-schema-without-value">
									{snapshot.pages_needing_attention}
								</div>
							</div>

							<button
								type="button"
								className="schema-view-pages-link kg-fix-view-all"
								onClick={() =>
									scrollToId('schema-knowledge-structured-data')
								}
							>
								{__('View all pages', 'vulopilot')}
								<i className="adminfont-arrow-right" />
							</button>
						</>
					)
				)}
			</CardComponent>
		</ColumnComponent>
	);
};

export default ValidSchemaCard;
