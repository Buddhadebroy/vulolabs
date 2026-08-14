/* global appLocalizer */
import { useEffect, useState } from 'react';
import { __, sprintf } from '@wordpress/i18n';
import axios from 'axios';
import { getApiLink, getApiResponse } from '@zyra/core';
import { CardComponent, ColumnComponent, ListComponent } from '@zyra/components';
import { ButtonInput } from '@zyra/inputs';
import { useSalesInsights } from '../../services/useSalesInsights';

interface NamedProduct {
	id: number;
	name: string;
}

interface FindingRow {
	object_ref: string | null;
}

const nonceHeaders = { headers: { 'X-WP-Nonce': appLocalizer.nonce } };

/**
 * Real most-urgent "Projected to run out of stock" product — the same
 * `GET /findings?scanner_id=inventory-intelligence` data
 * InventoryIntelligenceCard.tsx (Pro) already reads, just narrowed to the
 * single open finding's `object_ref` (a real product id), then resolved
 * to that product's real name via `wc/v3/products/{id}`. Resolves `null`
 * on a 404/empty result (Pro's WooCommerce Intelligence module inactive,
 * or nothing currently at risk) — same graceful degrade every other
 * Pro-only probe on this page already uses.
 */
const useRunningLowProduct = (): NamedProduct | null => {
	const [product, setProduct] = useState<NamedProduct | null>(null);

	useEffect(() => {
		let cancelled = false;

		getApiResponse<{ data: FindingRow[] }>(
			getApiLink(
				appLocalizer,
				'findings?category=woocommerce&scanner_id=inventory-intelligence&status=open&per_page=1'
			),
			nonceHeaders
		).then((response) => {
			const productId = response?.data?.[0]?.object_ref;

			if (!productId) {
				return;
			}

			axios
				.get(`${appLocalizer.apiUrl}/wc/v3/products/${productId}`, nonceHeaders)
				.then((productResponse) => {
					if (!cancelled) {
						setProduct({
							id: productResponse.data.id,
							name: productResponse.data.name,
						});
					}
				})
				.catch(() => undefined);
		});

		return () => {
			cancelled = true;
		};
	}, []);

	return product;
};

/**
 * Real, currently out-of-stock product — `wc/v3/products?stock_status=
 * outofstock`, the same real WooCommerce core query
 * WooCommerceCategoryGrid.tsx's own `useOutOfStockCount()` already uses
 * for its total, here fetching the one actual product row instead of
 * just the header count.
 */
const useOutOfStockProduct = (): NamedProduct | null => {
	const [product, setProduct] = useState<NamedProduct | null>(null);

	useEffect(() => {
		let cancelled = false;

		axios
			.get(`${appLocalizer.apiUrl}/wc/v3/products`, {
				...nonceHeaders,
				params: { stock_status: 'outofstock', per_page: 1 },
			})
			.then((response) => {
				if (!cancelled && response.data?.[0]) {
					setProduct({ id: response.data[0].id, name: response.data[0].name });
				}
			})
			.catch(() => undefined);

		return () => {
			cancelled = true;
		};
	}, []);

	return product;
};

interface NoticedRow {
	id: string;
	product: NamedProduct;
	iconTone: 'light' | 'grey' | 'dark';
	badge: { text: string; color: string };
	subtitle: string;
	desc: string;
}

/**
 * "Products to look at" — one real example product per risk category,
 * rather than the bare counts WooCommerceCategoryGrid.tsx's own Inventory/
 * Coupons-style cards already show: the single most urgent running-low
 * product (`useRunningLowProduct()`), the first real out-of-stock product
 * (`useOutOfStockProduct()`), and the first real stale/no-recent-sales
 * product (`useSalesInsights()`'s own `stale_products_sample`, already
 * fetched — shared, not re-fetched — with AiSalesOptimizerCard.tsx/
 * StoreIntelligenceSummaryCard.tsx). Each row only renders when its real
 * data actually resolves — no placeholder/fabricated row for a category
 * that isn't backed (e.g. Pro's WooCommerce Intelligence module inactive
 * hides the "Running low"/"No recent sales" rows, leaving only the free,
 * core-WooCommerce "Out of stock" row). "View product →" links to that
 * product's real edit screen.
 */
const ProductsToLookAtCard = () => {
	const runningLow = useRunningLowProduct();
	const outOfStock = useOutOfStockProduct();
	const { data: salesInsights } = useSalesInsights();
	const stale = salesInsights?.stale_products_sample?.[0] ?? null;

	const rows: NoticedRow[] = [];

	if (runningLow) {
		rows.push({
			id: 'running-low',
			product: runningLow,
			iconTone: 'light',
			badge: { text: __('Running low', 'vulopilot'), color: 'orange' },
			subtitle: __('Selling · Running low', 'vulopilot'),
			desc: __('Stock may run out soon.', 'vulopilot'),
		});
	}

	if (outOfStock) {
		rows.push({
			id: 'out-of-stock',
			product: outOfStock,
			iconTone: 'grey',
			badge: { text: __('Out of stock', 'vulopilot'), color: 'red' },
			subtitle: __('Out of stock', 'vulopilot'),
			desc: __("Customers can't buy it right now.", 'vulopilot'),
		});
	}

	if (stale) {
		rows.push({
			id: 'no-sales',
			product: stale,
			iconTone: 'dark',
			badge: { text: __('No sales', 'vulopilot'), color: 'indigo' },
			subtitle: __('No recent sales', 'vulopilot'),
			desc: __("This product hasn't sold recently.", 'vulopilot'),
		});
	}

	if (0 === rows.length) {
		return null;
	}

	return (
		<ColumnComponent fullHeight grid={6}>
			<CardComponent
				className="products-to-look-at"
				title={__('Products to look at', 'vulopilot')}
				titleIcon="cart"
				action={
					<ButtonInput
						buttons={{
							text: __('View all products →', 'vulopilot'),
							color: 'border-purple',
							onClick: () => {
								window.location.href = `${appLocalizer.site_url}/wp-admin/edit.php?post_type=product`;
							},
						}}
					/>
				}
			>
				<ListComponent
					className="mini-card report"
					items={rows.map((row) => ({
						id: row.id,
						icon: 'cart',
						className: `is-${row.iconTone}`,
						title: row.product.name,
						desc: sprintf(
							/* translators: 1: row subtitle (e.g. "Selling · Running low"), 2: longer reason this product needs attention */
							__('%1$s · %2$s', 'vulopilot'),
							row.subtitle,
							row.desc
						),
						tags: (
							<>
								<span className={`admin-badge ${row.badge.color}`}>
									{row.badge.text}
								</span>
								<ButtonInput
									buttons={{
										text: __('View product →', 'vulopilot'),
										color: 'border-purple',
										onClick: () => {
											window.location.href = `${appLocalizer.site_url}/wp-admin/post.php?post=${row.product.id}&action=edit`;
										},
									}}
								/>
							</>
						),
					}))}
				/>
			</CardComponent>
		</ColumnComponent>
	);
};

export default ProductsToLookAtCard;
