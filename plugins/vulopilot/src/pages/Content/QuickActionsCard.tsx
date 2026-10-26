/* global vulopilotAppLocalizer */
import { useState, type ComponentType } from 'react';
import { __ } from '@wordpress/i18n';
import { CardComponent, ListComponent, PopupComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import ContentToolPopup from './ContentToolPopup';
import { ContentTool } from './ContentToolsGrid';
import { useFilterSlot } from '../../services/useFilterSlot';
import ShowProPopup, { VuloCloudInlineNotice } from '../../components/Popup/Popup';
import { useAiCredits } from '../../services/useAiCredits';
import { useContentToolsEnabled } from '../../services/useContentToolsEnabled';

/**
 * "Quick Actions" card: standalone AI actions using the same propose, preview and approve flow as
 * ContentToolsGrid.tsx. The 2 Pro tiles are display-metadata-only shells here (title/desc/fields,
 * for when Pro's JS hasn't loaded anything to show yet) - same `vulopilot_content_tools_pro`
 * filter ContentToolsGrid.tsx resolves supplies the real field definitions + runner Popup
 * (`/content-tools/runs`, not Free's own `/ai-action-runs`) once Pro provides them.
 */
const QUICK_ACTION_TOOLS: ContentTool[] = [
	{
		id: 'content-audit',
		icon: 'lock',
		color: 'purple',
		title: __('AI Content Audit', 'vulopilot'),
		desc: __('Scan and audit all your content', 'vulopilot'),
		actionId: 'audit-content',
		fields: [
			{
				key: 'post_id',
				label: __('Post or page', 'vulopilot'),
				type: 'post-picker',
			},
		],
	},
	{
		id: 'keyword-research',
		icon: 'search',
		color: 'blue',
		title: __('Keyword Research', 'vulopilot'),
		desc: __('Discover content opportunities', 'vulopilot'),
		actionId: 'keyword-research',
		pro: true,
		fields: [],
	},
	{
		id: 'content-templates',
		icon: 'document',
		color: 'orange',
		title: __('Content Templates', 'vulopilot'),
		desc: __('Use proven content templates', 'vulopilot'),
		actionId: 'generate-from-template',
		pro: true,
		fields: [],
	},
];

interface ProToolsSlot {
	Popup: ComponentType<{
		tool: ContentTool | null;
		onClose: () => void;
		VuloCloudInlineNotice: ComponentType;
		creditsStatus: { connected?: boolean } | null;
	}>;
	tools: ContentTool[];
}

const QuickActionsCard = () => {
	const [activeTool, setActiveTool] = useState<ContentTool | null>(null);
	const proSlot = useFilterSlot<ProToolsSlot>('vulopilot_content_tools_pro');
	const { status: creditsStatus } = useAiCredits();
	const isContentToolsEnabled = useContentToolsEnabled();
	const [isCloudConnectPromptOpen, setIsCloudConnectPromptOpen] = useState(false);
	const [isProLocked, setIsProLocked] = useState(false);
	const dismissProLocked = () => setIsProLocked(false);

	const scrollTo = (id: string) => {
		document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	};

	// Content Planner is vulopilot-pro's own page (modules/ContentOptimization/src/ContentPlanner.tsx,
	// WP menu slug `content-planner`) - this button navigates there directly rather than opening a
	// second, competing create UI over the same `/content-planner` REST store.
	const openPlanner = () => {
		if (vulopilotAppLocalizer.khali_dabba) {
			window.location.href = '?page=vulopilot#&tab=content-planner';
			return;
		}

		setIsProLocked(true);
	};

	const handleToolClick = (tool: ContentTool) => {
		if (tool.pro && (!isContentToolsEnabled || !proSlot)) {
			setIsProLocked(true);
			return;
		}

		if (!tool.pro && creditsStatus && !creditsStatus.connected) {
			setIsCloudConnectPromptOpen(true);
			return;
		}

		setActiveTool(tool.pro ? (proSlot?.tools.find((t) => t.id === tool.id) ?? tool) : tool);
	};

	const proBadge = (tool: ContentTool) =>
		tool.pro && (!isContentToolsEnabled || !proSlot) ? (
			<span className="admin-tag pro-tag pro-tag-inline">
				<i className="adminfont-pro-tag" />
				{__('Pro', 'vulopilot')}
			</span>
		) : (
			<i className="adminfont-arrow-right" />
		);

	return (
		<CardComponent
			id="content-quick-actions-card"
			title={__('Quick Actions', 'vulopilot')}
			titleIcon="ai"
			desc={__('Jump straight to your most common content tasks.', 'vulopilot')}
		>
			<ListComponent
				className="mini-card report without-border "
				border
				items={[
					...QUICK_ACTION_TOOLS.map((tool) => ({
						id: tool.id,
						icon: tool.icon,
						className: `icon-${tool.color}`,
						title: tool.title,
						desc: tool.desc,
						tags: proBadge(tool),
						action: () => handleToolClick(tool),
					})),
					{
						id: 'content-planner',
						icon: 'calendar',
						className: 'icon-blue',
						title: __('Content Planner', 'vulopilot'),
						desc: __('Plan and schedule content', 'vulopilot'),
						tags: vulopilotAppLocalizer.khali_dabba ? (
							<i className="adminfont-arrow-right" />
						) : (
							<span className="admin-tag pro-tag pro-tag-inline">
								<i className="adminfont-pro-tag" />
								{__('Pro', 'vulopilot')}
							</span>
						),
						action: openPlanner,
					},
				]}
			/>
			<ButtonInput
				wrapperClass="quick-actions-view-all"
				buttons={{
					text: __('View all tools', 'vulopilot'),
					rightIcon: 'arrow-right',
					color: 'border-purple',
					onClick: () => scrollTo('content-tools-grid'),
				}}
			/>
			{activeTool?.pro && proSlot ? (
				<proSlot.Popup
					tool={activeTool}
					onClose={() => setActiveTool(null)}
					VuloCloudInlineNotice={VuloCloudInlineNotice}
					creditsStatus={creditsStatus}
				/>
			) : (
				<ContentToolPopup
					tool={activeTool?.pro ? null : activeTool}
					onClose={() => setActiveTool(null)}
				/>
			)}
			<PopupComponent
				open={isCloudConnectPromptOpen}
				onClose={() => setIsCloudConnectPromptOpen(false)}
				width={22}
				height="auto"
				position="lightbox"
			>
				<ShowProPopup vulocloud />
			</PopupComponent>
			<PopupComponent
				open={isProLocked}
				onClose={dismissProLocked}
				width={31.25}
				height="auto"
				position="lightbox"
			>
				{vulopilotAppLocalizer.khali_dabba ? (
					<ShowProPopup moduleName="content-optimization" />
				) : (
					<ShowProPopup />
				)}
			</PopupComponent>
		</CardComponent>
	);
};

export default QuickActionsCard;
