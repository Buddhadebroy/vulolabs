import { __, sprintf } from '@wordpress/i18n';
import { ButtonInput } from '@zyra/inputs';

interface RequiredPluginPopupProps {
	/** The missing plugin, passed by zyra's settings form when a locked field is clicked. */
	plugin?: { plugin: string; name: string; link?: string } | '';
}

// Icon per plugin. zyra's own `woocommerce` glyph carries the words "Product Add-on", which would
// mislabel this popup, so WooCommerce gets the plain cart.
const PLUGIN_ICONS: Record<string, string> = {
	woocommerce: 'cart',
};

/**
 * Shown when someone clicks a setting that needs a plugin which isn't active. Same layout as
 * VuloPilot's "module required" popup: a coloured band with a large icon, then a centred title,
 * explanation and one action.
 */
const RequiredPluginPopup = ({ plugin }: RequiredPluginPopupProps) => {
	if (!plugin) {
		return null;
	}

	return (
		<div className="popup-wrapper">
			<div className="popup-header">
				<i className={`adminfont-${PLUGIN_ICONS[plugin.plugin] ?? 'module'}`} aria-hidden="true" />
			</div>
			<div className="popup-body">
				<div className="module-name">
					{sprintf(
						/* translators: %s: plugin name. */
						__('Requires %s', 'vulomail'),
						plugin.name
					)}
				</div>
				<div className="module-desc">
					{sprintf(
						/* translators: %s: plugin name. */
						__('This setting only works when %s is installed and active.', 'vulomail'),
						plugin.name
					)}
				</div>
				{plugin.link && (
					<ButtonInput
						position="center"
						buttons={[
							{
								icon: 'plus',
								text: sprintf(
									/* translators: %s: plugin name. */
									__('Get %s', 'vulomail'),
									plugin.name
								),
								onClick: () => {
									window.location.href = plugin.link as string;
								},
							},
						]}
					/>
				)}
			</div>
		</div>
	);
};

export default RequiredPluginPopup;
