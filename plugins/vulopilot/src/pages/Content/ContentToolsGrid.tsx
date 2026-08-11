import { useState } from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent, ListComponent } from '@zyra/components';
import ContentToolPopup from './ContentToolPopup';

export type ToolFieldType =
	| 'post-picker'
	| 'text'
	| 'textarea'
	| 'media-picker'
	| 'duplicate-finding-picker';

export interface ToolField {
	key: string;
	label: string;
	type: ToolFieldType;
	/** Only for 'post-picker' — restricts which real post types are offered. */
	postTypes?: ('post' | 'page')[];
}

export interface ContentTool {
	id: string;
	icon: string;
	color: string;
	title: string;
	desc: string;
	/** The real AIActionInterface id this tool runs (classes/AIActions/Actions/*.php). */
	actionId: string;
	fields: ToolField[];
}

/**
 * The 12 tool tiles each run a real AI action end-to-end: pick the real
 * input it needs (an existing post, an image, a topic — see `fields`),
 * `POST /ai-action-runs` (AIActions\ActionRunner::propose()), show the
 * real AI-generated preview, then approve/reject it for real via the
 * existing `/ai-action-runs/{id}/approve|reject` routes — see
 * ContentToolPopup.tsx for the full flow. 6 of these actions already
 * existed (GenerateBlogAction, GenerateProductDescriptionAction,
 * GenerateFaqAction, GenerateSchemaAction, GenerateAltAction,
 * WriteMetaTitleAction) but had no route to trigger them; the other 6
 * (WritePostContentAction, GenerateLandingPageAction, OptimizeContentAction,
 * RefreshContentAction, DifferentiateDuplicateTitleAction, OptimizeMediaAction)
 * are new, purpose-built for these tiles — see each class's own docblock.
 */
export const CONTENT_TOOLS: ContentTool[] = [
	{
		id: 'ai-writer',
		icon: 'edit',
		color: 'purple',
		title: __('AI Writer', 'vulopilot'),
		desc: __('Write engaging content with AI in seconds.', 'vulopilot'),
		actionId: 'write-post-content',
		fields: [
			{
				key: 'post_id',
				label: __('Post or page', 'vulopilot'),
				type: 'post-picker',
			},
			{
				key: 'brief',
				label: __('What should it write about?', 'vulopilot'),
				type: 'textarea',
			},
		],
	},
	{
		id: 'blog-generator',
		icon: 'document',
		color: 'green',
		title: __('Blog Generator', 'vulopilot'),
		desc: __('Generate SEO-optimized blog posts instantly.', 'vulopilot'),
		actionId: 'generate-blog',
		fields: [
			{ key: 'topic', label: __('Topic', 'vulopilot'), type: 'text' },
		],
	},
	{
		id: 'landing-pages',
		icon: 'web-page-website',
		color: 'blue',
		title: __('Landing Pages', 'vulopilot'),
		desc: __('Create high-converting landing pages.', 'vulopilot'),
		actionId: 'generate-landing-page',
		fields: [
			{
				key: 'topic',
				label: __('What is this landing page for?', 'vulopilot'),
				type: 'text',
			},
		],
	},
	{
		id: 'product-descriptions',
		icon: 'cart',
		color: 'orange',
		title: __('Product Descriptions', 'vulopilot'),
		desc: __('Write persuasive product descriptions that sell.', 'vulopilot'),
		actionId: 'generate-product-description',
		fields: [
			{
				key: 'product_name',
				label: __('Product name', 'vulopilot'),
				type: 'text',
			},
			{
				key: 'key_features',
				label: __('Key features (optional)', 'vulopilot'),
				type: 'textarea',
			},
		],
	},
	{
		id: 'faq-generator',
		icon: 'question',
		color: 'red',
		title: __('FAQ Generator', 'vulopilot'),
		desc: __('Generate FAQs that answer customer questions.', 'vulopilot'),
		actionId: 'generate-faq',
		fields: [
			{
				key: 'post_id',
				label: __('Post or page', 'vulopilot'),
				type: 'post-picker',
			},
		],
	},
	{
		id: 'schema-generator',
		icon: 'shortcode',
		color: 'indigo',
		title: __('Schema Generator', 'vulopilot'),
		desc: __('Create structured data schema markup.', 'vulopilot'),
		actionId: 'generate-schema',
		fields: [
			{
				key: 'post_id',
				label: __('Post or page (must be published)', 'vulopilot'),
				type: 'post-picker',
			},
		],
	},
	{
		id: 'image-alt-text',
		icon: 'image',
		color: 'green',
		title: __('Image Alt Text', 'vulopilot'),
		desc: __('Generate SEO-friendly alt text for images.', 'vulopilot'),
		actionId: 'generate-alt',
		fields: [
			{
				key: 'attachment_id',
				label: __('Image', 'vulopilot'),
				type: 'media-picker',
			},
		],
	},
	{
		id: 'meta-generator',
		icon: 'price',
		color: 'orange',
		title: __('Meta Generator', 'vulopilot'),
		desc: __('Create meta titles that rank.', 'vulopilot'),
		actionId: 'write-meta-title',
		fields: [
			{
				key: 'post_id',
				label: __('Post or page', 'vulopilot'),
				type: 'post-picker',
			},
		],
	},
	{
		id: 'content-optimizer',
		icon: 'bar-chart',
		color: 'teal',
		title: __('Content Optimizer', 'vulopilot'),
		desc: __('Optimize content for SEO and readability.', 'vulopilot'),
		actionId: 'optimize-content',
		fields: [
			{
				key: 'post_id',
				label: __('Post or page', 'vulopilot'),
				type: 'post-picker',
			},
		],
	},
	{
		id: 'content-refresh',
		icon: 'refresh',
		color: 'blue',
		title: __('Content Refresh', 'vulopilot'),
		desc: __('Update and improve existing content with AI.', 'vulopilot'),
		actionId: 'refresh-content',
		fields: [
			{
				key: 'post_id',
				label: __('Post or page', 'vulopilot'),
				type: 'post-picker',
			},
		],
	},
	{
		id: 'duplicate-content',
		icon: 'copy',
		color: 'pink',
		title: __('Duplicate Content', 'vulopilot'),
		desc: __('Find and fix duplicate content issues.', 'vulopilot'),
		actionId: 'differentiate-duplicate-title',
		fields: [
			{
				key: 'post_ids',
				label: __('Duplicate title group', 'vulopilot'),
				type: 'duplicate-finding-picker',
			},
		],
	},
	{
		id: 'media-library-ai',
		icon: 'media-library',
		color: 'purple',
		title: __('Media Library AI', 'vulopilot'),
		desc: __('Optimize alt text, titles, and captions for an image.', 'vulopilot'),
		actionId: 'optimize-media',
		fields: [
			{
				key: 'attachment_id',
				label: __('Image', 'vulopilot'),
				type: 'media-picker',
			},
		],
	},
];

const ContentToolsGrid = () => {
	const [activeTool, setActiveTool] = useState<ContentTool | null>(null);

	return (
		<CardComponent title={__('Content Tools', 'vulopilot')}>
			<ListComponent
				className="tool-grid"
				items={CONTENT_TOOLS.map((tool) => ({
					id: tool.id,
					icon: tool.icon,
					className: `icon-${tool.color}`,
					title: tool.title,
					desc: tool.desc,
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

export default ContentToolsGrid;
