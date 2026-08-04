import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ListComponent, ModuleGuardComponent } from '@zyra/components';
import { useApiList } from '../../services/useApiList';
import { getSeverityClass, FindingSeverity } from '../../services/getSeverityClass';

interface GeoFindingRow {
	id: number;
	title: string;
	severity: FindingSeverity;
	scanner_id: string;
}

/**
 * Which GEO_SECTIONS card (below, in GEO.tsx) each scanner's findings live
 * under — same grouping GEO.tsx's own GEO_SECTIONS array already defines,
 * duplicated here as a lookup since a glimpse row only has a scanner_id, not
 * a section key. Falls back to 'entities' for a scanner id this map hasn't
 * been extended for yet, rather than silently not scrolling anywhere.
 */
const SCANNER_TO_SECTION: Record<string, string> = {
	'geo-summary-block': 'summary',
	'geo-faq-opportunity': 'summary',
	'geo-citation-opportunities': 'evidence',
	'geo-chunking': 'structure',
	'geo-semantic-structure': 'structure',
	'geo-author-info': 'entities',
	'geo-eeat-signals': 'entities',
	'geo-entity-naming-consistency': 'entities',
	'geo-trust-signals': 'entities',
	'llms-txt-missing': 'crawlability',
	'stale-content': 'freshness',
	'aeo-schema': 'aeo',
};

/**
 * Each GEO_SECTIONS card in GEO.tsx below carries a matching
 * `id="geo-section-{key}"` anchor — jumps there and briefly flashes it,
 * rather than a per-row highlight: GEO_SECTIONS' tables are independently
 * paginated/status-filtered (each its own FindingsTable), so there's no
 * guarantee the specific row this glimpse links to is even on the
 * currently-loaded page of its own table.
 */
const scrollToSection = (scannerId: string) => {
	const sectionKey = SCANNER_TO_SECTION[scannerId] ?? 'entities';
	const el = document.getElementById(`geo-section-${sectionKey}`);

	if (!el) {
		return;
	}

	el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	el.classList.add('vulopilot-glimpse-highlight');
	setTimeout(() => el.classList.remove('vulopilot-glimpse-highlight'), 1200);
};

/**
 * A short "what's open right now" preview above the GEO page's full
 * findings tables — the most recent 5 open 'geo'-category findings, same
 * fetch shape NeedsAttentionWidget's own "Open issues" tab already uses
 * (most-recent-first; no true worst-severity-first ordering exists on the
 * live `/findings` list endpoint today, only in Reports' own
 * FindingRepository::get_top_findings_for_period(), which is Reports-scoped
 * and has no post id to link back to).
 */
const OpenIssuesGlimpse = () => {
	const { data, total, isLoading } = useApiList<GeoFindingRow>('findings', {
		category: 'geo',
		status: 'open',
		per_page: 5,
		orderby: 'id',
		order: 'desc',
	});

	return (
		<CardComponent title={__('Open issues', 'vulopilot')} isLoading={isLoading}>
			{!isLoading && data.length === 0 ? (
				<ModuleGuardComponent
					icon="check"
					title={__("You're all caught up", 'vulopilot')}
					desc={__('No open GEO findings right now.', 'vulopilot')}
				/>
			) : (
				<>
					{!isLoading && (
						<div className="desc">
							{sprintf(
								/* translators: %d is the number of open GEO findings. */
								__('%d open', 'vulopilot'),
								total
							)}
						</div>
					)}
					<ListComponent
						items={data.map((finding) => ({
							id: String(finding.id),
							title: finding.title,
							action: () => scrollToSection(finding.scanner_id),
							tags: (
								<span
									className={`admin-badge ${getSeverityClass(finding.severity)}`}
								>
									{finding.severity}
								</span>
							),
						}))}
					/>
				</>
			)}
		</CardComponent>
	);
};

export default OpenIssuesGlimpse;
