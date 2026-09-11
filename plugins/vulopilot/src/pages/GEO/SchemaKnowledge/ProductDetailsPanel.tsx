/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, _n, sprintf } from '@wordpress/i18n';
import { getApiLink, getApiResponse } from '@zyra/core';
import { BadgeComponent, PopupComponent, SkeletonComponent, ModuleGuardComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';

interface ProductSchemaDetail {
	id: number;
	name: string;
	url: string;
	edit_url: string | null;
	issues: string[];
	issue_count: number;
}

/**
 * "Product Details" — `BusinessProfileCard.tsx`'s "Products" row, same
 * real slide-in-panel shape `BusinessNameDetailsPanel.tsx` already
 * established, backed by `GET /entities/product-details`
 * (`EntityExtractor::get_product_schema_details()`'s own docblock has the
 * full "what counts as a real issue" design — real WooCommerce
 * completeness gaps, not a fabricated/guessed count). Each real product
 * gets a real "View" (its own live permalink) and "Edit" (its own
 * wp-admin editor) action — `edit_url` is null only when the current user
 * genuinely can't edit that product, in which case "Edit" isn't shown
 * rather than linking somewhere that would just 403.
 */
const ProductDetailsPanel = ({
	open,
	onClose,
}: {
	open: boolean;
	onClose: () => void;
}) => {
	const [products, setProducts] = useState<ProductSchemaDetail[] | null>(null);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		if (!open) {
			return;
		}

		setIsLoading(true);
		getApiResponse<ProductSchemaDetail[]>(
			getApiLink(appLocalizer, 'entities/product-details'),
			{ headers: { 'X-WP-Nonce': appLocalizer.nonce } }
		)
			.then((response) => setProducts(response ?? []))
			.finally(() => setIsLoading(false));
	}, [open]);

	const totalIssues = (products ?? []).reduce(
		(sum: number, product: ProductSchemaDetail) => sum + product.issue_count,
		0
	);

	return (
		<PopupComponent
			open={open}
			onClose={onClose}
			width={35}
			header={{
				title: __('Product Details', 'vulopilot'),
				description: __(
					'Detected products and their schema status.',
					'vulopilot'
				),
			}}
		>
			{isLoading || null === products ? (
				<>
					<SkeletonComponent width="100%" height={4} />
					<SkeletonComponent width="100%" height={10} />
					<SkeletonComponent width="100%" height={8} />
				</>
			) : 0 === products.length ? (
				<ModuleGuardComponent
					icon="info"
					title={__('No products found', 'vulopilot')}
					desc={__(
						'This site has no published WooCommerce products yet, or WooCommerce isn’t active.',
						'vulopilot'
					)}
				/>
			) : (
				<div className="business-name-panel">
					<div className="business-name-panel-summary">
						<div className="business-name-panel-summary-left">
							<i className="adminfont-product business-name-panel-summary-icon" />
							<div>
								<div className="business-name-panel-summary-label">
									{sprintf(
										/* translators: %d: how many real published products were checked. */
										_n('%d product', '%d products', products.length, 'vulopilot'),
										products.length
									)}
								</div>
								<div className="business-name-panel-summary-value">
									{__('Detected products and their schema status.', 'vulopilot')}
								</div>
							</div>
						</div>
						<BadgeComponent
							color={totalIssues > 0 ? 'red' : 'green'}
							icon={totalIssues > 0 ? 'error' : 'check'}
							text={
								totalIssues > 0
									? sprintf(
											/* translators: %d: total real completeness issues across every product. */
											_n('%d issue', '%d issues', totalIssues, 'vulopilot'),
											totalIssues
										)
									: __('No issues', 'vulopilot')
							}
						/>
					</div>

					<div className="business-name-panel-sources">
						{products.map((product: ProductSchemaDetail) => (
							<div key={product.id} className="business-name-panel-source-row">
								<span
									className={`business-name-panel-source-icon ${0 === product.issue_count ? 'is-good' : 'is-muted'}`}
								>
									<i className="adminfont-product" />
								</span>
								<div className="business-name-panel-source-main">
									<span className="business-name-panel-source-label">
										{product.name}
									</span>
									<BadgeComponent
										variant="dot"
										color={0 === product.issue_count ? 'green' : 'red'}
										text={
											0 === product.issue_count
												? __('No issues', 'vulopilot')
												: sprintf(
														/* translators: %d: how many real completeness issues this product has. */
														_n(
															'%d issue',
															'%d issues',
															product.issue_count,
															'vulopilot'
														),
														product.issue_count
													)
										}
									/>
								</div>
								<ButtonInput
									buttons={[
										{
											text: __('View', 'vulopilot'),
											color: 'border-purple',
											onClick: () => window.open(product.url, '_blank'),
										},
										...(product.edit_url
											? [
													{
														text: __('Edit', 'vulopilot'),
														icon: 'edit',
														color: 'border-purple',
														onClick: () =>
															window.open(
																product.edit_url as string,
																'_blank'
															),
													},
												]
											: []),
									]}
								/>
							</div>
						))}
					</div>
				</div>
			)}
		</PopupComponent>
	);
};

export default ProductDetailsPanel;
