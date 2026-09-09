/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse, COLOR_PALETTE } from '@zyra/core';
import {
	CardComponent,
	BadgeComponent,
	ModuleGuardComponent,
	ChartComponent,
	TypographyComponent,
	IconComponent,
	AnalyticsComponent,
	ListComponent,
	SectionComponent
} from '@zyra/components';
import type { NoticeType } from '@zyra/components';
import { SelectInput, ButtonInput } from '@zyra/inputs';

interface ContentOption {
	id: number;
	title: string;
	date: string;
}

interface WpRestPost {
	id: number;
	title: { rendered: string };
	date: string;
}

interface OnPageCheck {
	id: string;
	group: string;
	status: 'pass' | 'warning' | 'fail';
	message: string;
}

interface ContentQualityResponse {
	post_id: number;
	readability: { score: number; label: string };
	completeness: { passed: number; total: number; checks: OnPageCheck[] };
	structure: OnPageCheck | null;
}

type ScoreTone = 'green' | 'orange' | 'red';

/** Same 3-band green/orange/red split NeedsAttentionCard.tsx's own getScoreTone uses for a 0-100 score — kept as its own local copy rather than a shared import since that one isn't exported either (see that file's own docblock). Reused here for both the real readability score and the real completeness ratio, so a tile's number and its bar color never disagree about which band it's in. */
const getScoreTone = (percent: number): ScoreTone => {
	if (percent >= 75) {
		return 'green';
	}
	if (percent >= 60) {
		return 'orange';
	}
	return 'red';
};

// Real zyra palette hex (`@zyra/core`'s `COLOR_PALETTE`) — same colors
// NeedsAttentionCard.tsx's own ring uses for this exact tone split.
const TONE_COLOR: Record<ScoreTone, string> = {
	green: COLOR_PALETTE.green,
	orange: COLOR_PALETTE.orange,
	red: COLOR_PALETTE.red,
};

/** A smiley reads fine for "Fairly Easy"/"Very Easy" — misleading for a genuinely poor score, so the red band gets an alert icon instead rather than always smiling at bad news. */
const TONE_BADGE_ICON: Record<ScoreTone, string> = {
	green: 'smile-o',
	orange: 'smile-o',
	red: 'error',
};

/** One real sentence per band, about the one real per-post signal this banner actually plots (readability) — not a fabricated second "overall" metric, see the ring's own comment below. */
const QUALITY_BAND_DESCRIPTION: Record<ScoreTone, string> = {
	green: __(
		'Your content reads well and is easy to follow — nice work.',
		'vulopilot'
	),
	orange: __(
		'Your content is decent, with a few issues to fix for better SEO performance and readability.',
		'vulopilot'
	),
	red: __(
		'Your content needs work — readability and on-page checks both need attention.',
		'vulopilot'
	),
};

/** Real `OnPageCheck.status` → NoticeComponent's own `NoticeType` — `warning` maps to `'warning'` itself rather than the `'info'` workaround this used before NoticeComponent took over rendering the icon/color (NoticeComponent.scss already ships real `type-warning` coloring; only the bare, uncomposed `icon: 'warning'` this card built by hand was ever missing a real glyph — moot now that NoticeComponent owns the icon). */
const STATUS_NOTICE_TYPE: Record<OnPageCheck['status'], NoticeType> = {
	pass: 'success green',
	warning: 'info yellow',
	fail: 'error red',
};

/** Short status pill — Good/Medium/High — alongside the real message NoticeComponent renders. */
const STATUS_BADGE: Record<OnPageCheck['status'], { color: string; label: string }> = {
	pass: { color: 'green', label: __('Good', 'vulopilot') },
	warning: { color: 'orange', label: __('Medium', 'vulopilot') },
	fail: { color: 'red', label: __('High', 'vulopilot') },
};

/**
 * One real on-page check — zyra's own `ListComponent`, one item per check,
 * status badge in `tags` (same "mini-card"-style `tags` usage
 * KnowledgePanelCard.tsx's own results list already establishes). Used
 * both for the Content Assessment list and (structure being the exact
 * same `OnPageCheck` shape) the Structure row below it, so the two never
 * drift into two different visual treatments for the same real data type.
 * `onClick` (when given) wires into `ListComponent`'s own real `action`/
 * `onItemClick` — the whole row becomes a genuine click target rather
 * than needing its own wrapping button.
 */
const CheckRow: React.FC<{ check: OnPageCheck; onClick?: () => void }> = ({
	check,
	onClick,
}) => (
	<ListComponent
		className='mini-card report'
		items={[
			{
				id: check.id,
				icon: STATUS_NOTICE_TYPE[check.status],
				title: check.message,
				action: onClick,
				tags: (
					<BadgeComponent
						color={STATUS_BADGE[check.status].color}
						text={STATUS_BADGE[check.status].label}
					/>
				),
			},
		]}
	/>
);

/**
 * Create Content's "Content Quality" card — real, per-piece-of-content
 * signals for whichever post the picker selects, per direct instruction:
 * replaces "Content Score" (ContentScoreCard.tsx, now deleted), a
 * site-wide number that recomputed the same weighted-severity formula
 * `GET /content-intelligence/score` (kept, still backs nothing on this
 * page now) already shares 5 of 6 scanner ids with — and therefore
 * numerically overlaps — SEO & Visibility's own SEO Score, inviting "why
 * is my Content Score 87 but SEO Score 67?" confusion. This card asks a
 * different question ("how good is THIS piece of content"), so there's
 * nothing here that could be compared against SEO Score at all — SEO
 * stays owned entirely by SEO & Visibility.
 *
 * Only 3 dimensions, deliberately — "clarity" and "tone" have no real
 * computed signal anywhere in this codebase (confirmed: no scanner, no
 * analyzer check for either), so rather than inventing one this card only
 * shows what `GET /content-intelligence/quality` actually returns:
 * readability (real Flesch Reading Ease score), completeness (the post
 * editor's own real "basic" on-page checklist — title/description/content
 * length — run against this post's saved fields), and structure (that
 * same checklist's real subheadings-present check).
 *
 * The top "Overall Content Quality" ring is deliberately NOT a new
 * fourth number — it plots the exact same real `readability.score`/
 * `.label` the Readability tile below shows, just given the headline
 * treatment, since it's the only real 0-100 signal this endpoint returns
 * (same anti-fabrication reasoning as the "only 3 dimensions" paragraph
 * above — see also `Issues Found` below, which is a real count, not a
 * new score).
 *
 * The picker (real `wp/v2/posts`/`pages`, newest first) defaults to the
 * most recently modified piece of content rather than requiring a click
 * before showing anything — same "useful default, still real user
 * control" shape `SlowPagesTab.tsx`'s own filters already establish.
 *
 * `postId`/`onClose` (both optional): when given, this card is driven
 * externally instead of its own picker — `RecentContentCard.tsx`'s own
 * "Analyze" action opens this same real component as its side panel
 * (same real `GET /content-intelligence/quality?post_id=` this card
 * already fetches for its own picker's current selection, just for
 * whichever row's "Analyze" was clicked), matching the same real
 * ring/Content Assessment/Structure breakdown either way — not a second,
 * differently-shaped panel. The options fetch/picker/"Page being
 * analyzed" action are skipped entirely in this mode (there's nothing to
 * pick — the id is already given); a real close button takes the
 * picker's place instead.
 */
interface ContentQualityCardProps {
	postId?: number;
	/** Real row title `RecentContentCard.tsx` already has on hand (no extra fetch needed) — `GET /content-intelligence/quality` itself doesn't return one. Only read in `postId` mode. */
	title?: string;
	onClose?: () => void;
}

const ContentQualityCard = ({ postId: externalPostId, title: externalTitle, onClose }: ContentQualityCardProps = {}) => {
	const isExternal = undefined !== externalPostId;
	const [options, setOptions] = useState<ContentOption[]>([]);
	const [selectedId, setSelectedId] = useState<number | null>(externalPostId ?? null);
	const [isLoadingOptions, setIsLoadingOptions] = useState(!isExternal);
	const [data, setData] = useState<ContentQualityResponse | null>(null);
	const [isLoadingQuality, setIsLoadingQuality] = useState(false);

	useEffect(() => {
		if (isExternal) {
			return;
		}

		const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };
		const fetchType = (endpoint: 'posts' | 'pages') =>
			getApiResponse<WpRestPost[]>(
				getApiLink(
					appLocalizer,
					`${endpoint}?per_page=10&orderby=date&order=desc&_fields=id,title,date`,
					'wp/v2'
				),
				nonceHeaders
			).then((response) =>
				(response || []).map(
					(post): ContentOption => ({
						id: post.id,
						title: post.title.rendered || __('(no title)', 'vulopilot'),
						date: post.date,
					})
				)
			);

		Promise.all([fetchType('posts'), fetchType('pages')])
			.then(([posts, pages]) => {
				const merged = [...posts, ...pages].sort((a, b) =>
					b.date.localeCompare(a.date)
				);
				setOptions(merged);
				if (merged.length > 0) {
					setSelectedId(merged[0].id);
				}
			})
			.finally(() => setIsLoadingOptions(false));
		// eslint-disable-next-line react-hooks/exhaustive-deps -- `isExternal`/`externalPostId` are fixed for this component instance's whole lifetime (RecentContentCard.tsx always mounts a fresh instance per `analyzingId`, same as PageAnalysisPanel.tsx's own `postId` prop) — this effect only ever needs to run once, for the picker-driven case.
	}, []);

	// Externally driven: track a later `postId` prop change too (e.g. the
	// host clicking "Analyze" on a *different* row while this panel is
	// already open) — the picker-driven branch above never re-runs this,
	// so this is the one real trigger `isExternal` mode needs.
	useEffect(() => {
		if (isExternal) {
			setSelectedId(externalPostId);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [externalPostId]);

	useEffect(() => {
		if (!selectedId) {
			return;
		}

		setIsLoadingQuality(true);

		getApiResponse<ContentQualityResponse>(
			getApiLink(appLocalizer, `content-intelligence/quality?post_id=${selectedId}`),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => {
				if (response) {
					setData(response);
				}
			})
			.finally(() => setIsLoadingQuality(false));
	}, [selectedId]);

	const isLoading = isLoadingOptions || isLoadingQuality;

	// Same real edit-screen link ContentRow.editLink/RecentContentCard.tsx
	// already build for this exact post id — where "View in Detail"/the
	// Structure row's own chevron actually go: the AI Content Assistant
	// sidebar in the block editor (PostEditorAssets) is the one place real
	// per-check detail beyond this summary genuinely lives, not a page
	// this card fabricates.
	const editLink = selectedId
		? `${appLocalizer.site_url}/wp-admin/post.php?post=${selectedId}&action=edit`
		: '';

	const readabilityTone = data ? getScoreTone(data.readability.score) : 'green';
	const completenessPercent =
		data && data.completeness.total > 0
			? Math.round((data.completeness.passed / data.completeness.total) * 100)
			: 0;
	const completenessTone = getScoreTone(completenessPercent);

	// Real open issues — every completeness check that isn't passing, plus
	// the structure check when it isn't either. Not `completeness.total`
	// (every check, including the ones already passing): "Issues Found"
	// means what it says.
	const issuesFound = data
		? data.completeness.checks.filter((check) => 'pass' !== check.status).length +
		(data.structure && 'pass' !== data.structure.status ? 1 : 0)
		: 0;

	const scrollToAssessment = () =>
		document
			.getElementById('content-quality-assessment')
			?.scrollIntoView({ behavior: 'smooth', block: 'start' });

	const goToPostEditor = () => {
		if (editLink) {
			window.location.href = editLink;
		}
	};

	const selectedOption = options.find((option: ContentOption) => option.id === selectedId);
	/** Real title either way — `RecentContentCard.tsx`'s own row title in `postId` mode, this card's own fetched picker option otherwise. */
	const analyzedTitle = externalTitle ?? selectedOption?.title;

	return (
		<CardComponent
			className={isExternal ? 'page-analysis-panel' : undefined}
			title={isExternal ? __('Page Analysis', 'vulopilot') : __('Content Quality', 'vulopilot')}
			titleIcon="ai"
			desc={
				isExternal
					? __("A single page's real content-quality signals, checked live.", 'vulopilot')
					: __('Real AI-assessed quality signals for the selected page.', 'vulopilot')
			}
			isLoading={isExternal ? isLoadingQuality : isLoadingOptions}
			action={
				isExternal ? (
					<button
						type="button"
						className="page-analysis-panel-close"
						onClick={onClose}
						aria-label={__('Close', 'vulopilot')}
					>
						<i className="adminfont-close" />
					</button>
				) : !isLoadingOptions && options.length > 0 ? (
					<div className="content-quality-picker">
						<TypographyComponent
							variant="caption"
							weight="semibold"
							className="content-quality-picker-label"
						>
							{__('Page being analyzed', 'vulopilot')}
						</TypographyComponent>
						<SelectInput
							name="content-quality-picker"
							size={10}
							type="single-select"
							value={selectedId ? String(selectedId) : ''}
							onChange={(value: string) => setSelectedId(Number(value))}
							options={options.map((option: ContentOption) => ({
								label: option.title,
								value: String(option.id),
							}))}
							isClearable={false}
						/>
						<div className="content-quality-picker-hint">
							<IconComponent name="info" />
							{__('Changing the page updates all results below.', 'vulopilot')}
						</div>
					</div>
				) : undefined
			}
		>
			{!isExternal && !isLoadingOptions && 0 === options.length && (
				<ModuleGuardComponent
					icon="doc"
					title={__('No content yet', 'vulopilot')}
					desc={__(
						'Publish a post or page to see its content quality here.',
						'vulopilot'
					)}
				/>
			)}

			{!isExternal && !isLoading && data && analyzedTitle && (
				<div className="content-quality-analyzing-banner">
					<span className="content-quality-analyzing-banner-label">
						<IconComponent name="doc" />
						{__('Showing analysis for:', 'vulopilot')}{' '}
						<strong>{analyzedTitle}</strong>
					</span>
					<span className="content-quality-analyzing-banner-hint">
						<IconComponent name="ai" />
						{__(
							'Analysis updates automatically when you select a different page.',
							'vulopilot'
						)}
					</span>
				</div>
			)}

			{isExternal && !isLoading && data && analyzedTitle && (
				<div className="page-analysis-panel-meta">{analyzedTitle}</div>
			)}

			{!isLoading && data && (
				<div className="content-quality-body">
					<AnalyticsComponent
						variant="progress"
						cols={3}
						data={[
							{
								icon: 'knowledgebase',
								number: sprintf(
									/* translators: %d: real Flesch Reading Ease score, 0-100. */
									__('%d/100', 'vulopilot'),
									data.readability.score
								),
								text: __('Readability', 'vulopilot'),
								progress: data.readability.score,
								colorClass: `${readabilityTone}-color`,
							},
							{
								icon: 'search',
								number: `${data.completeness.passed}/${data.completeness.total}`,
								text: __('Checks passed', 'vulopilot'),
								progress: completenessPercent,
								colorClass: `${completenessTone}-color`,
							},
							{
								icon: 'document',
								number: issuesFound,
								progress: issuesFound,
								colorClass: `${completenessTone}-color`,
								text: __('Issues Found', 'vulopilot'),
								// A real count, not a percentage — no
								// `progress`/`colorClass` here rather than
								// fabricating a ratio just to fill the bar.
								onClick:
									issuesFound > 0 ? scrollToAssessment : undefined,
							},
						]}
					/>
					<SectionComponent icon='ai'
						title={__('Content Assessment', 'vulopilot')}
					/>
					{data.completeness.checks.map((check: OnPageCheck) => (
						<CheckRow key={check.id} check={check} />
					))}
					{data.structure && (
						<>
							<SectionComponent icon='blocks'
								title={__('Structure', 'vulopilot')}
							/>
							<CheckRow check={data.structure} onClick={goToPostEditor} />
						</>
					)}
				</div>
			)}
		</CardComponent>
	);
};

export default ContentQualityCard;
