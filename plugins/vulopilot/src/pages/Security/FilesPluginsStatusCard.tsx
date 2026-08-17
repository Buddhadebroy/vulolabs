import { __ } from '@wordpress/i18n';
import { CardComponent, ListComponent, BadgeComponent } from '@zyra/components';
import { useSectionStatus } from '../../services/useSectionStatus';

/**
 * "File & Plugin Status" — same real per-section status-badge list shape
 * SiteHealthStatusCard.tsx established for Site Health. Every row
 * here shares one real `category` per section (`security`/`updates`), so
 * no empty-category workaround is needed the way SiteHealthStatusCard's
 * own "Server" row needs one — confirmed via each scanner's own real
 * `get_category()`.
 *
 * "Plugin Vulnerabilities" is scoped to `advanced-vulnerabilities` alone,
 * matching FilesPluginsTab.tsx's own "Plugin Vulnerabilities" section —
 * `basic-vulnerabilities` has zero plugin awareness (pure WordPress-core
 * hardening checks, see that tab's own docblock for the full reasoning)
 * and was moved to Security's own "Website Exposure" section instead.
 */
const FilesPluginsStatusCard = () => {
	const fileIntegrity = useSectionStatus('security', [
		'core-file-integrity',
		'integrity-monitoring',
	]);
	const pluginVulnerabilities = useSectionStatus('security', [
		'advanced-vulnerabilities',
	]);
	const themeVulnerabilities = useSectionStatus('security', [
		'theme-vulnerabilities',
	]);
	const outdatedSoftware = useSectionStatus('updates', ['updates']);

	const rows = [
		{
			id: 'file-integrity',
			label: __('File Integrity', 'vulopilot'),
			status: fileIntegrity,
		},
		{
			id: 'plugin-vulnerabilities',
			label: __('Plugin Vulnerabilities', 'vulopilot'),
			status: pluginVulnerabilities,
		},
		{
			id: 'theme-vulnerabilities',
			label: __('Theme Vulnerabilities', 'vulopilot'),
			status: themeVulnerabilities,
		},
		{
			id: 'outdated-software',
			label: __('Outdated Software', 'vulopilot'),
			status: outdatedSoftware,
		},
	];

	return (
		<CardComponent title={__('File & Plugin Status', 'vulopilot')} titleIcon="module">
			<ListComponent
				className="mini-card list"
				border
				items={rows.map((row) => ({
					id: row.id,
					title: row.label,
					tags: row.status.badge ? (
						<BadgeComponent
							color={row.status.badge.color}
							text={row.status.badge.text}
						/>
					) : null,
				}))}
			/>
		</CardComponent>
	);
};

export default FilesPluginsStatusCard;
