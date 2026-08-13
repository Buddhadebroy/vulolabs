/* global appLocalizer */
import { useRef, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { applyFilters } from '@wordpress/hooks';
import { getApiLink, sendApiResponse, useOutsideClick } from '@zyra/core';
import {
	CardComponent,
	ModuleGuardComponent,
	NoticeManager,
	TooltipComponent,
} from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useApiList } from '../../services/useApiList';
import { getSeverityColor } from '../../services/getSeverityClass';
import { humanizeCategory } from '../../components/FindingsTable';
import './ProtectMySite.scss';

interface AttentionFinding {
	id: number;
	title: string;
	description?: string;
	category: string;
	scanner_id: string;
	severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
	status: 'open' | 'resolved' | 'ignored' | 'snoozed';
}

/**
 * Scanner id → the section label the reference mockup's own row tags show
 * ("Login & Accounts", "Website Exposure", "Browser Protection", "File
 * Integrity") — the mockup's own category tags are section names, not the
 * raw `category` DB column (RestApiScanner's own category is `rest-api`,
 * not `security`, for instance; SslMonitoringScanner's is `ssl`). Mirrors
 * ClassicSecurityTab.tsx's/FilesPluginsTab.tsx's own section→scannerIds
 * groupings; falls back to the raw humanized category for any scanner id
 * not covered by a named section here — still honest, just less
 * on-brand than the mockup's own hand-picked example rows.
 */
const SCANNER_SECTION_LABELS: Record<string, string> = {
	'weak-passwords': __('Login & Accounts', 'vulopilot'),
	'rest-api': __('Website Exposure', 'vulopilot'),
	'xmlrpc-exposure': __('Website Exposure', 'vulopilot'),
	'exposed-files': __('Website Exposure', 'vulopilot'),
	'debug-mode': __('Website Exposure', 'vulopilot'),
	'file-editor': __('Website Exposure', 'vulopilot'),
	'security-headers': __('Browser Protection', 'vulopilot'),
	'ssl-monitoring': __('SSL & Secure Connection', 'vulopilot'),
	'core-file-integrity': __('File Integrity', 'vulopilot'),
	'integrity-monitoring': __('File Integrity', 'vulopilot'),
	'basic-vulnerabilities': __('Plugin Vulnerabilities', 'vulopilot'),
	'advanced-vulnerabilities': __('Plugin Vulnerabilities', 'vulopilot'),
	'theme-vulnerabilities': __('Theme Vulnerabilities', 'vulopilot'),
};

const sectionLabelFor = (row: AttentionFinding): string =>
	SCANNER_SECTION_LABELS[row.scanner_id] || humanizeCategory(row.category);

/**
 * Same "register a source, don't modify the host" Fix handler FindingsTable
 * itself reads — see that component's own getFindingFixHandler() docblock
 * for the full reasoning (why it's read fresh per click rather than cached).
 */
const getFindingFixHandler = () =>
	applyFilters('vulopilot_finding_fix_handler', null);

/**
 * Same bulk-fix handler slot FindingsTable's own "Fix selected" bulk
 * action reads — real when vulopilot-pro's OneClickFix module is active,
 * null otherwise.
 */
const getFindingBulkFixHandler = () =>
	applyFilters('vulopilot_finding_bulk_fix_handler', null);

interface ReviewMenuProps {
	onFix: () => void;
	onResolve: () => void;
	onIgnore: () => void;
	onSnooze: () => void;
}

/**
 * The mockup's single "Review →" row button — real actions behind it
 * (same REST routes FindingsTable's own row actions call) rather than a
 * dead link or a fake single action. Its own component (not inlined in
 * the row map below) purely so each row gets its own outside-click ref
 * without breaking the rules of hooks.
 */
const ReviewMenu = ({ onFix, onResolve, onIgnore, onSnooze }: ReviewMenuProps) => {
	const [open, setOpen] = useState(false);
	const containerRef = useRef<HTMLDivElement>(null);

	useOutsideClick(containerRef, () => setOpen(false));

	const runAndClose = (action: () => void) => {
		setOpen(false);
		action();
	};

	return (
		<div className="attention-issue-review" ref={containerRef}>
			<button
				type="button"
				className="attention-issue-review-button"
				onClick={() => setOpen((value) => !value)}
			>
				{__('Review', 'vulopilot')}
				<i className="adminfont-pagination-right-arrow" />
			</button>
			{open && (
				<div className="attention-issue-menu">
					<button type="button" onClick={() => runAndClose(onFix)}>
						{__('Fix', 'vulopilot')}
					</button>
					<button type="button" onClick={() => runAndClose(onResolve)}>
						{__('Mark resolved', 'vulopilot')}
					</button>
					<button type="button" onClick={() => runAndClose(onIgnore)}>
						{__('Ignore', 'vulopilot')}
					</button>
					<button type="button" onClick={() => runAndClose(onSnooze)}>
						{__('Snooze', 'vulopilot')}
					</button>
				</div>
			)}
		</div>
	);
};

interface IssuesNeedAttentionCardProps {
	/** Scanner ids to combine into one "most recent open" list — same shape FindingsTable's own `scannerIds` prop takes. */
	scannerIds: string[];
	/** "View all N issues" header action and the empty state's own call to action both go here — the full findings list lives elsewhere on this page (or another tab), not on this card. */
	onViewAll: () => void;
	/** DOM id for the hero card's own "Review Issues First" scroll target. */
	id?: string;
}

/**
 * The mockup's "Issues that need your attention" — same real top-5-most-
 * recent-open-findings fetch OpenIssuesGlimpse already established
 * (VulnerabilitiesFoundCard's own version of this exact section), but
 * with the mockup's own row anatomy (a plain colored severity icon, the
 * finding's own real description, a section-name tag + severity tag, one
 * "Review" button) instead of OpenIssuesGlimpse's simpler title+tag row —
 * a dedicated component rather than a new variant bolted onto
 * OpenIssuesGlimpse since that component is shared with GEO/AEO's own
 * unrelated pages and this row shape is specific to what this one mockup
 * needs.
 */
const IssuesNeedAttentionCard = ({
	scannerIds,
	onViewAll,
	id,
}: IssuesNeedAttentionCardProps) => {
	const { data, total, isLoading, refetch } = useApiList<AttentionFinding>(
		'findings',
		{
			scanner_id: scannerIds.join(','),
			status: 'open',
			per_page: 5,
			orderby: 'id',
			order: 'desc',
		}
	);

	const handleSetStatus = (
		id: number,
		status: 'resolved' | 'ignored',
		successMessage: string
	) => {
		sendApiResponse(appLocalizer, getApiLink(appLocalizer, `findings/${id}`), {
			status,
		}).then((response) => {
			if (response) {
				NoticeManager.add({
					uniqueKey: `attention-${status}-${id}`,
					type: 'success',
					position: 'float',
					message: successMessage,
				});
				refetch();
			} else {
				NoticeManager.add({
					uniqueKey: `attention-${status}-failed-${id}`,
					type: 'error',
					position: 'float',
					message: __(
						'Could not update this finding. Please try again.',
						'vulopilot'
					),
				});
			}
		});
	};

	const handleSnooze = (id: number) => {
		sendApiResponse(
			appLocalizer,
			getApiLink(appLocalizer, `findings/${id}/actions/snooze-finding`),
			{}
		).then((response: { success?: boolean; message?: string } | undefined) => {
			NoticeManager.add({
				uniqueKey: `attention-snooze-${id}`,
				type: response?.success ? 'success' : 'error',
				position: 'float',
				message:
					response?.message ||
					__('Could not snooze this finding. Please try again.', 'vulopilot'),
			});
			if (response?.success) {
				refetch();
			}
		});
	};

	const handleFix = (row: AttentionFinding) => {
		const fixHandler = getFindingFixHandler();

		if (typeof fixHandler !== 'function') {
			return;
		}

		Promise.resolve(
			fixHandler(row) as Promise<{ success: boolean; message: string }> | undefined
		).then((outcome) => {
			if (outcome?.message) {
				NoticeManager.add({
					uniqueKey: `attention-fix-${row.id}`,
					type: outcome.success ? 'success' : 'error',
					position: 'float',
					message: outcome.message,
				});
			}
			refetch();
		});
	};

	const bulkFixHandler = getFindingBulkFixHandler();

	const handleBulkFix = () => {
		if (typeof bulkFixHandler !== 'function') {
			return;
		}

		Promise.resolve(
			bulkFixHandler(data.map((row) => row.id)) as
				| Promise<{ success: boolean; message: string }>
				| undefined
		).then((outcome) => {
			if (outcome?.message) {
				NoticeManager.add({
					uniqueKey: 'attention-bulk-fix',
					type: outcome.success ? 'success' : 'error',
					position: 'float',
					message: outcome.message,
				});
			}
			refetch();
		});
	};

	return (
		<CardComponent
			id={id}
			title={__('Issues that need your attention', 'vulopilot')}
			desc={__(
				'Focus on these issues first to improve your site security.',
				'vulopilot'
			)}
			isLoading={isLoading}
			action={
				total > 0 && (
					<ButtonInput
						buttons={{
							text: sprintf(
								/* translators: %d is the number of open findings. */
								__('View all %d issues', 'vulopilot'),
								total
							),
							onClick: onViewAll,
						}}
					/>
				)
			}
		>
			{!isLoading && data.length === 0 && (
				<ModuleGuardComponent
					icon="check"
					title={__("You're all caught up", 'vulopilot')}
					desc={__('No open issues right now.', 'vulopilot')}
				/>
			)}
			{!isLoading && data.length > 0 && (
				<div className="attention-issues-list">
					{data.map((row) => (
						<div className="attention-issue-row" key={row.id}>
							<i
								className={`adminfont-${
									row.severity === 'low' || row.severity === 'info'
										? 'info'
										: 'error'
								} attention-issue-icon`}
								style={{ color: getSeverityColor(row.severity) }}
							/>
							<div className="attention-issue-body">
								<div className="attention-issue-title">{row.title}</div>
								{row.description && (
									<div className="attention-issue-desc">
										{row.description}
									</div>
								)}
								<div className="attention-issue-meta">
									<span className="admin-badge">
										{sectionLabelFor(row)}
									</span>
									<span className={`admin-badge badge-${row.severity}`}>
										{row.severity}
									</span>
									<ReviewMenu
										onFix={() => handleFix(row)}
										onResolve={() =>
											handleSetStatus(
												row.id,
												'resolved',
												__(
													'Finding marked as resolved.',
													'vulopilot'
												)
											)
										}
										onIgnore={() =>
											handleSetStatus(
												row.id,
												'ignored',
												__('Finding ignored.', 'vulopilot')
											)
										}
										onSnooze={() => handleSnooze(row.id)}
									/>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
			{!isLoading && data.length > 0 && (
				<div className="attention-issues-footer">
					{bulkFixHandler ? (
						<ButtonInput
							buttons={{
								text: __('Review AI Fixes', 'vulopilot'),
								icon: 'ai',
								onClick: handleBulkFix,
							}}
						/>
					) : (
						<TooltipComponent
							text={__(
								"Bulk auto-fix isn't available yet — no security scanner is mapped to an automated fix action. Fix findings individually from each row's Review menu.",
								'vulopilot'
							)}
						>
							<span
								role="button"
								aria-disabled="true"
								className="security-fix-all disabled"
							>
								<i className="adminfont-ai" />
								{__('Review AI Fixes', 'vulopilot')}
							</span>
						</TooltipComponent>
					)}
					<p className="desc">
						{__(
							'VuloPilot can review and resolve eligible issues automatically.',
							'vulopilot'
						)}
					</p>
				</div>
			)}
		</CardComponent>
	);
};

export default IssuesNeedAttentionCard;
