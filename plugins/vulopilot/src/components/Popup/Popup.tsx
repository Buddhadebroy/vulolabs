/* global appLocalizer */
import React from 'react';
import { ButtonInput } from '@zyra/inputs';
import { __, sprintf } from '@wordpress/i18n';
import '../Popup/Popup.scss';

interface PopupProps {
	moduleName?: string;
	plugin?: string;
}

const formatModuleName = (name: string): string => {
	return name
		.split('-')
		.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
		.join(' ');
};

/**
 * The Pro tier of exactly the 13 modules on the Modules page
 * (../Modules/index.ts's catalog — the user's own mockup's 13 cards, no
 * more), same names/copy, kept in sync with that file rather than invented
 * separately. GEO Radar and AEO Autopilot share one entry here too (both
 * real 'geo-insights'). WooCommerce AI/Intelligence, Advanced Reports, and
 * MCP Server were previously listed here but no longer have a card on the
 * Modules page at all — dropped so this pitch doesn't advertise modules
 * this page can't actually point the user at.
 */
const proPopupContent = {
	messages: [
		{
			icon: 'global-community',
			text: __('GEO Radar / AEO Autopilot', 'vulopilot'),
			des: __(
				'Historical GEO trend charts, scheduled automated scans, AI-powered bulk fixes, llms.txt generation, and multi-engine answer testing.',
				'vulopilot'
			),
		},
		{
			icon: 'attachment',
			text: __('Knowledge Graph', 'vulopilot'),
			des: __(
				'Entity relationship mapping, AI-powered graph enrichment, and Schema.org graph export.',
				'vulopilot'
			),
		},
		{
			icon: 'ai',
			text: __('Bot Watch', 'vulopilot'),
			des: __(
				'Historical AI-crawler trends, anomaly alerts, and 12-month log retention.',
				'vulopilot'
			),
		},
		{
			icon: 'megaphone',
			text: __('Brand Radar', 'vulopilot'),
			des: __(
				'Off-site mention monitoring, share-of-voice tracking, and competitor comparison via a connected Ahrefs account.',
				'vulopilot'
			),
		},
		{
			icon: 'seo',
			text: __('SEO Copilot', 'vulopilot'),
			des: __(
				'Keyword rank tracking, keyword cannibalization detection, and Google Search Console integration.',
				'vulopilot'
			),
		},
		{
			icon: 'document',
			text: __('Content Copilot', 'vulopilot'),
			des: __(
				'AI rewrite & expansion, topic clustering, and content gap analysis vs. competitors.',
				'vulopilot'
			),
		},
		{
			icon: 'report',
			text: __('Speed Radar', 'vulopilot'),
			des: __(
				'Historical performance trends, scheduled audits, and AI-generated optimization suggestions.',
				'vulopilot'
			),
		},
		{
			icon: 'accessibility',
			text: __('Accessibility Guard', 'vulopilot'),
			des: __(
				'Bulk accessibility fixes, scheduled audits, and historical WCAG compliance reports.',
				'vulopilot'
			),
		},
		{
			icon: 'security',
			text: __('Security Watchtower', 'vulopilot'),
			des: __(
				'Scheduled security scans, a live CVE vulnerability feed, plugin/theme integrity monitoring, and alerts & incident reports.',
				'vulopilot'
			),
		},
		{
			icon: 'tools',
			text: __('AI Copilot', 'vulopilot'),
			des: __(
				'One-click AI fixes, bulk AI fixes across any module, and auto-apply with an approval queue.',
				'vulopilot'
			),
		},
		{
			icon: 'automation',
			text: __('Workflow Autopilot', 'vulopilot'),
			des: __(
				'Custom triggers & conditions, scheduled workflows, and auto-react to scan findings.',
				'vulopilot'
			),
		},
	],
};

const ShowProPopup: React.FC<PopupProps> = (props) => {
	if (props.plugin) {
		return (
			<div className="popup-wrapper">
				<div className="popup-header">
					<i className={`adminfont-${props.plugin}`} />
				</div>
				<div className="popup-body">
					<div className="module-name">
						{sprintf(
							/* translators: %s: Plugin name. */
							__('Plugin Required: %s', 'vulopilot'),
							props.plugin
						)}
					</div>
					<div className="module-desc">
						{sprintf(
							__(
								'This feature requires the "%s" plugin to be active.',
								'vulopilot'
							),
							props.plugin
						)}
					</div>
					<ButtonInput
						position="center"
						buttons={[
							{
								icon: 'eye',
								text: __('Activate Plugin', 'vulopilot'),
								onClick: () => {
									window.open(
										`${appLocalizer.admin_url.replace(/admin\.php.*/, '')}plugins.php`,
										'_blank'
									);
								},
							},
						]}
					/>
				</div>
			</div>
		);
	}

	if (props.moduleName) {
		return (
			<div className="popup-wrapper">
				<div className="popup-header">
					<i className={`adminfont-${props.moduleName}`} />
				</div>
				<div className="popup-body">
					<div className="module-name">
						{sprintf(
							/* translators: %s: Module name. */
							__('Activate %s', 'vulopilot'),
							formatModuleName(props.moduleName)
						)}
					</div>
					<div className="module-desc">
						{sprintf(
							/* translators: %s: Module name. */
							__(
								'This feature is currently unavailable. To activate it, please enable the %s module.',
								'vulopilot'
							),
							formatModuleName(props.moduleName)
						)}
					</div>
					<ButtonInput
						position="center"
						buttons={[
							{
								icon: 'eye',
								text: __('Enable Now', 'vulopilot'),
								onClick: () => {
									// Same admin page, just a different
									// hash tab — '_self' matches
									// LiveThreatMonitorCard.tsx's own
									// same-page navigation. Omitting the
									// target opens a new background tab
									// instead (real browser behavior,
									// despite MDN's prose default of
									// '_self'), which silently left the
									// user looking at the still-locked
									// widget with no visible feedback.
									window.open(
										`${appLocalizer.admin_url}#&tab=modules&module=${props.moduleName}`,
										'_self'
									);
								},
							},
						]}
					/>
				</div>
			</div>
		);
	}

	return (
		<div className="popup-wrapper">
			<div className="top-section">
				<div className="heading">
					{__(
						'Unlock the full VuloPilot toolkit',
						'vulopilot'
					)}
				</div>
				<div className="description">
					{__(
						'Automated fixes, scheduled scans, security monitoring, and WooCommerce AI — on top of everything Free already does.',
						'vulopilot'
					)}
				</div>
				<a
					className="admin-btn"
					href={appLocalizer.shop_url}
					target="_blank"
					rel="noreferrer"
				>
					{__('Upgrade to Pro', 'vulopilot')}
					<i className="adminfont-arrow-right arrow-icon"></i>
				</a>
			</div>
			<div className="popup-details">
				<div className="heading-text">
					{__('What Pro adds', 'vulopilot')}
				</div>
				<ul>
					{proPopupContent.messages.map((message, index) => (
						<li key={index}>
							<div className="title">
								<i className={`adminfont-${message.icon}`} />
								{message.text}
							</div>
							<div className="desc">{message.des}</div>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
};

export default ShowProPopup;
