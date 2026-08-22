/* global appLocalizer */
import React, { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { getApiLink, sendApiResponse } from '@zyra/core';
import { NoticeManager } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import DashboardWidget from './DashboardWidget';
import { WidgetProps } from './types';

/**
 * "Run Complete Audit" — triggers the same `POST /scans` action
 * Dashboard.tsx's own header "Run scan" button calls (scanner_id: 'all',
 * trigger_type: 'manual'); called directly here rather than threading a
 * shared handler through WidgetProps, matching how every other widget
 * (e.g. NeedsAttentionWidget) already calls sendApiResponse/getApiLink
 * itself instead of reaching up into Dashboard.tsx.
 *
 * "Schedule Audit" navigates to the Automation tab — the real place a
 * recurring scan gets configured today; there's no separate "schedule a
 * one-off audit" capability to wire this to instead.
 */
const RunAuditWidget: React.FC<WidgetProps> = ({
	isLoading,
	onHide,
	isCustomizing,
}) => {
	const [isScanning, setIsScanning] = useState(false);

	const handleRunAudit = () => {
		setIsScanning(true);

		sendApiResponse(appLocalizer, getApiLink(appLocalizer, 'scans'), {
			scanner_id: 'all',
			trigger_type: 'manual',
		})
			.then((response) => {
				NoticeManager.add({
					uniqueKey: 'vulopilot-dashboard-run-audit',
					type: response ? 'success' : 'error',
					position: 'float',
					message: response
						? __(
								'Scan started — results will appear here shortly.',
								'vulopilot'
							)
						: __(
								'Could not start a scan. Please try again.',
								'vulopilot'
							),
				});
			})
			.finally(() => setIsScanning(false));
	};

	const handleScheduleAudit = () => {
		window.location.href = '?page=vulopilot#&tab=automations';
	};

	return (
		<DashboardWidget
			title={__('Run Complete Audit', 'vulopilot')}
			icon="search"
			isLoading={isLoading}
			onHide={onHide}
			isCustomizing={isCustomizing}
		>
			<div className="run-audit-visual">
				<span className="run-audit-visual-icon run-audit-visual-icon--search">
					<i className="adminfont-search" />
				</span>
				<span className="run-audit-visual-icon run-audit-visual-icon--ai">
					<i className="adminfont-ai" />
				</span>
			</div>
			<p className="run-audit-desc">
				{__(
					"Let VuloPilot scan your entire site and provide AI-powered recommendations.",
					'vulopilot'
				)}
			</p>
			<ButtonInput
				position="left"
				buttons={[
					{
						text: isScanning
							? __('Scanning…', 'vulopilot')
							: __('Run AI Audit', 'vulopilot'),
						icon: 'search',
						color: 'purple',
						disabled: isScanning,
						onClick: handleRunAudit,
					},
					{
						text: __('Schedule Audit', 'vulopilot'),
						icon: 'calendar',
						onClick: handleScheduleAudit,
					},
				]}
			/>
		</DashboardWidget>
	);
};

export default RunAuditWidget;
