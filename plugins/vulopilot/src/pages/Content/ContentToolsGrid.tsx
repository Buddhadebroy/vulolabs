import { __ } from '@wordpress/i18n';
import { CardComponent, ListComponent, NoticeManager } from '@zyra/components';

export interface ContentTool {
	id: string;
	icon: string;
	color: string;
	title: string;
	desc: string;
}

/**
 * The 12 tool tiles map to real, fully-implemented AI action classes in
 * `classes/AIActions/Actions/*.php` (GenerateBlogAction, GenerateFaqAction,
 * GenerateSchemaAction, GenerateAltAction, WriteMetaTitleAction/
 * WriteMetaDescriptionAction, GenerateProductDescriptionAction,
 * RewriteContentAction, etc.) — but the one REST route needed to trigger
 * one (`POST /ai-action-runs` → `AIActions\ActionRunner::propose()`) was
 * never wired up (confirmed: `propose()` is fully implemented, just never
 * called from any route). Per this session's "no new backend work" rule
 * and the explicit choice to keep these as honest mockup buttons, every
 * tile is real-looking and clickable, but shows an honest "not connected
 * yet" notice instead of a fabricated success state — same posture as AI
 * Copilot's send button and Grow My Traffic's "Fix Everything with AI".
 */
export const CONTENT_TOOLS: ContentTool[] = [
	{
		id: 'ai-writer',
		icon: 'edit',
		color: 'purple',
		title: __('AI Writer', 'vulopilot'),
		desc: __('Write engaging content with AI in seconds.', 'vulopilot'),
	},
	{
		id: 'blog-generator',
		icon: 'document',
		color: 'green',
		title: __('Blog Generator', 'vulopilot'),
		desc: __('Generate SEO-optimized blog posts instantly.', 'vulopilot'),
	},
	{
		id: 'landing-pages',
		icon: 'web-page-website',
		color: 'blue',
		title: __('Landing Pages', 'vulopilot'),
		desc: __('Create high-converting landing pages.', 'vulopilot'),
	},
	{
		id: 'product-descriptions',
		icon: 'cart',
		color: 'orange',
		title: __('Product Descriptions', 'vulopilot'),
		desc: __('Write persuasive product descriptions that sell.', 'vulopilot'),
	},
	{
		id: 'faq-generator',
		icon: 'question',
		color: 'red',
		title: __('FAQ Generator', 'vulopilot'),
		desc: __('Generate FAQs that answer customer questions.', 'vulopilot'),
	},
	{
		id: 'schema-generator',
		icon: 'shortcode',
		color: 'indigo',
		title: __('Schema Generator', 'vulopilot'),
		desc: __('Create structured data schema markup.', 'vulopilot'),
	},
	{
		id: 'image-alt-text',
		icon: 'image',
		color: 'green',
		title: __('Image Alt Text', 'vulopilot'),
		desc: __('Generate SEO-friendly alt text for images.', 'vulopilot'),
	},
	{
		id: 'meta-generator',
		icon: 'price',
		color: 'orange',
		title: __('Meta Generator', 'vulopilot'),
		desc: __('Create meta titles and descriptions that rank.', 'vulopilot'),
	},
	{
		id: 'content-optimizer',
		icon: 'bar-chart',
		color: 'teal',
		title: __('Content Optimizer', 'vulopilot'),
		desc: __('Optimize content for SEO and readability.', 'vulopilot'),
	},
	{
		id: 'content-refresh',
		icon: 'refresh',
		color: 'blue',
		title: __('Content Refresh', 'vulopilot'),
		desc: __('Update and improve existing content with AI.', 'vulopilot'),
	},
	{
		id: 'duplicate-content',
		icon: 'copy',
		color: 'pink',
		title: __('Duplicate Content', 'vulopilot'),
		desc: __('Find and fix duplicate content issues.', 'vulopilot'),
	},
	{
		id: 'media-library-ai',
		icon: 'media-library',
		color: 'purple',
		title: __('Media Library AI', 'vulopilot'),
		desc: __('Organize, tag and optimize your media library.', 'vulopilot'),
	},
];

export const notifyNotConnected = (tool: ContentTool) => {
	NoticeManager.add({
		uniqueKey: `content-tool-${tool.id}`,
		type: 'info',
		position: 'float',
		message: __(
			'Not connected yet — AI action triggering isn\'t wired up in this build.',
			'vulopilot'
		),
	});
};

const ContentToolsGrid = () => {
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
					action: () => notifyNotConnected(tool),
				}))}
			/>
		</CardComponent>
	);
};

export default ContentToolsGrid;
