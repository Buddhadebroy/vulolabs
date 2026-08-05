import React from 'react';
import { __, sprintf } from '@wordpress/i18n';
import './AICopilot.scss';
import { InformationItemComponent, ModuleGuardComponent } from '@zyra/components';
import { useApiList } from '../../services/useApiList';

interface FindingRow {
	id: number;
	title: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
	category?: string;
	description?: string;
}

/** Same category → tab mapping AISuggestionsWidget.tsx's own Dashboard
 * widget already uses — a finding's actual fix lives on its category's
 * page, not behind a one-click AI trigger (confirmed not to exist yet). */
const CATEGORY_TABS: Record<string, string> = {
	seo: 'seo',
	performance: 'performance',
	accessibility: 'accessibility',
	woocommerce: 'woocommerce',
	geo: 'geo',
	security: 'health',
	content: 'content',
	brand: 'brand-visibility',
};

const CATEGORY_ICONS: Record<string, string> = {
	seo: 'search-discovery',
	performance: 'bar-chart',
	accessibility: 'security',
	woocommerce: 'woocommerce',
	geo: 'geo-location',
	security: 'security',
	content: 'document',
	brand: 'star',
};

const CATEGORY_COLORS: Record<string, string> = {
	seo: '#2563eb',
	performance: '#7c3aed',
	accessibility: '#0d9488',
	woocommerce: '#f97316',
	geo: '#16a34a',
	security: '#dc2626',
	content: '#4f46e5',
	brand: '#db2777',
};

interface SuggestedActionsListProps {
	/** Row cap — omit for the full "Suggested Actions" tab. */
	limit?: number;
}

/**
 * Real open findings (`GET /findings`, same endpoint the Dashboard's
 * AISuggestionsWidget.tsx already uses), rendered as the mockup's icon
 * box + title + one-line description rows. Shared between ChatTab.tsx's
 * sidebar preview and SuggestedActionsTab.tsx's full list so both read
 * the same live data instead of two independent fetches drifting apart.
 */
const SuggestedActionsList: React.FC<SuggestedActionsListProps> = ({
	limit,
}) => {
	const { data, isLoading, error, refetch } = useApiList<FindingRow>(
		'findings',
		{ status: 'open', per_page: limit ?? 20, orderby: 'id', order: 'desc' }
	);

	if (error) {
		return (
			<ModuleGuardComponent
				icon="error"
				title={__('Could not load suggested actions', 'vulopilot')}
				desc={error}
				buttonText={__('Retry', 'vulopilot')}
				onButtonClick={refetch}
			/>
		);
	}

	if (isLoading) {
		return (
			<>
				{Array.from({ length: limit ?? 4 }).map((_, index) => (
					<InformationItemComponent key={index} title="" isLoading />
				))}
			</>
		);
	}

	if (data.length === 0) {
		return (
			<ModuleGuardComponent
				icon="check"
				title={__('Nothing to suggest right now', 'vulopilot')}
				desc={__(
					'AI suggestions appear here once a scan finds something worth fixing.',
					'vulopilot'
				)}
			/>
		);
	}

	return (
		<>
			{data.map((finding) => {
				const goToFix = () => {
					const tab =
						CATEGORY_TABS[finding.category ?? ''] ?? 'health';
					window.location.href = `?page=vulopilot#&tab=${tab}`;
				};

				return (
					<InformationItemComponent
						key={finding.id}
						title={finding.title}
						onClick={goToFix}
						avatar={{
							iconClass:
								CATEGORY_ICONS[finding.category ?? ''] ?? 'ai',
							color:
								CATEGORY_COLORS[finding.category ?? ''] ??
								'#2563eb',
						}}
						descriptions={[
							{
								value:
									finding.description ||
									sprintf(
										/* translators: %s: finding severity (e.g. "high") */
										__('%s severity', 'vulopilot'),
										finding.severity
									),
							},
						]}
						rightContent={
							<button
								type="button"
								className="ai-copilot-row-arrow"
								aria-label={__('Go to fix', 'vulopilot')}
								onClick={goToFix}
							>
								<i className="adminfont-arrow-right" />
							</button>
						}
					/>
				);
			})}
		</>
	);
};

export default SuggestedActionsList;
