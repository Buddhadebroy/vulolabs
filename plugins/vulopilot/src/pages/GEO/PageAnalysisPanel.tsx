/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ModuleGuardComponent, ListComponent, BadgeComponent } from '@zyra/components';
import './PageAnalysisPanel.scss';

type CheckStatus = 'pass' | 'warn' | 'fail';

interface PageCheck {
	key: string;
	label: string;
	status: CheckStatus;
	message: string;
}

interface PageAnalysisResponse {
	post_id: number;
	title: string;
	permalink: string;
	meta_description: string;
	analyzed_at: string;
	checks: PageCheck[];
}

interface PageAnalysisPanelProps {
	postId: number;
	onClose: () => void;
}

/**
 * zyra's own icon font only ever ships glyphs for 4 classes — confirmed by
 * reading its actual runtime-injected CSS (`.adminfont-check`/`-error`/
 * `-close`/`-close-delete`, nothing else) — `adminfont-warning` doesn't
 * exist there and silently renders no glyph at all, same "referenced in
 * this codebase's source but not in the installed zyra package" class of
 * bug `TypographyComponent` was. `adminfont-error` is the closest real
 * glyph to "needs attention" among the 4 that actually exist.
 */
const STATUS_ICON: Record<CheckStatus, string> = {
	pass: 'check green',
	warn: 'error red',
	fail: 'close red',
};

/** Real per-check status pill (reference mockup) — reuses `BadgeComponent`'s own `border` outline look, same real pass/warn/fail 3-way this row's own `STATUS_ICON` above already keys off. */
const STATUS_BADGE: Record<CheckStatus, { text: string; color: string }> = {
	pass: { text: __('Passed', 'vulopilot'), color: 'green' },
	warn: { text: __('Needs work', 'vulopilot'), color: 'orange' },
	fail: { text: __('Failed', 'vulopilot'), color: 'red' },
};

/**
 * "Page Analysis" (SEO & Visibility → SEO's own "Pages & Posts" table, a new
 * "Analyze" row action) — `GET /seo/analyze-page?post_id=…`
 * (Controllers\Seo::get_page_analysis(), Free). Every one of the 11 checks
 * below is real and computed fresh for THIS one page at request time (see
 * that endpoint's own docblock) — a Title Tag/H1/Images/Indexability check
 * with no existing scanner at all, reused real logic from
 * MetaDescriptionScanner/HeadingStructureScanner/ThinContentScanner/
 * CanonicalUrlScanner/SchemaScanner/OpenGraphScanner for the rest, and the
 * real, already-stored Broken Links findings for this page for "Internal
 * Links." Nothing here is estimated or sampled.
 */
const PageAnalysisPanel = ({ postId, onClose }: PageAnalysisPanelProps) => {
	const [data, setData] = useState<PageAnalysisResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		setIsLoading(true);
		setError(null);
		setData(null);

		getApiResponse<PageAnalysisResponse>(
			getApiLink(appLocalizer, `seo/analyze-page?post_id=${postId}`),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setData(response);
				} else {
					setError(
						__('Could not analyze this page. Please try again.', 'vulopilot')
					);
				}
			})
			.catch(() =>
				setError(
					__('Could not analyze this page. Please try again.', 'vulopilot')
				)
			)
			.finally(() => setIsLoading(false));
	}, [postId]);

	return (
		<CardComponent
			className="page-analysis-panel"
			title={__('Page Analysis', 'vulopilot')}
			action={
				<button
					type="button"
					className="page-analysis-panel-close"
					onClick={onClose}
					aria-label={__('Close', 'vulopilot')}
				>
					<i className="adminfont-close" />
				</button>
			}
			isLoading={isLoading}
		>
			{error && (
				<ModuleGuardComponent
					icon="error"
					title={__('Something went wrong', 'vulopilot')}
					desc={error}
				/>
			)}
			{data && (
				<>
					<div className="page-analysis-panel-meta">
						{data.title}
						<span className="desc">
							{new Date(data.analyzed_at).toLocaleString()}
						</span>
					</div>

					<div className="page-analysis-search-preview">
						<div className="page-analysis-search-preview-title">
							{data.title}
						</div>
						<div className="page-analysis-search-preview-url">
							{data.permalink}
						</div>
						<div className="page-analysis-search-preview-desc">
							{data.meta_description ||
								__('No meta description set.', 'vulopilot')}
						</div>
					</div>

					<ListComponent
						className="mini-card report"
						items={data.checks.map((template) => ({
							id: template.id,
							icon: STATUS_ICON[template.status],
							title: template.label,
							desc: template.message,
							tags: (
								<>
									<BadgeComponent
										color={STATUS_BADGE[template.status].color}
										text={STATUS_BADGE[template.status].text}
									/>
									<i className="adminfont-pagination-right-arrow ai-copilot-row-arrow" />
								</>
							),
						}))}
					/>
				</>
			)}
		</CardComponent>
	);
};

export default PageAnalysisPanel;
