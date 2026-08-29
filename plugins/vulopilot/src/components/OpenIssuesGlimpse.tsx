import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { CardComponent, ListComponent, ModuleGuardComponent, ColumnComponent, BadgeComponent } from '@zyra/components';
import { scrollToId } from '@zyra/core';
import { useApiList } from '../services/useApiList';
import { FindingSeverity, getSeverityClass } from '../services/getSeverityClass';

interface FindingRow {
	id: number;
	title: string;
	severity: FindingSeverity;
	scanner_id: string;
}

interface OpenIssuesGlimpseProps {
	/**
	 * Finding category to fetch, e.g. 'geo'. Omit when the calling page's
	 * scanners don't all share one category (AI Content's `thin-content` is
	 * category 'seo' while `readability` is category 'content' — filtering
	 * by category here would AND against `scannerIds` server-side and wrongly
	 * exclude the 'seo'-category ones), and rely on `scannerIds` alone.
	 */
	category?: string;
	/**
	 * Further restricts the glimpse to a specific set of scanner ids within
	 * `category` — same comma-joined shape FindingsTable's own `scannerIds`
	 * prop uses. Omit to show every open finding in `category` (GEO's own
	 * usage covers every GEO scanner; a narrower page like AEO scopes this
	 * to just its own scanners so it doesn't glimpse unrelated GEO findings).
	 */
	scannerIds?: string[];
	/**
	 * Which section card (below, on the calling page) each scanner's
	 * findings live under — a glimpse row only has a scanner_id, not a
	 * section key, so the calling page supplies this lookup. Falls back to
	 * `fallbackSection` for a scanner id this map hasn't been extended for.
	 * Only meaningful for the default same-page scroll-and-highlight
	 * behavior — omit all three (`sectionMap`/`fallbackSection`/
	 * `anchorPrefix`) when passing `onItemClick` instead.
	 */
	sectionMap?: Record<string, string>;
	fallbackSection?: string;
	/** DOM id prefix each section card carries, e.g. 'geo-section-' → `#geo-section-{key}`. */
	anchorPrefix?: string;
	/**
	 * Overrides the default same-page scroll-and-highlight entirely — e.g.
	 * the Overview tab's own glimpse card needs to switch to a different
	 * tab first (its section anchors don't exist in Overview's own DOM),
	 * which this component has no way to know how to do itself.
	 */
	onItemClick?: (scannerId: string) => void;
	emptyTitle: string;
	emptyDesc: string;
	/** adminfont-* icon name shown next to the card title. Omit for no icon. */
	titleIcon?: string;
	/** Overrides the default "Open issues" card title. */
	title?: string;
	/** Rendered below the list, e.g. a "Fix Everything with AI" action. */
	footer?: React.ReactNode;
	/** Forwarded to the underlying `CardComponent` — e.g. `"ai-card"`, the class real AI-credit cards in this plugin carry (AiRecommendationsSidebar.tsx's "Recent AI Wins", CommerceTab.tsx's "Bulk AI optimization"). None of the current `OpenIssuesGlimpse` callers pass one — every real "Fix with AI" affordance on this glimpse is still a disabled stub (no bulk-fix backend yet, see AiOpportunitiesCard.tsx's own docblock) — kept as an optional slot for whichever caller earns it once one does. */
	className?: string;
}

/**
 * A short "what's open right now" preview above a findings-table page's own
 * full findings tables — the 5 most recent open findings, same fetch shape
 * NeedsAttentionWidget's own "Open issues" tab already uses (most-recent-
 * first; no true worst-severity-first ordering exists on the live
 * `/findings` list endpoint today, only in Reports' own
 * FindingRepository::get_top_findings_for_period(), which is Reports-scoped
 * and has no post id to link back to). Originally GEO.tsx-only
 * (src/pages/GEO/OpenIssuesGlimpse.tsx); generalized via props so AEO.tsx
 * can reuse the same fetch/scroll-and-highlight behavior scoped to its own
 * scanners instead of duplicating this component.
 */
const OpenIssuesGlimpse = ({
	category,
	scannerIds,
	sectionMap,
	fallbackSection,
	anchorPrefix,
	onItemClick,
	emptyTitle,
	emptyDesc,
	titleIcon,
	title,
	footer,
	className,
}: OpenIssuesGlimpseProps) => {
	const { data, total, isLoading } = useApiList<FindingRow>('findings', {
		category,
		scanner_id: scannerIds?.length ? scannerIds.join(',') : undefined,
		status: 'open',
		per_page: 5,
		orderby: 'id',
		order: 'desc',
	});

	const scrollToSection = (scannerId: string) => {
		if (!sectionMap || !fallbackSection || !anchorPrefix) {
			return;
		}

		const sectionKey = sectionMap[scannerId] ?? fallbackSection;
		scrollToId(`${anchorPrefix}${sectionKey}`);
	};

	const handleItemClick = onItemClick ?? scrollToSection;

	return (
		<ColumnComponent grid={6} fullHeight>
			<CardComponent
				className={className}
				title={title ?? __('Open issues', 'vulopilot')}
				titleIcon={titleIcon}
				desc={__('The 5 most recent open findings.', 'vulopilot')}
				isLoading={isLoading}
			>
				{!isLoading && data.length === 0 ? (
					<ModuleGuardComponent icon="check" title={emptyTitle} desc={emptyDesc} />
				) : (
					<>
						{!isLoading && (
							<BadgeComponent
								color="green"
								text={sprintf(
									/* translators: %d is the number of open findings. */
									__('%d open', 'vulopilot'),
									total
								)}
							/>
						)}
						<ListComponent
							className="mini-card report"
							items={data.map((finding) => ({
								id: String(finding.id),
								title: finding.title,
								action: () => handleItemClick(finding.scanner_id),
								tags: (
									<BadgeComponent
										color={getSeverityClass(finding.severity)}
										text={finding.severity}
									/>
								),
							}))}
						/>
						{footer}
					</>
				)}
			</CardComponent>
		</ColumnComponent>
	);
};

export default OpenIssuesGlimpse;
