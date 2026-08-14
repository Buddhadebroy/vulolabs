/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
	NoticeManager,
} from '@zyra/components';
import './ImproveSpeed.scss';

interface PageSpeedRow {
	id: number;
	url: string;
	title: string;
	main_issue: string | null;
}

interface PageSpeedIssue {
	issue: string;
	affected_pages: number;
}

interface PageSpeedResponse {
	summary: { total: number; last_scanned_at: string | null };
	top_issues: PageSpeedIssue[];
	data: PageSpeedRow[];
	total: number;
}

/**
 * "Performance Opportunities" — the real, deduplicated `main_issue` values
 * across every scanned page (Repositories\PageSpeedRepository::get_top_issues(),
 * the same real data Slow Pages' own "Why these pages are slow?" sidebar
 * shows), ranked by how many real pages each affects, with the real
 * affected pages listed underneath each one — every `main_issue` is either
 * a real Google Lighthouse opportunity-audit title (once a PSI key is
 * configured — see Services\PageSpeedScanner's own docblock) or a plain
 * real load-time-based label, never invented copy. Reuses `GET /page-speed`
 * rather than a new endpoint — that response already carries both
 * `top_issues` and the full row list this tab cross-references to build
 * each issue's own affected-pages list, entirely client-side.
 */
const PerformanceOpportunitiesTab = () => {
	const [response, setResponse] = useState<PageSpeedResponse | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [isScanning, setIsScanning] = useState(false);
	const [expandedIssue, setExpandedIssue] = useState<string | null>(null);

	const load = () => {
		setIsLoading(true);
		setError(null);

		getApiResponse<PageSpeedResponse>(
			getApiLink(appLocalizer, 'page-speed') + '?per_page=200',
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((data) => {
				if (data) {
					setResponse(data);
				} else {
					setError(__( 'Could not load Performance Opportunities.', 'vulopilot' ));
				}
			})
			.finally(() => setIsLoading(false));
	};

	useEffect(() => {
		load();
	}, []);

	const handleScan = () => {
		setIsScanning(true);

		sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'page-speed'), {}).then(
			(result) => {
				NoticeManager.add({
					uniqueKey: 'vulopilot-page-speed-scan-opportunities',
					type: result ? 'success' : 'error',
					position: 'float',
					message: result
						? __(
								'Scan started — checking your pages in the background. Results will appear here as each page finishes.',
								'vulopilot'
							)
						: __( 'Could not start the scan. Please try again.', 'vulopilot' ),
				});
			}
		).finally(() => setIsScanning(false));
	};

	if (error) {
		return (
			<ContainerComponent general>
				<ColumnComponent>
					<CardComponent title={__( 'Performance Opportunities', 'vulopilot' )}>
						<ModuleGuardComponent
							icon="error"
							title={__( 'Could not load Performance Opportunities', 'vulopilot' )}
							desc={error}
							buttonText={__( 'Retry', 'vulopilot' )}
							onButtonClick={load}
						/>
					</CardComponent>
				</ColumnComponent>
			</ContainerComponent>
		);
	}

	const topIssues = response?.top_issues ?? [];
	const rows = response?.data ?? [];

	return (
		<ContainerComponent general>
			<ColumnComponent>
				<p className="page-speed-intro">
					{__(
						'The real, most common issues found across your scanned pages — fix the ones affecting the most pages first for the biggest impact.',
						'vulopilot'
					)}
				</p>

				<div className="page-speed-toolbar">
					<div />
					<div className="page-speed-toolbar-actions">
						<button
							type="button"
							className="page-speed-scan-button"
							onClick={handleScan}
							disabled={isScanning}
						>
							<i className={`adminfont-refresh ${isScanning ? 'is-spinning' : ''}`} />
							{isScanning ? __( 'Starting…', 'vulopilot' ) : __( 'Scan Again', 'vulopilot' )}
						</button>
					</div>
				</div>

				<CardComponent isLoading={isLoading}>
					{0 === topIssues.length ? (
						<ModuleGuardComponent
							icon="check"
							title={__( 'No issues detected', 'vulopilot' )}
							desc={
								0 === rows.length
									? __(
											'No pages scanned yet — click "Scan Again" to check your real pages for common slowdown causes.',
											'vulopilot'
										)
									: __(
											'Every scanned page looks good — no common issues detected.',
											'vulopilot'
										)
							}
						/>
					) : (
						<ul className="page-speed-opportunities-list">
							{topIssues.map((item) => {
								const affectedPages = rows.filter(
									(row) => row.main_issue === item.issue
								);
								const isExpanded = expandedIssue === item.issue;

								return (
									<li key={item.issue} className="page-speed-opportunity">
										<button
											type="button"
											className="page-speed-opportunity-header"
											onClick={() =>
												setExpandedIssue(isExpanded ? null : item.issue)
											}
										>
											<i className="page-speed-opportunity-icon adminfont-error" />
											<span className="page-speed-opportunity-title">
												{item.issue}
											</span>
											<span className="admin-badge page-speed-opportunity-count">
												{sprintf(
													/* translators: %d is the number of real pages this real issue affects. */
													_n(
														'%d page affected',
														'%d pages affected',
														item.affected_pages,
														'vulopilot'
													),
													item.affected_pages
												)}
											</span>
											<i
												className={`adminfont-${isExpanded ? 'arrow-up' : 'arrow-down'} page-speed-opportunity-chevron`}
											/>
										</button>
										{isExpanded && (
											<ul className="page-speed-opportunity-pages">
												{affectedPages.map((row) => (
													<li key={row.id}>
														<a
															href={row.url}
															target="_blank"
															rel="noopener noreferrer"
														>
															{row.title}
														</a>
													</li>
												))}
											</ul>
										)}
									</li>
								);
							})}
						</ul>
					)}
				</CardComponent>
			</ColumnComponent>
		</ContainerComponent>
	);
};

export default PerformanceOpportunitiesTab;
