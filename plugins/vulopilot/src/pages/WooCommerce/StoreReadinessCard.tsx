/* global appLocalizer */
import { __ } from '@wordpress/i18n';
import { CardComponent } from '@zyra/components';
import { useStoreReadiness } from '../../services/useStoreReadiness';

/**
 * "Store Readiness" — a live checklist (`GET /store-readiness`,
 * StoreReadiness.php), not a findings table: each row reflects the
 * store's current configuration right now (a page either exists and is
 * published, or it doesn't), recomputed fresh on every load rather than
 * only as-of the last scan run. Real problems with these same facts
 * (checkout not on HTTPS, no payment gateway) still get their own
 * persistent, actionable findings further down this page — this card is
 * just the at-a-glance summary.
 */
const StoreReadinessCard = () => {
	const { data, isLoading } = useStoreReadiness();

	const rows: { key: string; label: string }[] = [
		{ key: 'shop', label: __('Shop page', 'vulopilot') },
		{ key: 'cart', label: __('Cart page', 'vulopilot') },
		{ key: 'checkout', label: __('Checkout page', 'vulopilot') },
		{ key: 'my_account', label: __('My Account page', 'vulopilot') },
	];

	const allReady = !!data && Object.values(data.readiness).every(Boolean) && data.secure_checkout;

	return (
		<CardComponent
			id="store-readiness"
			className="store-readiness-card"
			title={__('Store Readiness', 'vulopilot')}
			isLoading={isLoading}
			badges={
				data
					? [
							allReady
								? { text: __('Good', 'vulopilot'), color: 'green' }
								: {
										text: __('Needs attention', 'vulopilot'),
										color: 'red',
									},
						]
					: []
			}
		>
			{data && (
				<ul className="store-readiness-list">
					{rows.map((row) => {
						const ready = data.readiness[row.key as keyof typeof data.readiness];

						return (
							<li key={row.key}>
								<span className="store-readiness-row-label">
									<i
										className={`adminfont-${ready ? 'check' : 'error'}`}
									/>
									{row.label}
								</span>
								<span
									className={`store-readiness-row-status ${ready ? 'is-ready' : 'is-not-ready'}`}
								>
									{ready
										? __('Ready', 'vulopilot')
										: __('Not ready', 'vulopilot')}
								</span>
							</li>
						);
					})}
					<li>
						<span className="store-readiness-row-label">
							<i
								className={`adminfont-${data.secure_checkout ? 'check' : 'error'}`}
							/>
							{__('Secure checkout (HTTPS)', 'vulopilot')}
						</span>
						<span
							className={`store-readiness-row-status ${data.secure_checkout ? 'is-ready' : 'is-not-ready'}`}
						>
							{data.secure_checkout
								? __('Protected', 'vulopilot')
								: __('Not secured', 'vulopilot')}
						</span>
					</li>
				</ul>
			)}
			<a
				className="store-readiness-view-all"
				href={`${appLocalizer.site_url}/wp-admin/edit.php?post_type=page`}
			>
				{__('View all store pages →', 'vulopilot')}
			</a>
		</CardComponent>
	);
};

export default StoreReadinessCard;
