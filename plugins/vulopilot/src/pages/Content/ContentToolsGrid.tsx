/* global vulopilotAppLocalizer */
import { useState } from 'react';
import type { ComponentType } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import ContentToolPopup from './ContentToolPopup';
import ProSample from '../../components/ProSample/ProSample';
import ShowProPopup, { VuloCloudInlineNotice } from '../../components/Popup/Popup';
import { IconTile, SectionHead } from '../../components/ui';
import type { Tone } from '../../components/ui';
import { useFilterSlot, useIsRouteRegistered } from '../../services/useFilterSlot';
import { useAiCredits } from '../../services/useAiCredits';
import { useContentToolsEnabled } from '../../services/useContentToolsEnabled';

export type ToolFieldType = 'post-picker' | 'text' | 'textarea' | 'media-picker' | 'duplicate-finding-picker' | 'select';

export interface ToolField {
	key: string;
	label: string;
	type: ToolFieldType;
	/** Only for 'post-picker' - restricts which real post types are offered. */
	postTypes?: ('post' | 'page')[];
	/** Only for 'select' - a fixed option list. */
	options?: { value: string; label: string }[];
}

export interface ContentTool {
	id: string;
	icon: string;
	color: string;
	title: string;
	desc: string;
	/** The AI action this tool runs (classes/AIActions/Actions/*.php). */
	actionId: string;
	fields: ToolField[];
	pro?: boolean;
}

/** What VuloPilot Pro's Content Optimization module adds (`vulopilot_content_tools_pro`): its tools and their form. */
export interface ProToolsSlot {
	Popup: ComponentType<{
		tool: ContentTool | null;
		onClose: () => void;
		VuloCloudInlineNotice: ComponentType;
		creditsStatus: { connected?: boolean } | null;
	}>;
	tools: ContentTool[];
}

/** Free's own tools - each runs a real AI action end to end through ContentToolPopup. */
const FREE_TOOLS: ContentTool[] = [
	{
		id: 'ai-writer',
		icon: 'edit',
		color: 'purple',
		title: __('AI Writer', 'vulopilot'),
		desc: __('Write a draft from a short brief.', 'vulopilot'),
		actionId: 'write-post-content',
		fields: [{ key: 'brief', label: __('What should it write about?', 'vulopilot'), type: 'textarea' }],
	},
	{
		id: 'blog-generator',
		icon: 'document',
		color: 'green',
		title: __('Blog Generator', 'vulopilot'),
		desc: __('A full, SEO-ready blog post from a topic.', 'vulopilot'),
		actionId: 'generate-blog',
		fields: [{ key: 'topic', label: __('Topic', 'vulopilot'), type: 'text' }],
	},
	{
		id: 'content-audit',
		icon: 'search',
		color: 'blue',
		title: __('Content Audit', 'vulopilot'),
		desc: __('What to improve on one post or page.', 'vulopilot'),
		actionId: 'audit-content',
		fields: [{ key: 'post_id', label: __('Post or page', 'vulopilot'), type: 'post-picker' }],
	},
	{
		id: 'duplicate-content',
		icon: 'copy',
		color: 'pink',
		title: __('Duplicate Titles', 'vulopilot'),
		desc: __('Make pages that share a title distinct.', 'vulopilot'),
		actionId: 'differentiate-duplicate-title',
		fields: [{ key: 'post_ids', label: __('Duplicate title group', 'vulopilot'), type: 'duplicate-finding-picker' }],
	},
];

/** Pictures of Pro's tools for free's sample - names and icons only, nothing runs. */
const SAMPLE_PRO_TOOLS: { icon: string; tone: Tone; title: string; desc: string }[] = [
	{ icon: 'web-page-website', tone: 'blue', title: __('Landing Pages', 'vulopilot'), desc: __('Pages that convert', 'vulopilot') },
	{ icon: 'cart', tone: 'amber', title: __('Product Descriptions', 'vulopilot'), desc: __('Copy that sells', 'vulopilot') },
	{ icon: 'question', tone: 'red', title: __('FAQ Generator', 'vulopilot'), desc: __('Answers buyers look for', 'vulopilot') },
	{ icon: 'shortcode', tone: 'violet', title: __('Schema Generator', 'vulopilot'), desc: __('Rich results markup', 'vulopilot') },
	{ icon: 'image', tone: 'green', title: __('Image Alt Text', 'vulopilot'), desc: __('Every image described', 'vulopilot') },
	{ icon: 'price', tone: 'amber', title: __('Meta Generator', 'vulopilot'), desc: __('Titles that get clicks', 'vulopilot') },
	{ icon: 'bar-chart', tone: 'green', title: __('Content Optimizer', 'vulopilot'), desc: __('Better SEO and reading', 'vulopilot') },
	{ icon: 'refresh', tone: 'blue', title: __('Content Refresh', 'vulopilot'), desc: __('Old posts made current', 'vulopilot') },
	{ icon: 'search', tone: 'violet', title: __('Keyword Research', 'vulopilot'), desc: __('Topics worth writing', 'vulopilot') },
	{ icon: 'calendar', tone: 'blue', title: __('Content Planner', 'vulopilot'), desc: __('Plan and schedule', 'vulopilot') },
];

const TONE: Record<string, Tone> = {
	purple: 'violet',
	indigo: 'violet',
	pink: 'violet',
	green: 'green',
	teal: 'green',
	blue: 'blue',
	orange: 'amber',
	yellow: 'amber',
	red: 'red',
};

/** A tool: a button, or a plain tile inside a sample. */
const ToolTile = ({ icon, tone, title, desc, onClick }: { icon: string; tone: Tone; title: string; desc: string; onClick?: () => void }) => {
	const inner = (
		<>
			<IconTile icon={icon} tone={tone} />
			<span className="vp-wtool-text">
				<strong>{title}</strong>
				<span>{desc}</span>
			</span>
			<i className="adminfont-arrow-right vp-wtool-go" aria-hidden="true" />
		</>
	);

	return onClick ? (
		<button type="button" className="vp-wtool" onClick={onClick}>
			{inner}
		</button>
	) : (
		<div className="vp-wtool">{inner}</div>
	);
};

/**
 * "Write and improve": free's four AI tools, then Pro's. With VuloPilot Pro's Content Optimization module, its tools
 * (and the Content planner page) join the grid; without Pro, a sample of them opens the Pro popup. Free carries no
 * code for Pro's tools.
 */
const ContentToolsGrid = () => {
	const [activeTool, setActiveTool] = useState<ContentTool | null>(null);
	const [isConnectOpen, setIsConnectOpen] = useState(false);
	const [isModuleOffOpen, setIsModuleOffOpen] = useState(false);
	const proSlot = useFilterSlot<ProToolsSlot>('vulopilot_content_tools_pro');
	const hasPlanner = useIsRouteRegistered('content-planner');
	const isModuleOn = useContentToolsEnabled();
	const { status: creditsStatus } = useAiCredits();
	const proTools = isModuleOn && proSlot ? proSlot.tools : [];

	const open = (tool: ContentTool) => {
		if (creditsStatus && !creditsStatus.connected) {
			setIsConnectOpen(true);
			return;
		}

		setActiveTool(tool);
	};

	let proPart;

	if (proTools.length > 0) {
		proPart = (
			<div className="vp-wtools">
				{proTools.map((tool) => (
					<ToolTile
						key={tool.id}
						icon={tool.icon}
						tone={TONE[tool.color] ?? 'neutral'}
						title={tool.title}
						desc={tool.desc}
						onClick={() => open(tool)}
					/>
				))}
				{hasPlanner && (
					<ToolTile
						icon="calendar"
						tone="blue"
						title={__('Content Planner', 'vulopilot')}
						desc={__('Plan and schedule what to publish.', 'vulopilot')}
						onClick={() => {
							window.location.hash = '#&tab=content-planner';
						}}
					/>
				)}
			</div>
		);
	} else if (vulopilotAppLocalizer.khali_dabba) {
		// Licensed, but the module that holds these tools is off.
		proPart = (
			<div className="vp-card vp-wtools-off">
				<IconTile icon="module" tone="violet" />
				<span>
					<strong>{__('More writing tools are ready to turn on', 'vulopilot')}</strong>
					{sprintf(
						/* translators: %d: number of tools. */
						__('Content Optimization adds %d tools, from landing pages to keyword research.', 'vulopilot'),
						SAMPLE_PRO_TOOLS.length
					)}
				</span>
				<ButtonInput
					buttons={{ text: __('Turn on', 'vulopilot'), color: 'purple-bg', onClick: () => setIsModuleOffOpen(true) }}
				/>
			</div>
		);
	} else {
		proPart = (
			<ProSample
				feature={{
					title: __('Pro writing tools', 'vulopilot'),
					description: __(
						'Landing pages, product descriptions, FAQs, schema, alt text, keyword research and a content planner.',
						'vulopilot'
					),
					icon: 'edit',
				}}
				text={__('Ten more AI tools, from landing pages to a content planner.', 'vulopilot')}
				cta={__('Unlock all tools', 'vulopilot')}
			>
				<div className="vp-wtools">
					{SAMPLE_PRO_TOOLS.map((tool) => (
						<ToolTile key={tool.title} {...tool} />
					))}
				</div>
			</ProSample>
		);
	}

	return (
		<section className="vp-content-tools" id="content-tools-grid" aria-label={__('Content tools', 'vulopilot')}>
			<SectionHead title={__('Write and improve', 'vulopilot')} />
			<div className="vp-wtools">
				{FREE_TOOLS.map((tool) => (
					<ToolTile
						key={tool.id}
						icon={tool.icon}
						tone={TONE[tool.color] ?? 'neutral'}
						title={tool.title}
						desc={tool.desc}
						onClick={() => open(tool)}
					/>
				))}
			</div>
			{proPart}

			{activeTool?.pro && proSlot ? (
				<proSlot.Popup
					tool={activeTool}
					onClose={() => setActiveTool(null)}
					VuloCloudInlineNotice={VuloCloudInlineNotice}
					creditsStatus={creditsStatus}
				/>
			) : (
				<ContentToolPopup tool={activeTool} onClose={() => setActiveTool(null)} />
			)}

			<PopupComponent open={isConnectOpen} onClose={() => setIsConnectOpen(false)} width={22} height="auto" position="lightbox">
				<ShowProPopup vulocloud />
			</PopupComponent>
			<PopupComponent open={isModuleOffOpen} onClose={() => setIsModuleOffOpen(false)} width={31.25} height="auto" position="lightbox">
				<ShowProPopup moduleName="content-optimization" />
			</PopupComponent>
		</section>
	);
};

export default ContentToolsGrid;
