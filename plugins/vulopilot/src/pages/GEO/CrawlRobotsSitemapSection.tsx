/* global appLocalizer */
import { useEffect, useRef, useState } from '@wordpress/element';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, sendApiResponse } from '@zyra/core';
import {
	BadgeComponent,
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	MetricTileComponent,
	ModuleGuardComponent,
	NoticeManager,
	PopupComponent,
	TooltipComponent,
} from '@zyra/components';
import { ButtonInput, TextAreaInput } from '@zyra/inputs';
import { TableCard, TableRow } from '@zyra/table';
import TypographyComponent from '../../components/TypographyComponent';
import { formatWpDate } from '../../services/formatWpDate';
import { useFindingsTable } from '../../services/useFindingsTable';
import { useLastScanTime } from '../../services/useLastScanTime';
import { useGoogleServicesConnection } from '../../services/useGoogleServicesConnection';
import ShowProPopup from '../../components/Popup/Popup';
import './SeoVisibility.scss';

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

interface RobotsResponse {
	reachable: boolean;
	url: string;
	content: string;
	is_custom: boolean;
	custom_content: string;
	rules: { total: number; allowed: number; disallowed: number; sitemaps: number };
	directives: {
		user_agents: string[];
		allow: string[];
		disallow: string[];
		sitemaps: string[];
		crawl_delay: string | null;
	};
}

interface SitemapChild {
	loc: string;
	type: string;
	lastmod: string | null;
	url_count: number | null;
	status: 'ok' | 'error';
}

interface SitemapResponse {
	reachable: boolean;
	index_url: string;
	valid: boolean;
	total_sitemaps: number;
	total_urls: number;
	sitemaps: SitemapChild[];
}

interface SitemapRow extends TableRow, SitemapChild {
	id: string;
}

/**
 * "Blocked Pages" (AI-CRAWLER-ANALYTICS-MODULE.md), "Robots.txt Issues",
 * and "XML Sitemap Issues" are all registered by modules/Seo/Module.php,
 * same as every other robots.txt-adjacent check — their findings only
 * exist while the SEO module is active, same gate SeoTab.tsx's own
 * isSeoModuleActive() already checks for the identical reason.
 */
const isSeoModuleActive = () =>
	appLocalizer.active_modules?.includes('seo') ?? false;

/** First real example value, plus a real "+N more" count when there's more than one — used for the compact "Important Crawl Directives" table below rather than dumping every real path into one cell. */
const summarizeList = (values: string[]): string => {
	if (!values.length) {
		return __('None', 'vulopilot');
	}
	return values.length > 1
		? sprintf(
			/* translators: 1: first real directive value, 2: how many more real ones exist. */
			__('%1$s (+%2$d more)', 'vulopilot'),
			values[0],
			values.length - 1
		)
		: values[0];
};

/**
 * "Robots & Sitemap" inner section of the "Crawl & URLs" tab — rebuilt to
 * match the reference mockup wherever real data supports it:
 *   - 4 real status tiles: Robots.txt/Sitemap reachability (live
 *     `GET /robots-sitemap/robots`/`/sitemap`, new this pass — neither
 *     existing scanner returns file content or a structured breakdown,
 *     confirmed before writing Controllers\RobotsSitemap.php), a real
 *     connected Search Console property (useGoogleServicesConnection — no
 *     count next to it: this codebase's only real GSC integration is
 *     `searchAnalytics.query` for keyword rank tracking, never an
 *     index-coverage/"indexed pages" API, so that mockup number has zero
 *     real source and is deliberately omitted rather than faked), and a
 *     real "Last Checked" from the most recent completed
 *     robots-txt/sitemap scan run (useLastScanTime) — no "Next check"
 *     line, since neither scanner has any cadence/cron of its own.
 *   - "Robots.txt Analysis": the real live file content plus real
 *     Allow/Disallow/Sitemap line counts (a genuine full parse, not a
 *     summary standing in for the real thing), and a real violation
 *     badge from this scanner's own open findings.
 *   - "XML Sitemap Overview": real per-child-sitemap rows (URL/type/real
 *     `<lastmod>`/real `<url>` count) — WordPress core's own
 *     `/wp-sitemap.xml` index structurally has this, this plugin just
 *     never read it back before this pass.
 *   - "Blocked by Robots.txt": the real `ai-crawler-blocked-pages`
 *     findings (real post + real bot name per row) already used by the
 *     "Blocked pages" table below, just summarized as a glance card too.
 *   - "Important Crawl Directives": the same real parsed robots.txt
 *     directives, in the mockup's own compact key-value shape.
 *   - "Quick Actions": real links (the real robots.txt/sitemap URLs, the
 *     real connected Search Console property) and real actions ("Test
 *     robots.txt" re-runs the same live fetch; "Resubmit sitemap" calls
 *     the real, already-shipped `POST /indexnow/submit`).
 *   - "llms.txt content": moved here from Settings → AI Visibility, same
 *     real `llms_txt_content` auto-saving option and `GET /llms-txt/regenerate`
 *     action as before (see LlmsTxtGenerator) — just relocated to match the
 *     reference mockup, which places it on this tab. Gated on the real
 *     `enable_llms_txt` flag (still configured on Settings → AI Visibility,
 *     which didn't move) — editing content for a disabled feature would be
 *     dishonest, so this shows a plain link there instead when it's off.
 *
 * "Indexing Directives"/"Crawl Errors" (this file's own former "not
 * tracked yet" placeholder cards) are dropped here — the reference
 * mockup doesn't show them, and this pass already covers substantially
 * more real ground than before.
 */
const CrawlRobotsSitemapSection = () => {
	const [robots, setRobots] = useState<RobotsResponse | null>(null);
	const [isLoadingRobots, setIsLoadingRobots] = useState(true);
	const [sitemap, setSitemap] = useState<SitemapResponse | null>(null);
	const [isLoadingSitemap, setIsLoadingSitemap] = useState(true);

	const { lastScanAt } = useLastScanTime(['robots-txt', 'sitemap', 'sitemap-validation']);
	const { status: gscStatus } = useGoogleServicesConnection('settings');

	/**
	 * `useFindingsTable`'s own `tableCardProps.totalRows` counts every
	 * status (open/resolved/ignored/snoozed) — fine for its own table's
	 * "Showing X of Y" footer, wrong for a real "still-open right now"
	 * count, so these two glance stats fetch that real number directly
	 * rather than reusing (and overcounting from) the table's own total.
	 */
	const [robotsOpenCount, setRobotsOpenCount] = useState(0);
	const [blockedPagesOpenCount, setBlockedPagesOpenCount] = useState(0);

	const loadOpenCounts = () => {
		getApiResponse<{ total: number }>(
			getApiLink(appLocalizer, 'findings?scanner_id=robots-txt&status=open&per_page=1'),
			nonceHeaders
		).then((response) => setRobotsOpenCount(response?.total ?? 0));

		getApiResponse<{ total: number }>(
			getApiLink(appLocalizer, 'findings?scanner_id=ai-crawler-blocked-pages&status=open&per_page=1'),
			nonceHeaders
		).then((response) => setBlockedPagesOpenCount(response?.total ?? 0));
	};

	const loadRobots = () => {
		setIsLoadingRobots(true);
		getApiResponse<RobotsResponse>(getApiLink(appLocalizer, 'robots-sitemap/robots'), nonceHeaders)
			.then((response) => response && setRobots(response))
			.finally(() => setIsLoadingRobots(false));
	};

	const loadSitemap = () => {
		setIsLoadingSitemap(true);
		getApiResponse<SitemapResponse>(getApiLink(appLocalizer, 'robots-sitemap/sitemap'), nonceHeaders)
			.then((response) => response && setSitemap(response))
			.finally(() => setIsLoadingSitemap(false));
	};

	const [isEditingRobots, setIsEditingRobots] = useState(false);
	const [editRobotsContent, setEditRobotsContent] = useState('');
	const [isSavingRobots, setIsSavingRobots] = useState(false);

	const openEditRobots = () => {
		setEditRobotsContent(robots?.custom_content || robots?.content || '');
		setIsEditingRobots(true);
	};

	const saveRobots = (content: string) => {
		setIsSavingRobots(true);

		sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'robots-sitemap/robots'), { content })
			.then((response) => {
				NoticeManager.add({
					uniqueKey: 'robots-sitemap-save',
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? '' === content
							? __('robots.txt reset to the WordPress default.', 'vulopilot')
							: __('robots.txt saved and live.', 'vulopilot')
						: __('Could not save robots.txt. Please try again.', 'vulopilot'),
				});

				if (response) {
					setIsEditingRobots(false);
					loadRobots();
				}
			})
			.finally(() => setIsSavingRobots(false));
	};

	/**
	 * "llms.txt content" — moved here from Settings → AI Visibility (the
	 * mockup places it on this tab instead), same real field/behavior as
	 * before: `llms_txt_content` is a plain, auto-saving option
	 * (Controllers\Settings::update_item() writes it straight to a real
	 * `/llms.txt` on save, see GeoAnalysis\LlmsTxtGenerator::write_file()).
	 * `enable_llms_txt` still lives on Settings → AI Visibility (its own
	 * toggle, plus "Auto-regenerate on publish"/"Included content types" —
	 * none of that moved) — this card just reads that same real flag to
	 * decide whether editing the content here makes sense right now, same
	 * `dependent` gate the old textarea field used.
	 */
	const [llmsTxtContent, setLlmsTxtContent] = useState('');
	const [isLlmsTxtEnabled, setIsLlmsTxtEnabled] = useState(false);
	const [isLoadingLlmsTxt, setIsLoadingLlmsTxt] = useState(true);
	const [isRegeneratingLlmsTxt, setIsRegeneratingLlmsTxt] = useState(false);
	const [llmsTxtSaveState, setLlmsTxtSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
	const llmsTxtSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const loadLlmsTxt = () => {
		setIsLoadingLlmsTxt(true);
		getApiResponse<{ enable_llms_txt?: string[] | boolean; llms_txt_content?: string }>(
			getApiLink(appLocalizer, 'settings'),
			nonceHeaders
		)
			.then((response) => {
				if (!response) {
					return;
				}
				setIsLlmsTxtEnabled(
					Array.isArray(response.enable_llms_txt)
						? response.enable_llms_txt.includes('enable_llms_txt')
						: !!response.enable_llms_txt
				);
				setLlmsTxtContent(response.llms_txt_content ?? '');
			})
			.finally(() => setIsLoadingLlmsTxt(false));
	};

	const persistLlmsTxtContent = (content: string, notify = false) => {
		setLlmsTxtSaveState('saving');
		sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'settings'), {
			setting: { llms_txt_content: content },
		}).then((response) => {
			setLlmsTxtSaveState(response ? 'saved' : 'error');
			if (notify) {
				NoticeManager.add({
					uniqueKey: 'llms-txt-regenerated',
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __('llms.txt regenerated and saved.', 'vulopilot')
						: __('Regenerated, but saving failed. Please try again.', 'vulopilot'),
				});
			}
		});
	};

	const handleLlmsTxtChange = (value: string) => {
		setLlmsTxtContent(value);
		if (llmsTxtSaveTimer.current) {
			clearTimeout(llmsTxtSaveTimer.current);
		}
		llmsTxtSaveTimer.current = setTimeout(() => persistLlmsTxtContent(value), 800);
	};

	const handleRegenerateLlmsTxt = () => {
		setIsRegeneratingLlmsTxt(true);
		getApiResponse<{ content: string }>(getApiLink(appLocalizer, 'llms-txt/regenerate'), nonceHeaders)
			.then((response) => {
				if (!response) {
					NoticeManager.add({
						uniqueKey: 'llms-txt-regenerate-failed',
						type: 'error',
						position: 'float',
						message: __('Could not regenerate llms.txt. Please try again.', 'vulopilot'),
					});
					return;
				}
				if (llmsTxtSaveTimer.current) {
					clearTimeout(llmsTxtSaveTimer.current);
				}
				setLlmsTxtContent(response.content);
				persistLlmsTxtContent(response.content, true);
			})
			.finally(() => setIsRegeneratingLlmsTxt(false));
	};

	useEffect(() => {
		loadRobots();
		loadSitemap();
		loadOpenCounts();
		loadLlmsTxt();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const {
		tableCardProps: blockedPagesProps,
		error: blockedPagesError,
		refetch: refetchBlockedPages,
		isProPopupOpen,
		closeProPopup,
	} = useFindingsTable({
		description: __(
			'No AI-bot-specific blocks found — run a scan to check robots.txt against your published pages.',
			'vulopilot'
		),
		scannerIds: ['ai-crawler-blocked-pages'],
	});

	const {
		tableCardProps: robotsTxtProps,
		error: robotsTxtError,
		refetch: refetchRobotsTxt,
		isProPopupOpen: isRobotsTxtProPopupOpen,
		closeProPopup: closeRobotsTxtProPopup,
	} = useFindingsTable({
		description: __(
			'No robots.txt findings yet — run a scan to check crawler access.',
			'vulopilot'
		),
		scannerIds: ['robots-txt'],
	});

	const {
		tableCardProps: sitemapFindingsProps,
		error: sitemapFindingsError,
		refetch: refetchSitemapFindings,
		isProPopupOpen: isSitemapProPopupOpen,
		closeProPopup: closeSitemapProPopup,
	} = useFindingsTable({
		description: __(
			'No sitemap findings yet — run a scan to check your XML sitemap.',
			'vulopilot'
		),
		scannerIds: ['sitemap', 'sitemap-validation'],
	});

	const handleResubmitSitemap = () => {
		if (!sitemap?.index_url) {
			return;
		}

		sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'indexnow/submit'), {
			urls: [sitemap.index_url],
		}).then((response: { success?: boolean; message?: string } | undefined) => {
			NoticeManager.add({
				uniqueKey: 'robots-sitemap-resubmit',
				type: response?.success ? 'success' : 'error',
				position: 'float',
				message:
					response?.message ||
					(response?.success
						? __('Sitemap submitted to IndexNow.', 'vulopilot')
						: __(
							'Could not submit the sitemap — check the IndexNow API key under Settings → Instant Indexing.',
							'vulopilot'
						)),
			});
		});
	};

	const searchConsoleUrl = gscStatus?.search_console_site
		? `https://search.google.com/search-console?resource_id=${encodeURIComponent(gscStatus.search_console_site)}`
		: `${appLocalizer.site_url}/wp-admin/admin.php?page=vulopilot#&tab=settings&subtab=connections`;

	const sitemapRows: SitemapRow[] = (sitemap?.sitemaps ?? []).map((child, index) => ({
		id: `${index}-${child.loc}`,
		...child,
	}));

	const robotsStatus: 'valid' | 'attention' | 'unreachable' = !robots?.reachable
		? 'unreachable'
		: robotsOpenCount > 0
			? 'attention'
			: 'valid';

	const sitemapStatus: 'valid' | 'attention' | 'unreachable' = !sitemap?.reachable || !sitemap?.valid
		? 'unreachable'
		: sitemap.total_sitemaps === 0
			? 'attention'
			: 'valid';

	if (!isSeoModuleActive()) {
		return (
			<ColumnComponent>
				<CardComponent title={__('Robots & Sitemap', 'vulopilot')} titleIcon="link">
					<ModuleGuardComponent
						icon="error"
						title={__('SEO module is turned off', 'vulopilot')}
						desc={__(
							'Turn the SEO module back on from Settings → Modules to resume robots.txt/sitemap checks.',
							'vulopilot'
						)}
					/>
				</CardComponent>
			</ColumnComponent>
		);
	}

	return (
		<>
			<ColumnComponent>
				<MetricTileComponent
					cols={4}
					isLoading={isLoadingRobots || isLoadingSitemap}
					data={[
						{
							id: 'robots',
							icon: 'valid' === robotsStatus ? 'check' : 'error',
							iconColor: 'valid' === robotsStatus ? '#16a34a' : 'unreachable' === robotsStatus ? '#dc2626' : '#b45309',
							title: __('Robots.txt Status', 'vulopilot'),
							number: (
								<span className="redirect-stat-value">
									{'valid' === robotsStatus
										? __('Valid', 'vulopilot')
										: 'unreachable' === robotsStatus
											? __('Not reachable', 'vulopilot')
											: __('Needs attention', 'vulopilot')}
								</span>
							),
							desc: 'valid' === robotsStatus
								? __('Reachable and valid', 'vulopilot')
								: 'unreachable' === robotsStatus
									? __('robots.txt did not respond', 'vulopilot')
									: sprintf(
										/* translators: %d: number of open robots.txt findings. */
										__('%d open finding(s)', 'vulopilot'),
										robotsOpenCount
									),
							footer: (
								<a href={robots?.url ?? `${appLocalizer.site_url}/robots.txt`} target="_blank" rel="noreferrer">
									{__('View robots.txt', 'vulopilot')}
								</a>
							),
							footerAlign: 'start' as const,
						},
						{
							id: 'sitemap',
							icon: 'valid' === sitemapStatus ? 'check' : 'error',
							iconColor: 'valid' === sitemapStatus ? '#16a34a' : 'unreachable' === sitemapStatus ? '#dc2626' : '#b45309',
							title: __('XML Sitemap Status', 'vulopilot'),
							number: (
								<span className="redirect-stat-value">
									{'valid' === sitemapStatus
										? __('Valid', 'vulopilot')
										: 'unreachable' === sitemapStatus
											? __('Not reachable', 'vulopilot')
											: __('Needs attention', 'vulopilot')}
								</span>
							),
							desc: 'valid' === sitemapStatus
								? __('Sitemap index is reachable', 'vulopilot')
								: __('No usable sitemap found', 'vulopilot'),
							footer: (
								<a href={sitemap?.index_url ?? `${appLocalizer.site_url}/wp-sitemap.xml`} target="_blank" rel="noreferrer">
									{__('View sitemap index', 'vulopilot')}
								</a>
							),
							footerAlign: 'start' as const,
						},
						{
							id: 'search-console',
							icon: 'search',
							iconColor: gscStatus?.search_console_site ? '#16a34a' : undefined,
							title: __('Search Console', 'vulopilot'),
							number: (
								<span className="redirect-stat-value is-muted">
									{gscStatus?.search_console_site || __('Not connected', 'vulopilot')}
								</span>
							),
							desc: __(
								'This plugin doesn’t pull an indexed-page count from Search Console yet — only keyword rankings.',
								'vulopilot'
							),
							footer: (
								<a href={searchConsoleUrl} target="_blank" rel="noreferrer">
									{gscStatus?.search_console_site
										? __('Open Search Console', 'vulopilot')
										: __('Connect Google Services', 'vulopilot')}
								</a>
							),
							footerAlign: 'start' as const,
						},
						{
							id: 'last-checked',
							icon: 'calendar',
							title: __('Last Checked', 'vulopilot'),
							number: (
								<span className="redirect-stat-value is-muted">
									{lastScanAt ? formatWpDate(lastScanAt) : __('Never scanned', 'vulopilot')}
								</span>
							),
							desc: __('From the most recent robots.txt/sitemap scan run.', 'vulopilot'),
						},
					]}
				/>

				<CardComponent
					title={__('Robots.txt Analysis', 'vulopilot')}
					titleIcon="link"
					desc={__('Check your live robots.txt file (fetched right now, not a cached copy).', 'vulopilot')}
					isLoading={isLoadingRobots}
					action={
						<div className="robots-analysis-actions">
							{robots?.reachable && (
								<BadgeComponent
									color={0 === robotsOpenCount ? 'green' : 'red'}
									text={
										0 === robotsOpenCount
											? __('No violations found', 'vulopilot')
											: sprintf(
												/* translators: %d: number of open robots.txt violations. */
												__('%d violation(s) found', 'vulopilot'),
												robotsOpenCount
											)
									}
								/>
							)}
							{robots?.is_custom && (
								<BadgeComponent color="purple" text={__('Custom', 'vulopilot')} />
							)}
							<ButtonInput
								buttons={[
									{
										text: __('Edit', 'vulopilot'),
										icon: 'edit',
										color: 'plain',
										onClick: openEditRobots,
									},
									{
										text: __('Test robots.txt', 'vulopilot'),
										icon: 'update',
										color: 'plain',
										onClick: loadRobots,
									},
								]}
							/>
						</div>
					}
				>
					{robots?.reachable ? (
						<>
							<div className="robots-rule-stats">
								<div className="robots-rule-stat">
									<div className="typography-h3">{robots.rules.total}</div>
									<div className="desc">{__('Total Rules', 'vulopilot')}</div>
								</div>
								<div className="robots-rule-stat">
									<div className="typography-h3 is-good">{robots.rules.allowed}</div>
									<div className="desc">{__('Allowed', 'vulopilot')}</div>
								</div>
								<div className="robots-rule-stat">
									<div className="typography-h3 is-attention">{robots.rules.disallowed}</div>
									<div className="desc">{__('Disallowed', 'vulopilot')}</div>
								</div>
								<div className="robots-rule-stat">
									<div className="typography-h3">{robots.rules.sitemaps}</div>
									<div className="desc">{__('Sitemaps', 'vulopilot')}</div>
								</div>
							</div>
							<pre className="robots-txt-content">
								<code>{robots.content || __('(empty file)', 'vulopilot')}</code>
							</pre>
						</>
					) : (
						<ModuleGuardComponent
							icon="error"
							title={__('robots.txt is not reachable', 'vulopilot')}
							desc={__('This site did not return a working /robots.txt just now.', 'vulopilot')}
						/>
					)}
				</CardComponent>

				<CardComponent
					title={__('XML Sitemap Overview', 'vulopilot')}
					titleIcon="link"
					desc={__('Check your live sitemap (fetched right now, not a cached copy).', 'vulopilot')}
					isLoading={isLoadingSitemap}
					action={
						sitemap?.reachable && (
							<a href={sitemap.index_url} target="_blank" rel="noreferrer">
								{__('View sitemap index', 'vulopilot')}
							</a>
						)
					}
				>
					{sitemap?.reachable && sitemap.valid ? (
						<>
							<div className="robots-rule-stats">
								<div className="robots-rule-stat">
									<div className="typography-h3">{sitemap.total_sitemaps}</div>
									<div className="desc">{__('Total Sitemaps', 'vulopilot')}</div>
								</div>
								<div className="robots-rule-stat">
									<div className="typography-h3 is-good">
										{sitemapRows.filter((row) => 'ok' === row.status).length}
									</div>
									<div className="desc">{__('Valid', 'vulopilot')}</div>
								</div>
								<div className="robots-rule-stat">
									<div className="typography-h3">{sitemap.total_urls}</div>
									<div className="desc">{__('Total URLs', 'vulopilot')}</div>
								</div>
							</div>
							<TableCard
								showMenu={false}
								className="transparent-table"
								headers={{
									loc: {
										label: __('Sitemap', 'vulopilot'),
										render: (row: SitemapRow) => (
											<a href={row.loc} target="_blank" rel="noreferrer">
												{row.loc}
											</a>
										),
									},
									type: { label: __('Type', 'vulopilot') },
									url_count: {
										label: __('URLs', 'vulopilot'),
										render: (row: SitemapRow) =>
											null === row.url_count ? __('—', 'vulopilot') : row.url_count,
									},
									lastmod: {
										label: __('Last Read', 'vulopilot'),
										render: (row: SitemapRow) =>
											row.lastmod ? formatWpDate(row.lastmod) : __('Unknown', 'vulopilot'),
									},
									status: {
										label: __('Status', 'vulopilot'),
										render: (row: SitemapRow) => (
											<BadgeComponent
												color={'ok' === row.status ? 'green' : 'red'}
												text={'ok' === row.status ? __('OK', 'vulopilot') : __('Error', 'vulopilot')}
											/>
										),
									},
									actions: {
										label: __('Actions', 'vulopilot'),
										render: (row: SitemapRow) => (
											<a href={row.loc} target="_blank" rel="noreferrer">
												<i className="adminfont-eye" />
											</a>
										),
									},
								}}
								rows={sitemapRows}
								ids={sitemapRows.map((row) => row.id)}
								totalRows={sitemapRows.length}
								isLoading={isLoadingSitemap}
								emptyMessage={__('No child sitemaps found in the index.', 'vulopilot')}
							/>
						</>
					) : (
						<ModuleGuardComponent
							icon="error"
							title={__('No usable sitemap found', 'vulopilot')}
							desc={__(
								'Neither /wp-sitemap.xml nor /sitemap.xml returned valid, parseable XML just now.',
								'vulopilot'
							)}
						/>
					)}
				</CardComponent>

				<CardComponent
					title={__('llms.txt content', 'vulopilot')}
					titleIcon="menu"
					desc={__(
						'Pre-filled with an auto-generated index of your published pages and posts — edit and it saves automatically, just like every other setting here, and is written straight to the live /llms.txt file.',
						'vulopilot'
					)}
					isLoading={isLoadingLlmsTxt}
				>
					{isLlmsTxtEnabled ? (
						<div className="llms-txt-card-body">
							<div className="llms-txt-card-field">
								<TextAreaInput
									value={llmsTxtContent}
									onChange={(value) => handleLlmsTxtChange(value as string)}
									rowNumber={10}
									usePlainText
								/>
								<div className="llms-txt-card-footer">
									<div className="llms-txt-live-link">
										{__('Live file:', 'vulopilot')}{' '}
										<a
											href={`${appLocalizer.site_url}/llms.txt`}
											target="_blank"
											rel="noopener noreferrer"
										>
											{`${appLocalizer.site_url}/llms.txt`}
										</a>
										{'saving' === llmsTxtSaveState && (
											<span className="llms-txt-save-status">
												{' · '}
												{__('Saving…', 'vulopilot')}
											</span>
										)}
										{'saved' === llmsTxtSaveState && (
											<span className="llms-txt-save-status is-good">
												{' · '}
												{__('Saved', 'vulopilot')}
											</span>
										)}
										{'error' === llmsTxtSaveState && (
											<span className="llms-txt-save-status is-attention">
												{' · '}
												{__('Could not save', 'vulopilot')}
											</span>
										)}
									</div>
									<ButtonInput
										buttons={{
											text: isRegeneratingLlmsTxt
												? __('Regenerating…', 'vulopilot')
												: __('Regenerate', 'vulopilot'),
											icon: 'refresh',
											onClick: handleRegenerateLlmsTxt,
											disabled: isRegeneratingLlmsTxt,
										}}
									/>
								</div>
							</div>
						</div>
					) : (
						<ModuleGuardComponent
							icon="info"
							title={__('llms.txt generation is turned off', 'vulopilot')}
							desc={__(
								'Turn on "Generate llms.txt" under Settings → AI Visibility to edit its content here.',
								'vulopilot'
							)}
							buttonText={__('Open Settings', 'vulopilot')}
							onButtonClick={() => {
								window.location.href = `${appLocalizer.site_url}/wp-admin/admin.php?page=vulopilot#&tab=settings&subtab=ai-visibility`;
							}}
						/>
					)}
				</CardComponent>

				<ContainerComponent>
					<CardComponent
						title={__('Blocked by Robots.txt', 'vulopilot')}
						titleIcon="eye-blocked"
						desc={__('Real pages an AI bot is blocked from crawling right now.', 'vulopilot')}
					>
						{blockedPagesError ? (
							<ModuleGuardComponent
								icon="error"
								title={__('Could not load findings', 'vulopilot')}
								desc={blockedPagesError}
								buttonText={__('Retry', 'vulopilot')}
								onButtonClick={refetchBlockedPages}
							/>
						) : (
							<>
								<div className="robots-blocked-count">
									<TypographyComponent as="span" variant="h3" className="redirect-stat-value is-attention">
										{blockedPagesOpenCount}
									</TypographyComponent>
									<span className="desc">
										{sprintf(
											/* translators: %d: number of blocked URLs. */
											__('%d URL(s) currently blocked', 'vulopilot'),
											blockedPagesOpenCount
										)}
									</span>
								</div>
								<a
									href="#blocked-pages-table"
									onClick={(event) => {
										event.preventDefault();
										document
											.getElementById('blocked-pages-table')
											?.scrollIntoView({ behavior: 'smooth' });
									}}
								>
									{__('View blocked pages', 'vulopilot')}
								</a>
							</>
						)}
					</CardComponent>

					<CardComponent
						title={__('Important Crawl Directives', 'vulopilot')}
						titleIcon="menu"
						desc={__('The real user-agent/allow/disallow/sitemap rules robots.txt currently sets.', 'vulopilot')}
						isLoading={isLoadingRobots}
					>
						{robots?.reachable ? (
							<table className="robots-directives-table">
								<tbody>
									<tr>
										<th>{__('User-agent', 'vulopilot')}</th>
										<td>{summarizeList(robots.directives.user_agents)}</td>
									</tr>
									<tr>
										<th>{__('Allow', 'vulopilot')}</th>
										<td>{summarizeList(robots.directives.allow)}</td>
									</tr>
									<tr>
										<th>{__('Disallow', 'vulopilot')}</th>
										<td>{summarizeList(robots.directives.disallow)}</td>
									</tr>
									<tr>
										<th>{__('Sitemaps', 'vulopilot')}</th>
										<td>{robots.directives.sitemaps.length}</td>
									</tr>
									<tr>
										<th>{__('Crawl-delay', 'vulopilot')}</th>
										<td>{robots.directives.crawl_delay ?? __('Not set', 'vulopilot')}</td>
									</tr>
								</tbody>
							</table>
						) : (
							<ModuleGuardComponent
								icon="info"
								title={__('Not available', 'vulopilot')}
								desc={__('robots.txt is not reachable right now.', 'vulopilot')}
							/>
						)}
					</CardComponent>

					<CardComponent
						title={__('Quick Actions', 'vulopilot')}
						titleIcon="tools"
						desc={__('Shortcuts to the tools you use most on this page.', 'vulopilot')}
					>
						<div className="robots-quick-actions">
							<a
								className="robots-quick-action"
								href={robots?.url ?? `${appLocalizer.site_url}/robots.txt`}
								target="_blank"
								rel="noreferrer"
							>
								<i className="adminfont-link" /> {__('Open robots.txt', 'vulopilot')}
							</a>
							<a
								className="robots-quick-action"
								href={sitemap?.index_url ?? `${appLocalizer.site_url}/wp-sitemap.xml`}
								target="_blank"
								rel="noreferrer"
							>
								<i className="adminfont-link" /> {__('Open sitemap index', 'vulopilot')}
							</a>
							<TooltipComponent
								text={__(
									'Submits the sitemap index URL to IndexNow (needs an API key under Settings → Instant Indexing).',
									'vulopilot'
								)}
							>
								<button type="button" className="robots-quick-action" onClick={handleResubmitSitemap}>
									<i className="adminfont-update" /> {__('Resubmit sitemap', 'vulopilot')}
								</button>
							</TooltipComponent>
							<button type="button" className="robots-quick-action" onClick={loadRobots}>
								<i className="adminfont-check" /> {__('Test robots.txt', 'vulopilot')}
							</button>
							<a className="robots-quick-action" href={searchConsoleUrl} target="_blank" rel="noreferrer">
								<i className="adminfont-search" /> {__('Check in Search Console', 'vulopilot')}
							</a>
						</div>
					</CardComponent>
				</ContainerComponent>

				<div id="blocked-pages-table">
					<CardComponent
						title={__('Blocked pages', 'vulopilot')}
						titleIcon="eye-blocked"
						desc={__('Real pages robots.txt disallows for one specific AI bot.', 'vulopilot')}
					>
						{blockedPagesError ? (
							<ModuleGuardComponent
								icon="error"
								title={__('Could not load findings', 'vulopilot')}
								desc={blockedPagesError}
								buttonText={__('Retry', 'vulopilot')}
								onButtonClick={refetchBlockedPages}
							/>
						) : (
							<TableCard {...blockedPagesProps} />
						)}
					</CardComponent>
				</div>

				<CardComponent
					title={__('Robots.txt Issues', 'vulopilot')}
					titleIcon="link"
					desc={__('Whether robots.txt is reachable and not accidentally blocking every crawler.', 'vulopilot')}
				>
					{robotsTxtError ? (
						<ModuleGuardComponent
							icon="error"
							title={__('Could not load findings', 'vulopilot')}
							desc={robotsTxtError}
							buttonText={__('Retry', 'vulopilot')}
							onButtonClick={refetchRobotsTxt}
						/>
					) : (
						<TableCard {...robotsTxtProps} />
					)}
				</CardComponent>

				<CardComponent
					title={__('XML Sitemap Issues', 'vulopilot')}
					titleIcon="link"
					desc={__('Whether /wp-sitemap.xml is reachable and valid.', 'vulopilot')}
				>
					{sitemapFindingsError ? (
						<ModuleGuardComponent
							icon="error"
							title={__('Could not load findings', 'vulopilot')}
							desc={sitemapFindingsError}
							buttonText={__('Retry', 'vulopilot')}
							onButtonClick={refetchSitemapFindings}
						/>
					) : (
						<TableCard {...sitemapFindingsProps} />
					)}
				</CardComponent>
			</ColumnComponent>

			<PopupComponent
				open={isEditingRobots}
				onClose={() => setIsEditingRobots(false)}
				width={34}
				height="auto"
				position="lightbox"
				header={{ title: __('Edit robots.txt', 'vulopilot') }}
			>
				<div className="robots-edit-form">
					<p className="desc">
						{__(
							'Saving takes effect immediately, not a preview — the next request to /robots.txt serves this. Other active plugins (e.g. WooCommerce) may still add their own rules on top, same as they would with WordPress’s own default file.',
							'vulopilot'
						)}
					</p>
					<TextAreaInput
						value={editRobotsContent}
						onChange={(value) => setEditRobotsContent(value as string)}
						rowNumber={16}
						usePlainText
						placeholder={__('User-agent: *\nDisallow: /wp-admin/', 'vulopilot')}
					/>
					<div className="robots-edit-actions">
						{robots?.is_custom && (
							<ButtonInput
								buttons={{
									text: __('Reset to WordPress default', 'vulopilot'),
									color: 'plain',
									disabled: isSavingRobots,
									onClick: () => saveRobots(''),
								}}
							/>
						)}
						<ButtonInput
							buttons={{
								text: __('Cancel', 'vulopilot'),
								color: 'plain',
								disabled: isSavingRobots,
								onClick: () => setIsEditingRobots(false),
							}}
						/>
						<ButtonInput
							buttons={{
								text: isSavingRobots ? __('Saving…', 'vulopilot') : __('Save', 'vulopilot'),
								disabled: isSavingRobots,
								onClick: () => saveRobots(editRobotsContent),
							}}
						/>
					</div>
				</div>
			</PopupComponent>

			<PopupComponent open={isProPopupOpen} onClose={closeProPopup} width={31.25} height="auto" position="lightbox">
				{appLocalizer.khali_dabba ? <ShowProPopup moduleName="one-click-fix" /> : <ShowProPopup />}
			</PopupComponent>
			<PopupComponent
				open={isRobotsTxtProPopupOpen}
				onClose={closeRobotsTxtProPopup}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{appLocalizer.khali_dabba ? <ShowProPopup moduleName="one-click-fix" /> : <ShowProPopup />}
			</PopupComponent>
			<PopupComponent
				open={isSitemapProPopupOpen}
				onClose={closeSitemapProPopup}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{appLocalizer.khali_dabba ? <ShowProPopup moduleName="one-click-fix" /> : <ShowProPopup />}
			</PopupComponent>
		</>
	);
};

export default CrawlRobotsSitemapSection;
