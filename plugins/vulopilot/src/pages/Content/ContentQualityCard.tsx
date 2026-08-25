/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import {
	CardComponent,
	BadgeComponent,
	ModuleGuardComponent,
	ChartComponent,
	TypographyComponent,
	IconComponent,
	AnalyticsComponent,
	NoticeComponent,
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

// Same hex values NeedsAttentionCard.tsx's own ring uses for this exact tone split.
const TONE_COLOR: Record<ScoreTone, string> = {
	green: '#16a34a',
	orange: '#d97706',
	red: '#dc2626',
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
	pass: 'success',
	warning: 'warning',
	fail: 'error',
};

/** Short status pill — Good/Medium/High — alongside the real message NoticeComponent renders. */
const STATUS_BADGE: Record<OnPageCheck['status'], { color: string; label: string }> = {
	pass: { color: 'green', label: __('Good', 'vulopilot') },
	warning: { color: 'orange', label: __('Medium', 'vulopilot') },
	fail: { color: 'red', label: __('High', 'vulopilot') },
};

/**
 * One real on-page check — zyra's own `NoticeComponent` (`displayPosition="inline-notice"`)
 * renders the icon + real `message`, tinted by status; a status badge and
 * (when clickable) NoticeComponent's own real `actionLabel`/`onAction`
 * affordance are added alongside it. Used both for the Content Assessment
 * list and (structure being the exact same `OnPageCheck` shape) the
 * Structure row below it, so the two never drift into two different
 * visual treatments for the same real data type.
 */
const CheckRow: React.FC<{ check: OnPageCheck; onClick?: () => void }> = ({
	check,
	onClick,
}) => (
	// `NoticeComponent`'s own `display-inline-notice`/`type-*` CSS already
	// supplies the row's real background tint, border, padding, and
	// radius — no wrapping box of this card's own needed on top of it.
	<NoticeComponent
		displayPosition="inline-notice"
		type={STATUS_NOTICE_TYPE[check.status]}
		message={check.message}
		actionLabel={onClick ? __('View', 'vulopilot') : undefined}
		onAction={onClick}
	>
		<BadgeComponent
			color={STATUS_BADGE[check.status].color}
			text={STATUS_BADGE[check.status].label}
			className="content-quality-check-badge"
		/>
	</NoticeComponent>
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
 */
const ContentQualityCard = () => {
	const [options, setOptions] = useState<ContentOption[]>([]);
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [isLoadingOptions, setIsLoadingOptions] = useState(true);
	const [data, setData] = useState<ContentQualityResponse | null>(null);
	const [isLoadingQuality, setIsLoadingQuality] = useState(false);

	useEffect(() => {
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
	}, []);

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

	return (
		<CardComponent
			title={__('Content Quality', 'vulopilot')}
			titleIcon="ai"
			isLoading={isLoadingOptions}
			action={
				!isLoadingOptions && options.length > 0 ? (
					<SelectInput
						name="content-quality-picker"
						type="single-select"
						value={selectedId ? String(selectedId) : ''}
						onChange={(value) => setSelectedId(Number(value))}
						options={options.map((option) => ({
							label: option.title,
							value: String(option.id),
						}))}
						isClearable={false}
					/>
				) : undefined
			}
		>
			{!isLoadingOptions && 0 === options.length && (
				<ModuleGuardComponent
					icon="doc"
					title={__('No content yet', 'vulopilot')}
					desc={__(
						'Publish a post or page to see its content quality here.',
						'vulopilot'
					)}
				/>
			)}

			{!isLoading && data && (
				<div className="content-quality-body">
					<div className="content-quality-overview">
						<div className="content-quality-overview-score">
							<ChartComponent
								type="ring"
								height={120}
								isLoading={false}
								color={TONE_COLOR[readabilityTone]}
								centerLabel={
									<span className="content-quality-overview-score-number">
										{data.readability.score}
										<small>/100</small>
									</span>
								}
								data={[{ value: data.readability.score }]}
							/>
							<TypographyComponent
								variant="body-sm"
								weight="semibold"
								color={readabilityTone}
								className="content-quality-overview-score-label"
							>
								{data.readability.label}
							</TypographyComponent>
						</div>
						<div className="content-quality-overview-text">
							<TypographyComponent variant="h5" weight="semibold">
								{__('Overall Content Quality', 'vulopilot')}
							</TypographyComponent>
							<TypographyComponent variant="desc">
								{QUALITY_BAND_DESCRIPTION[readabilityTone]}
							</TypographyComponent>
						</div>
						<BadgeComponent
							icon={TONE_BADGE_ICON[readabilityTone]}
							color={readabilityTone}
							text={data.readability.label}
							className="content-quality-overview-badge"
						/>
					</div>

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
								// `{tone}-color` is a real zyra utility class
								// (common.scss's own `$color-palette` loop) that
								// also tints this same tile's `.progress-bar`
								// automatically — no separate bar CSS needed.
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
					<div className="content-quality-checks">
						{data.completeness.checks.map((check) => (
							<CheckRow key={check.id} check={check} />
						))}
					</div>
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
