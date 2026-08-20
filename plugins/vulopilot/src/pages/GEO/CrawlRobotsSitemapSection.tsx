/* global appLocalizer */
import { __ } from '@wordpress/i18n';
import {
	CardComponent,
	ColumnComponent,
	ContainerComponent,
	ModuleGuardComponent,
	PopupComponent,
} from '@zyra/components';
import { TableCard } from '@zyra/table';
import { useFindingsTable } from '../../services/useFindingsTable';
import ShowProPopup from '../../components/Popup/Popup';

/**
 * "Blocked Pages" (AI-CRAWLER-ANALYTICS-MODULE.md), "Robots.txt Issues",
 * and "XML Sitemap Issues" are all registered by modules/Seo/Module.php,
 * same as every other robots.txt-adjacent check — their findings only
 * exist while the SEO module is active, same gate SeoTab.tsx's own
 * isSeoModuleActive() already checks for the identical reason.
 */
const isSeoModuleActive = () =>
	appLocalizer.active_modules?.includes('seo') ?? false;

/**
 * "Robots & Sitemap" inner section of the merged "Crawl & URLs" tab —
 * real findings tables that used to live on this same tab (back when it
 * was the standalone "Crawler Traffic" tab), given their own inner tab
 * here to match the requested "Overview | Broken Links | Redirects | 404s
 * | Robots & Sitemap" structure (direct instruction) rather than staying
 * bundled into "Overview" alongside real-time traffic analytics — a
 * distinct concern (crawl DIRECTIVES/discoverability, not live traffic).
 *
 * "Blocked pages"/"Robots.txt Issues"/"XML Sitemap Issues" are the same
 * real `useFindingsTable` findings tables SeoTab.tsx's own former
 * "Robots.txt"/"XML Sitemap" category cards used before THAT overlap was
 * fixed (direct instruction: "Robots.txt and Sitemap should move away
 * from SEO... these are fundamentally crawler/discovery controls" — see
 * SeoTab.tsx's own docblock). SeoTab.tsx's own tiny "Search engine
 * access" status line reads the same 4 scanner ids' open-finding count
 * and links to this tab/section rather than duplicating a drill-down
 * table there too.
 *
 * "Indexing Directives" and "Crawl Errors" stay honest not-built-yet
 * cards — this codebase has no scanner for either yet (no meta-robots/
 * noindex checker, and no correlation between `crawler_visits`' own
 * per-request `bot_name`/`requested_url` rows and a response code), so
 * rather than fabricate findings for two of the six things asked for
 * when "Crawlability, Robots.txt, XML Sitemap, Indexing directives, Bot
 * access, Crawl errors" were first requested inside this tab, they're
 * disclosed gaps, not silently omitted or faked.
 */
const CrawlRobotsSitemapSection = () => {
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
		tableCardProps: sitemapProps,
		error: sitemapError,
		refetch: refetchSitemap,
		isProPopupOpen: isSitemapProPopupOpen,
		closeProPopup: closeSitemapProPopup,
	} = useFindingsTable({
		description: __(
			'No sitemap findings yet — run a scan to check your XML sitemap.',
			'vulopilot'
		),
		scannerIds: ['sitemap', 'sitemap-validation'],
	});

	return (
		<>
			<ColumnComponent>
				{isSeoModuleActive() && (
					<CardComponent
						title={__('Blocked pages', 'vulopilot')}
						desc={__(
							'Real pages robots.txt disallows for one specific AI bot.',
							'vulopilot'
						)}
					>
						{blockedPagesError ? (
							<ModuleGuardComponent
								icon="error"
								title={__(
									'Could not load findings',
									'vulopilot'
								)}
								desc={blockedPagesError}
								buttonText={__('Retry', 'vulopilot')}
								onButtonClick={refetchBlockedPages}
							/>
						) : (
							<TableCard {...blockedPagesProps} />
						)}
					</CardComponent>
				)}

				{isSeoModuleActive() && (
					<CardComponent
						title={__('Robots.txt Issues', 'vulopilot')}
						desc={__(
							'Whether robots.txt is reachable and not accidentally blocking every crawler.',
							'vulopilot'
						)}
					>
						{robotsTxtError ? (
							<ModuleGuardComponent
								icon="error"
								title={__(
									'Could not load findings',
									'vulopilot'
								)}
								desc={robotsTxtError}
								buttonText={__('Retry', 'vulopilot')}
								onButtonClick={refetchRobotsTxt}
							/>
						) : (
							<TableCard {...robotsTxtProps} />
						)}
					</CardComponent>
				)}

				{isSeoModuleActive() && (
					<CardComponent
						title={__('XML Sitemap Issues', 'vulopilot')}
						desc={__(
							'Whether /wp-sitemap.xml is reachable and valid.',
							'vulopilot'
						)}
					>
						{sitemapError ? (
							<ModuleGuardComponent
								icon="error"
								title={__(
									'Could not load findings',
									'vulopilot'
								)}
								desc={sitemapError}
								buttonText={__('Retry', 'vulopilot')}
								onButtonClick={refetchSitemap}
							/>
						) : (
							<TableCard {...sitemapProps} />
						)}
					</CardComponent>
				)}

				<ContainerComponent>
					<CardComponent
						title={__('Indexing Directives', 'vulopilot')}
						titleIcon="search-discovery"
						desc={__(
							'Pages accidentally marked noindex/nofollow, or missing an expected one.',
							'vulopilot'
						)}
						badges={[
							{ text: __('Not tracked yet', 'vulopilot'), color: 'indigo' },
						]}
						toggle
					>
						<ModuleGuardComponent
							icon="info"
							title={__('Not available yet', 'vulopilot')}
							desc={__(
								'There’s no scanner for meta-robots directives yet — flag if you want it scoped next.',
								'vulopilot'
							)}
						/>
					</CardComponent>
					<CardComponent
						title={__('Crawl Errors', 'vulopilot')}
						titleIcon="error"
						desc={__(
							'Pages an AI crawler specifically requested and got a broken response from.',
							'vulopilot'
						)}
						badges={[
							{ text: __('Not tracked yet', 'vulopilot'), color: 'indigo' },
						]}
						toggle
					>
						<ModuleGuardComponent
							icon="info"
							title={__('Not available yet', 'vulopilot')}
							desc={__(
								'Crawler visits aren’t currently cross-referenced against response codes — flag if you want it scoped next.',
								'vulopilot'
							)}
						/>
					</CardComponent>
				</ContainerComponent>
			</ColumnComponent>

			<PopupComponent
				open={isProPopupOpen}
				onClose={closeProPopup}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{appLocalizer.khali_dabba ? (
					<ShowProPopup moduleName="one-click-fix" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
			<PopupComponent
				open={isRobotsTxtProPopupOpen}
				onClose={closeRobotsTxtProPopup}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{appLocalizer.khali_dabba ? (
					<ShowProPopup moduleName="one-click-fix" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
			<PopupComponent
				open={isSitemapProPopupOpen}
				onClose={closeSitemapProPopup}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{appLocalizer.khali_dabba ? (
					<ShowProPopup moduleName="one-click-fix" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</>
	);
};

export default CrawlRobotsSitemapSection;
