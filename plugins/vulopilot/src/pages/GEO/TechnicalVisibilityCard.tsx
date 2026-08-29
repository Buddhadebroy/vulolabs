import { __ } from '@wordpress/i18n';
import { CardComponent, ListComponent, BadgeComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useSectionStatus } from '../../services/useSectionStatus';

/**
 * "Technical Visibility" — real open-findings badges via
 * `useSectionStatus()` (already built for AeoTab.tsx's own section cards)
 * for the same 4 checks the mockup names: robots.txt, sitemap, redirects,
 * internal links. A real "No open findings"/"N Open" status, not a
 * fabricated health percentage — none of these scanners produce a 0-100
 * score, only findings. "Optimize" navigates to the SEO tab where all of
 * these scanners' full findings tables live.
 */
const TechnicalVisibilityCard = () => {
	const robots = useSectionStatus('seo', [
		'robots-txt',
		'ai-crawler-blocked-pages',
	]);
	const sitemap = useSectionStatus('seo', ['sitemap', 'sitemap-validation']);
	const redirects = useSectionStatus('redirects', ['redirect-analysis']);
	const internalLinks = useSectionStatus('seo', [
		'internal-linking',
		'orphan-pages',
	]);

	const rows = [
		{ label: __('Robots.txt', 'vulopilot'), status: robots },
		{ label: __('Sitemap', 'vulopilot'), status: sitemap },
		{ label: __('Redirects', 'vulopilot'), status: redirects },
		{ label: __('Internal Links', 'vulopilot'), status: internalLinks },
	];

	return (
		<CardComponent
			title={__('Technical Visibility', 'vulopilot')}
			titleIcon="coding"
			desc={__('Open findings for robots.txt, sitemap, redirects, and internal links.', 'vulopilot')}
		>
			<ListComponent
				className="mini-card report"
				items={rows.map((row) => ({
					id: row.label,
					title: row.label,
					tags: row.status.badge && (
						<BadgeComponent
							color={row.status.badge.color}
							text={row.status.badge.text}
						/>
					),
				}))}
			/>
			<ButtonInput
				buttons={{
					text: __('Optimize', 'vulopilot'),
					icon: 'arrow-right',
					onClick: () => {
						window.location.href =
							'?page=vulopilot#&tab=seo-visibility&subtab=seo';
					},
				}}
			/>
		</CardComponent>
	);
};

export default TechnicalVisibilityCard;
