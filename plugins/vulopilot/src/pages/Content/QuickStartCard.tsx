import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent, ListComponent } from '@zyra/components';
import { CONTENT_TOOLS, ContentTool } from './ContentToolsGrid';
import ContentToolPopup from './ContentToolPopup';

/**
 * "Quick Start" — 4 shortcuts straight to specific tiles already in
 * `ContentToolsGrid.tsx` (same tool ids, same real ContentToolPopup flow)
 * rather than a separate, duplicated tool list.
 */
const QUICK_START_IDS = [
	'blog-generator',
	'product-descriptions',
	'landing-pages',
	'faq-generator',
];

const QUICK_START_SUBTITLES: Record<string, string> = {
	'blog-generator': __('Start from scratch', 'vulopilot'),
	'product-descriptions': __('Improve conversions', 'vulopilot'),
	'landing-pages': __('High-converting pages', 'vulopilot'),
	'faq-generator': __('Answer customer questions', 'vulopilot'),
};

const QUICK_START_LABELS: Record<string, string> = {
	'blog-generator': __('Write a Blog Post', 'vulopilot'),
	'product-descriptions': __('Generate Product Description', 'vulopilot'),
	'landing-pages': __('Create Landing Page', 'vulopilot'),
	'faq-generator': __('Generate FAQs', 'vulopilot'),
};

const QuickStartCard = () => {
	const [activeTool, setActiveTool] = useState<ContentTool | null>(null);

	const quickStartTools = QUICK_START_IDS.map(
		(id) => CONTENT_TOOLS.find((tool) => tool.id === id)!
	);

	return (
		<CardComponent title={__('Quick Start', 'vulopilot')} titleIcon="ai">
			<ListComponent
				className="mini-card list"
				border
				items={quickStartTools.map((tool) => ({
					id: tool.id,
					icon: tool.icon,
					title: QUICK_START_LABELS[tool.id],
					desc: QUICK_START_SUBTITLES[tool.id],
					tags: <i className="adminfont-arrow-right" />,
					action: () => setActiveTool(tool),
				}))}
			/>
			<ContentToolPopup
				tool={activeTool}
				onClose={() => setActiveTool(null)}
			/>
		</CardComponent>
	);
};

export default QuickStartCard;
