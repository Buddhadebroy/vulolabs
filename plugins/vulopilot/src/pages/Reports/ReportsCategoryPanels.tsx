import { __ } from '@wordpress/i18n';
import { CardComponent, ModuleGuardComponent } from '@zyra/components';
import type { CategoryPanel, ContentSummary, StoreSummary } from './reportsOverview';

interface SecurityPerformancePanelProps {
	panel: CategoryPanel | null;
	isLoading: boolean;
}

/**
 * The mockup's "Security" mini-panel — real security-category fixed/new/
 * still-open counts plus the real highest-severity still-open findings,
 * same shape SearchPerformancePanel (ReportsInsightPanels.tsx) uses for
 * SEO.
 */
export const SecurityPerformancePanel = ({
	panel,
	isLoading,
}: SecurityPerformancePanelProps) => (
	<CardComponent
		className="reports-panel"
		titleIcon="security"
		title={__('Security', 'vulopilot')}
		isLoading={isLoading}
	>
		{!isLoading && panel && (
			<>
				<div className="reports-panel-stats">
					<div className="reports-panel-stat is-good">
						<span>{panel.fixed}</span>
						{__('Fixed', 'vulopilot')}
					</div>
					<div className="reports-panel-stat is-attention">
						<span>{panel.new}</span>
						{__('New', 'vulopilot')}
					</div>
					<div className="reports-panel-stat is-neutral">
						<span>{panel.still_open}</span>
						{__('Still open', 'vulopilot')}
					</div>
				</div>
				{panel.top_open.length > 0 ? (
					<>
						<p className="reports-panel-list-label">
							{__('Latest issues', 'vulopilot')}
						</p>
						<ul className="reports-panel-list">
							{panel.top_open.map((item) => (
								<li key={item.id}>
									<span className={`admin-badge badge-${item.severity}`}>
										{item.severity}
									</span>
									{item.title}
								</li>
							))}
						</ul>
					</>
				) : (
					<ModuleGuardComponent
						icon="check"
						title={__('No open security findings', 'vulopilot')}
						desc={__('Your site is protected right now.', 'vulopilot')}
					/>
				)}
			</>
		)}
	</CardComponent>
);

interface ContentProgressPanelProps {
	content: ContentSummary | null;
	isLoading: boolean;
}

/**
 * The mockup's "Content progress" panel — "Pages improved"/"Older pages
 * to review" are real content-category Findings data; "New pieces
 * published"/"Drafts in progress" are real WordPress post-status counts —
 * two genuinely different, both-real, data sources (see
 * Controllers\ReportsOverview::build_content_summary()'s own docblock).
 */
export const ContentProgressPanel = ({
	content,
	isLoading,
}: ContentProgressPanelProps) => (
	<CardComponent
		className="reports-panel"
		titleIcon="document"
		title={__('Content Progress', 'vulopilot')}
		isLoading={isLoading}
	>
		{!isLoading && content && (
			<ul className="reports-panel-rows">
				<li>
					<span className="reports-panel-row-value">
						{content.pages_improved}
					</span>
					{__('Pages improved', 'vulopilot')}
				</li>
				<li>
					<span className="reports-panel-row-value">
						{content.new_published}
					</span>
					{__('New pieces published', 'vulopilot')}
				</li>
				<li>
					<span className="reports-panel-row-value">
						{content.older_to_review}
					</span>
					{__('Older pages to review', 'vulopilot')}
				</li>
				<li>
					<span className="reports-panel-row-value">
						{content.drafts_in_progress}
					</span>
					{__('Drafts in progress', 'vulopilot')}
				</li>
			</ul>
		)}
	</CardComponent>
);

interface StorePerformancePanelProps {
	store: StoreSummary | null;
	isLoading: boolean;
}

/**
 * `currency` is WooCommerce's own real store currency code
 * (`get_woocommerce_currency()`, Controllers\ReportsOverview::build_store_summary())
 * — `Intl.NumberFormat` renders the correct symbol/placement for it
 * without this codebase needing to maintain its own currency-symbol map.
 */
const formatMoney = (amount: number, currency: string | null): string => {
	if (!currency) {
		return String(amount);
	}

	try {
		return new Intl.NumberFormat(undefined, {
			style: 'currency',
			currency,
		}).format(amount);
	} catch {
		return String(amount);
	}
};

/**
 * The mockup's "Store performance" panel — `store.available === false`
 * (WooCommerce inactive) shows the same honest "Not applicable" state
 * ReportsCategoryStatusGrid.tsx's own Store tile already uses. When
 * available, `blockers_fixed`/`new_issues`/`products_to_review` are real
 * woocommerce-category Findings counts and `sales`/`orders`/`avg_order`
 * are real `wc_get_orders()` totals for the period (see
 * Controllers\ReportsOverview::build_store_summary()'s own docblock) —
 * not the mockup's own fabricated-looking "$6,420 · 48 Orders · +8%"
 * figures, whatever this specific real store's own numbers are.
 */
export const StorePerformancePanel = ({
	store,
	isLoading,
}: StorePerformancePanelProps) => (
	<CardComponent
		className="reports-panel"
		titleIcon="woocommerce"
		title={__('Store Performance', 'vulopilot')}
		isLoading={isLoading}
	>
		{!isLoading && store && !store.available && (
			<ModuleGuardComponent
				icon="woocommerce"
				title={__('Not applicable', 'vulopilot')}
				desc={__(
					'WooCommerce isn’t active on this site.',
					'vulopilot'
				)}
			/>
		)}
		{!isLoading && store && store.available && (
			<>
				<div className="reports-panel-stats">
					<div className="reports-panel-stat is-good">
						<span>{store.blockers_fixed}</span>
						{__('Blockers fixed', 'vulopilot')}
					</div>
					<div className="reports-panel-stat is-attention">
						<span>{store.new_issues}</span>
						{__('New issues', 'vulopilot')}
					</div>
					<div className="reports-panel-stat is-neutral">
						<span>{store.products_to_review}</span>
						{__('Products to review', 'vulopilot')}
					</div>
				</div>
				<p className="reports-panel-list-label">
					{__('Sales snapshot (this period)', 'vulopilot')}
				</p>
				<div className="reports-store-sales-row">
					<div>
						<span className="reports-panel-row-value">
							{formatMoney(store.sales ?? 0, store.currency)}
						</span>
						{__('Sales', 'vulopilot')}
					</div>
					<div>
						<span className="reports-panel-row-value">
							{store.orders}
						</span>
						{__('Orders', 'vulopilot')}
					</div>
					<div>
						<span className="reports-panel-row-value">
							{formatMoney(store.avg_order ?? 0, store.currency)}
						</span>
						{__('Avg. order', 'vulopilot')}
					</div>
				</div>
			</>
		)}
	</CardComponent>
);
