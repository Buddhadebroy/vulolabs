/* global appLocalizer */
import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import {
	BadgeComponent,
	CardComponent,
	ColumnComponent,
	ModuleGuardComponent,
	NoticeManager,
	PopupComponent,
} from '@zyra/components';
import { ButtonInput, TextInput } from '@zyra/inputs';
import { TableCard, TableRow } from '@zyra/table';
import { useApiList } from '../../services/useApiList';

/**
 * `wp_vulopilot_not_found_logs` rows — Services\NotFoundLogger's own real
 * 404 visit log, both missing content pages and theme/plugin/core-file/
 * asset requests (Services\NotFoundLogger::is_system_path()) in one
 * merged, filterable table.
 */
interface NotFoundLogRow extends TableRow {
	id: number;
	requested_path: string;
	referrer: string | null;
	hit_count: number;
	last_seen_at: string;
	// AbstractRepository's `SELECT *` comes back through $wpdb (and then
	// wp_json_encode) as a numeric STRING, not a real number/boolean — a
	// row's own `"0"` here is truthy in JS, so every read of this field
	// below goes through isSystemLog() rather than a bare `row.is_system`
	// check.
	is_system: 0 | 1 | '0' | '1';
}

/** See NotFoundLogRow.is_system's own comment — `"0"` from the REST API is a truthy string, so this is the only safe way to read it. */
const isSystemLog = (row: Pick<NotFoundLogRow, 'is_system'>): boolean =>
	1 === Number(row.is_system);

/**
 * "404s" inner section of the merged "Crawl & URLs" tab — real 404 visit
 * log, extracted out of BrokenLinksSection.tsx's own former "404 Log"
 * card (direct instruction: "Broken Links + Redirects + Crawler Traffic
 * are fragmented... And the Redirect screen also contains a 404
 * log... A cleaner structure would be one main tab: Crawl & URLs [with]
 * Overview | Broken Links | Redirects | 404s | Robots & Sitemap").
 *
 * Fully self-contained — confirmed before extracting it that its own
 * `notFoundLogs` fetch and `POST /not-found-logs/{id}/convert`
 * "convert to redirect" flow never shared any real state with
 * BrokenLinksSection.tsx's own broken-link/image findings (that tab has
 * its own, separate `openRedirectPopup` flow for turning a broken-link
 * FINDING into a redirect — a different real action against a different
 * real endpoint, `POST /redirects`, not this one), so moving this here
 * was a clean cut, not a refactor of shared logic.
 */
const NotFoundLogSection = () => {
	const [convertingLog, setConvertingLog] = useState<NotFoundLogRow | null>(
		null
	);
	const [convertTargetUrl, setConvertTargetUrl] = useState('');
	const [isConverting, setIsConverting] = useState(false);

	// "All/Content/System" status pill bar — same `${key}_counts` contract
	// Redirects.php's own `is_active_counts` already established
	// (NotFoundLogs.php's `is_system_counts`).
	const notFoundLogs = useApiList<NotFoundLogRow>(
		'not-found-logs',
		{ orderby: 'last_seen_at' },
		{
			key: 'is_system',
			options: [
				{ label: __('Content', 'vulopilot'), value: '0' },
				{ label: __('System', 'vulopilot'), value: '1' },
			],
		}
	);

	const handleDismissLog = (row: NotFoundLogRow) => {
		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, `not-found-logs/${row.id}/delete`),
			{}
		).then((response) => {
			if (response) {
				notFoundLogs.refetch();
			}
		});
	};

	const openConvertPopup = (row: NotFoundLogRow) => {
		if (isSystemLog(row)) {
			// Belt-and-braces — the row action itself is already disabled
			// (no onClick reaches here) for a system row, see the "Type"-
			// gated actions column below.
			return;
		}

		setConvertingLog(row);
		setConvertTargetUrl('');
	};

	const closeConvertPopup = () => {
		setConvertingLog(null);
		setConvertTargetUrl('');
	};

	const handleConvertLog = () => {
		if (!convertingLog || '' === convertTargetUrl.trim()) {
			return;
		}

		setIsConverting(true);

		sendApiResponse(
			appLocalizer,
			getApiLink(
				appLocalizer,
				`not-found-logs/${convertingLog.id}/convert`
			),
			{ target_url: convertTargetUrl }
		)
			.then((response) => {
				NoticeManager.add({
					uniqueKey: 'vulopilot-log-convert',
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __(
								'Redirect created from this log entry.',
								'vulopilot'
							)
						: __(
								'Could not create a redirect — a redirect for this path may already exist.',
								'vulopilot'
							),
				});

				if (response) {
					closeConvertPopup();
					notFoundLogs.refetch();
				}
			})
			.finally(() => setIsConverting(false));
	};

	return (
		<>
			<ColumnComponent>
				<CardComponent
					title={__('404 Log', 'vulopilot')}
					titleIcon="error"
					desc={__(
						'Every real 404 this site has seen, both missing content pages and theme/plugin/core-file/asset requests (a stale cached bundle, a removed theme asset, a browser probing a well-known path) — told apart by the "Type" column and filterable by the pills above the table. Only a content-page 404 can be turned into a redirect; nobody redirects a broken theme file.',
						'vulopilot'
					)}
				>
					{notFoundLogs.error ? (
						<ModuleGuardComponent
							icon="error"
							title={__('Could not load the 404 log', 'vulopilot')}
							desc={notFoundLogs.error}
							buttonText={__('Retry', 'vulopilot')}
							onButtonClick={notFoundLogs.refetch}
						/>
					) : (
						<TableCard
							search={{
								placeholder: __('Search missing URLs…', 'vulopilot'),
							}}
							format={appLocalizer.date_format_js}
							headers={{
								requested_path: {
									label: __('Requested URL', 'vulopilot'),
								},
								is_system: {
									label: __('Type', 'vulopilot'),
									render: (row: NotFoundLogRow) => (
										<BadgeComponent
											color={isSystemLog(row) ? 'yellow' : 'blue'}
											text={
												isSystemLog(row)
													? __('System', 'vulopilot')
													: __('Content', 'vulopilot')
											}
										/>
									),
								},
								hit_count: {
									label: __('Hits', 'vulopilot'),
									isSortable: true,
								},
								last_seen_at: {
									label: __('Last seen', 'vulopilot'),
									type: 'date',
									isSortable: true,
									defaultSort: true,
									defaultOrder: 'desc',
								},
								actions: {
									label: __('Actions', 'vulopilot'),
									// Real labelled buttons, same `type: 'button'`
									// convention every other table's own action
									// column now uses (TableRowActions.tsx) — not
									// the plain icon-only look.
									type: 'action',
									actions: [
										{
											type: 'button',
											label: (row: Record<string, unknown>) =>
												isSystemLog(row as unknown as NotFoundLogRow)
													? __(
															"System file — no redirect needed",
															'vulopilot'
														)
													: __('Create redirect', 'vulopilot'),
											icon: (row: Record<string, unknown>) =>
												isSystemLog(row as unknown as NotFoundLogRow)
													? 'lock'
													: 'link',
											onClick: (row: Record<string, unknown>) => {
												const logRow = row as unknown as NotFoundLogRow;

												if (!isSystemLog(logRow)) {
													openConvertPopup(logRow);
												}
											},
										},
										{
											type: 'button',
											label: __('Dismiss', 'vulopilot'),
											icon: 'cross',
											onClick: (row: Record<string, unknown>) =>
												handleDismissLog(row as unknown as NotFoundLogRow),
										},
									],
								},
							}}
							rows={notFoundLogs.data}
							ids={notFoundLogs.data.map((row) => row.id)}
							totalRows={notFoundLogs.total}
							categoryCounts={notFoundLogs.categoryCounts}
							isLoading={notFoundLogs.isLoading}
							onQueryUpdate={notFoundLogs.onQueryUpdate}
							emptyMessage={__(
								'No 404s logged yet — turn on "Log 404s" in Settings → Scanning → SEO to start tracking missing-page visits.',
								'vulopilot'
							)}
						/>
					)}
				</CardComponent>
			</ColumnComponent>

			<PopupComponent
				open={!!convertingLog}
				onClose={closeConvertPopup}
				width={28}
				height="auto"
				position="lightbox"
				header={{
					title: __('Create redirect', 'vulopilot'),
				}}
			>
				<div className="vulopilot-redirect-form">
					<TextInput
						name="convert_source_path"
						value={convertingLog?.requested_path ?? ''}
						disabled
						onChange={() => {}}
					/>
					<TextInput
						name="convert_target_url"
						placeholder={__(
							'https://example.com/new-page/',
							'vulopilot'
						)}
						value={convertTargetUrl}
						onChange={(newValue) =>
							setConvertTargetUrl(newValue as string)
						}
					/>
					<ButtonInput
						buttons={{
							text: __('Save', 'vulopilot'),
							onClick: handleConvertLog,
							disabled:
								isConverting || '' === convertTargetUrl.trim(),
						}}
					/>
				</div>
			</PopupComponent>
		</>
	);
};

export default NotFoundLogSection;
