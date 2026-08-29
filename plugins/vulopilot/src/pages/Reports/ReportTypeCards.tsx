/* global appLocalizer */
import React, { useEffect, useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ModuleGuardComponent, BadgeComponent } from '@zyra/components';

interface ReportRow {
	id: number;
	report_type: string;
	status: 'generating' | 'ready' | 'failed';
	created_at: string;
	meta?: string;
}

interface TrendEntry {
	current: number;
	previous: number;
	change_percent: number | null;
}

interface ReportMeta {
	summary?: Record<string, number | string>;
	trend?: Record<string, TrendEntry>;
}

const REPORT_CARD_TYPES = [
	{
		type: 'seo',
		label: __('Visibility Report', 'vulopilot'),
		icon: 'search-discovery',
	},
	{
		type: 'woocommerce',
		label: __('Commerce Report', 'vulopilot'),
		icon: 'woocommerce',
	},
	{
		type: 'content_intelligence',
		label: __('Content Report', 'vulopilot'),
		icon: 'document',
	},
];

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

const scrollToGenerate = () => {
	document
		.getElementById('reports-generate')
		?.scrollIntoView({ behavior: 'smooth' });
};

/**
 * The mockup's 4 per-category report mini-cards (Traffic/Visibility/
 * Commerce/Content) — Traffic dropped (no real report type maps to it;
 * GEO's crawler traffic is a fundamentally different metric). The other 3
 * map to real report types. One GET /reports fetch; the list response's
 * own `meta` field already contains the most recent generation's real
 * {summary, trend} for that report (confirmed: the list endpoint strips
 * only `file_path`), so this reads real headline numbers/trend without
 * triggering a new (heavyweight, file-writing) generation just to render a
 * summary card.
 */
const ReportTypeCards = () => {
	const [reports, setReports] = useState<ReportRow[] | null>(null);

	useEffect(() => {
		const baseUrl = getApiLink(appLocalizer, 'reports');
		const url = `${baseUrl}${
			baseUrl.includes('?') ? '&' : '?'
		}per_page=100&status=ready`;

		getApiResponse<{ data: ReportRow[] } | ReportRow[]>(
			url,
			nonceHeaders
		).then((response) => {
			const list = Array.isArray(response)
				? response
				: (response?.data ?? []);
			setReports(list);
		});
	}, []);

	if (reports === null) {
		return null;
	}

	return (
		<div className="report-type-cards">
			{REPORT_CARD_TYPES.map((card) => {
				const latest = reports
					.filter((row) => row.report_type === card.type)
					.sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

				let meta: ReportMeta = {};
				if (latest?.meta) {
					try {
						meta = JSON.parse(latest.meta);
					} catch {
						meta = {};
					}
				}

				const totalFindings = meta.summary?.total_findings;
				const trend = meta.trend?.total_findings;

				return (
					<CardComponent
						key={card.type}
						className="report-type-card"
						titleIcon={card.icon}
						title={card.label}
						desc={__('Total findings from your most recent report of this type.', 'vulopilot')}
					>
						{!latest ? (
							<ModuleGuardComponent
								icon={card.icon}
								title={__('No report generated yet', 'vulopilot')}
								desc={__(
									'Generate this report to see its real numbers here.',
									'vulopilot'
								)}
								buttonText={__('Generate', 'vulopilot')}
								onButtonClick={scrollToGenerate}
							/>
						) : (
							<>
								<p className="report-type-card-value">
									{typeof totalFindings === 'number'
										? totalFindings
										: '—'}
									{trend?.change_percent !== null &&
										trend?.change_percent !== undefined && (
											<BadgeComponent
												color={
													trend.change_percent <= 0
														? 'green'
														: 'red'
												}
												text={`${
													trend.change_percent > 0
														? '↑'
														: '↓'
												} ${Math.abs(
													trend.change_percent
												)}%`}
											/>
										)}
								</p>
								<p className="report-type-card-desc">
									{__(
										'Total findings, most recent report',
										'vulopilot'
									)}
								</p>
								<button
									type="button"
									className="report-type-card-action"
									onClick={scrollToGenerate}
								>
									{__('Open Report', 'vulopilot')}{' '}
									<i className="adminfont-arrow-right" />
								</button>
							</>
						)}
					</CardComponent>
				);
			})}
		</div>
	);
};

export default ReportTypeCards;
