/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, BadgeComponent, ModuleGuardComponent } from '@zyra/components';
import { SelectInput } from '@zyra/inputs';

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

const STATUS_BADGE: Record<OnPageCheck['status'], { color: string; icon: string }> = {
	pass: { color: 'green', icon: 'check' },
	warning: { color: 'yellow', icon: 'warning' },
	fail: { color: 'red', icon: 'error' },
};

/**
 * Create Content's "Content Quality" card — real, per-piece-of-content
 * signals for whichever post the picker selects, per direct instruction:
 * replaces "Content Score" (ContentScoreCard.tsx, now deleted), a
 * site-wide number that recomputed the same weighted-severity formula
 * `GET /content-intelligence/score` (kept, still backs nothing on this
 * page now) already shares 5 of 6 scanner ids with — and therefore
 * numerically overlaps — Grow My Traffic's own SEO Score, inviting "why
 * is my Content Score 87 but SEO Score 67?" confusion. This card asks a
 * different question ("how good is THIS piece of content"), so there's
 * nothing here that could be compared against SEO Score at all — SEO
 * stays owned entirely by Grow My Traffic.
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

	return (
		<CardComponent
			title={__('Content Quality', 'vulopilot')}
			titleIcon="doc"
			isLoading={isLoadingOptions}
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
			{!isLoadingOptions && options.length > 0 && (
				<>
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

					{!isLoading && data && (
						<div className="content-quality-body">
							<div className="content-quality-row">
								<div className="content-quality-row-label">
									{__('Readability', 'vulopilot')}
								</div>
								<div className="content-quality-row-value">
									{sprintf(
										/* translators: 1: real Flesch Reading Ease score (0-100), 2: its band label (e.g. "Standard"). */
										__('%1$d/100 · %2$s', 'vulopilot'),
										data.readability.score,
										data.readability.label
									)}
								</div>
							</div>

							<div className="content-quality-row">
								<div className="content-quality-row-label">
									{__('Completeness', 'vulopilot')}
								</div>
								<div className="content-quality-row-value">
									{sprintf(
										/* translators: 1: number of real on-page checks passing, 2: total real checks. */
										__('%1$d/%2$d checks passed', 'vulopilot'),
										data.completeness.passed,
										data.completeness.total
									)}
								</div>
							</div>
							<ul className="content-quality-checks">
								{data.completeness.checks.map((check) => (
									<li key={check.id}>
										<BadgeComponent
											variant="dot"
											color={STATUS_BADGE[check.status].color}
											text={check.message}
										/>
									</li>
								))}
							</ul>

							{data.structure && (
								<div className="content-quality-row">
									<div className="content-quality-row-label">
										{__('Structure', 'vulopilot')}
									</div>
									<BadgeComponent
										color={STATUS_BADGE[data.structure.status].color}
										text={data.structure.message}
									/>
								</div>
							)}
						</div>
					)}
				</>
			)}
		</CardComponent>
	);
};

export default ContentQualityCard;
