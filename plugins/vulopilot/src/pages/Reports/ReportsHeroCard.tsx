import React from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';

interface ReportsHeroCardProps {
	onScrollToGenerate: () => void;
}

/**
 * The mockup's "Here's what changed this week" hero is an AI-written
 * narrative with specific numbers (18% traffic, 12% visibility, 42 issues
 * fixed, 2.3% conversion, 3 blog posts, 186 images, 7 security threats) —
 * confirmed there's no narrative/prose-generation capability for reports
 * anywhere in this codebase (report generation only ever produces
 * structured summary/section/trend data, never prose). Replaced with a
 * real, honest description of what report generation actually does (13
 * real report types, real CSV/JSON/PDF export), with a real "Generate
 * Report" action that scrolls to the Report tab's real generate control —
 * same real-scroll move `AiForemanCard.tsx` used on Automate Work.
 */
const ReportsHeroCard = ({ onScrollToGenerate }: ReportsHeroCardProps) => (
	<CardComponent className="reports-hero-card">
		<h2 className="reports-hero-title">
			{__('Generate a real report on your website', 'vulopilot')}
		</h2>
		<p className="reports-hero-desc">
			{__(
				'Choose from scan summary, SEO, WooCommerce, security, accessibility, automation, AI usage, and more — export as CSV, JSON, or (with Pro) PDF.',
				'vulopilot'
			)}
		</p>
		<div className="reports-hero-actions">
			<ButtonInput
				buttons={{
					text: __('Generate Report', 'vulopilot'),
					icon: 'document',
					onClick: onScrollToGenerate,
				}}
			/>
		</div>
	</CardComponent>
);

export default ReportsHeroCard;
