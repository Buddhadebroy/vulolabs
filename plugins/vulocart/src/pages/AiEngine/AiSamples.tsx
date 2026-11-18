import type { ReactNode } from 'react';
import { __, sprintf } from '@wordpress/i18n';

/**
 * Sample versions of the AI Copilot cards, shown while the module behind a card is not there. Each one uses the same
 * markup as the card its vulocart-pro module registers (`vulocart-pro/src/components/AiCard.tsx` and the module's own
 * card), filled with made-up data, so a store owner sees what the tool really looks like before turning it on. They
 * are drawn inert: nothing in them can be clicked or typed into.
 */

function SampleCard( { icon, title, desc, actions, className = '', children }: { icon: string; title: string; desc: string; actions?: ReactNode; className?: string; children: ReactNode } ) {
	return (
		<div className={ `vulocart-ai-card ${ className }` }>
			<div className="vulocart-ai-card-head">
				<span className="vulocart-ai-card-icon">
					<i className={ `adminfont-${ icon }` } aria-hidden="true" />
				</span>
				<div className="vulocart-ai-card-heading">
					<strong>{ title }</strong>
					<span>{ desc }</span>
				</div>
				{ actions && <div className="vulocart-ai-card-actions">{ actions }</div> }
			</div>
			<div className="vulocart-ai-card-body">{ children }</div>
		</div>
	);
}

/** The store assistant, mid-conversation. */
function SampleChat() {
	return (
		<SampleCard
			className="vulocart-ai-chat"
			icon="ai"
			title={ __( 'Chat with VuloCart AI', 'vulocart' ) }
			desc={ __( 'Ask about your products, orders and customers - answers come from your store data.', 'vulocart' ) }
			actions={
				<div className="vulocart-ai-mode" role="presentation">
					<button type="button" className="is-active" tabIndex={ -1 }>
						{ __( 'Your store', 'vulocart' ) }
					</button>
					<button type="button" tabIndex={ -1 }>
						{ __( 'As a shopper', 'vulocart' ) }
					</button>
				</div>
			}
		>
			<div className="vulocart-ai-messages">
				<div className="vulocart-ai-bubble is-user">{ __( 'What are my best-selling products this month?', 'vulocart' ) }</div>
				<div className="vulocart-ai-bubble is-ai">
					{ __( 'Your top 3 this month:\n1. Ceramic Coffee Mug - 142 sold, $2,556\n2. Hand-poured Soy Candle - 96 sold, $2,112\n3. Linen Tote Bag - 71 sold, $1,349\n\nThe mug is up 38% on last month, mostly from repeat customers.', 'vulocart' ) }
				</div>
				<div className="vulocart-ai-bubble is-user">{ __( 'Which of those are running low on stock?', 'vulocart' ) }</div>
				<div className="vulocart-ai-bubble is-ai">
					{ __( 'Ceramic Coffee Mug has 12 left - at this pace that is about 3 days. The candle and the tote bag have more than a month of stock.', 'vulocart' ) }
				</div>
			</div>
			<div className="vulocart-ai-composer">
				<textarea className="vulocart-ai-textarea" rows={ 1 } readOnly tabIndex={ -1 } placeholder={ __( 'Ask anything about your store…', 'vulocart' ) } />
				<button type="button" className="vulocart-ai-button" tabIndex={ -1 }>
					<i className="adminfont-send" aria-hidden="true" /> { __( 'Send', 'vulocart' ) }
				</button>
			</div>
		</SampleCard>
	);
}

/** Drafting a product from one sentence, with the draft it saved. */
function SampleCatalog() {
	return (
		<SampleCard icon="product" title={ __( 'Create a product with AI', 'vulocart' ) } desc={ __( 'Describe it in a sentence - AI drafts the title, description and price.', 'vulocart' ) }>
			<textarea className="vulocart-ai-textarea" rows={ 3 } readOnly tabIndex={ -1 } value={ __( 'A 500ml insulated stainless steel water bottle, matte blue, keeps drinks cold for 24 hours', 'vulocart' ) } />
			<button type="button" className="vulocart-ai-button" tabIndex={ -1 }>
				<i className="adminfont-ai" aria-hidden="true" /> { __( 'Draft product', 'vulocart' ) }
			</button>
			<div className="vulocart-ai-result is-success">
				{ __( 'Saved as a draft:', 'vulocart' ) } <a href="#sample" tabIndex={ -1 }>{ __( 'Insulated Steel Water Bottle - 500ml, Matte Blue', 'vulocart' ) }</a>
			</div>
			<span className="vulocart-ai-note">{ __( 'Nothing is published until you review it.', 'vulocart' ) }</span>
		</SampleCard>
	);
}

/** Fraud scores for recent orders, the risky ones first. */
function SampleCheckout() {
	const orders: [ number, string, string, string ][] = [
		[ 1048, __( 'Billing and shipping countries differ, new card', 'vulocart' ), 'badge-inactive', __( 'High risk', 'vulocart' ) ],
		[ 1045, __( '4 orders from one IP address in an hour', 'vulocart' ), 'badge-pending', __( 'Medium risk', 'vulocart' ) ],
		[ 1041, __( 'Unusually large order for a first purchase', 'vulocart' ), 'badge-pending', __( 'Medium risk', 'vulocart' ) ],
	];

	return (
		<SampleCard
			icon="security"
			title={ __( 'Checkout protection', 'vulocart' ) }
			desc={ __( 'Every order is scored for fraud risk as it is placed.', 'vulocart' ) }
			actions={
				<button type="button" className="vulocart-ai-link" tabIndex={ -1 }>
					{ __( 'Review all', 'vulocart' ) }
				</button>
			}
		>
			<div className="vulocart-ai-stats">
				<div className="vulocart-ai-stat is-high">
					<strong>1</strong>
					<span>{ __( 'High risk', 'vulocart' ) }</span>
				</div>
				<div className="vulocart-ai-stat is-medium">
					<strong>2</strong>
					<span>{ __( 'Medium', 'vulocart' ) }</span>
				</div>
				<div className="vulocart-ai-stat">
					<strong>47</strong>
					<span>{ __( 'Low', 'vulocart' ) }</span>
				</div>
			</div>
			<ul className="vulocart-ai-list">
				{ orders.map( ( [ id, reason, badge, label ] ) => (
					<li key={ id }>
						<div className="vulocart-ai-list-main">
							<a href="#sample" tabIndex={ -1 }>
								{ sprintf( /* translators: %d: order number. */ __( 'Order #%d', 'vulocart' ), id ) }
							</a>
							<span>{ reason }</span>
						</div>
						<span className={ `admin-badge ${ badge }` }>{ label }</span>
					</li>
				) ) }
			</ul>
		</SampleCard>
	);
}

/** A search by meaning, with what it matched. */
function SampleSearch() {
	const results: [ string, string, number ][] = [
		[ __( 'Insulated Travel Mug - 350ml', 'vulocart' ), '$24.00', 94 ],
		[ __( 'Steel Vacuum Flask - 750ml', 'vulocart' ), '$32.00', 89 ],
		[ __( 'Ceramic Coffee Mug', 'vulocart' ), '$18.00', 61 ],
	];

	return (
		<SampleCard
			icon="search"
			title={ __( 'Smart search', 'vulocart' ) }
			desc={ __( 'Shoppers find products by what they mean, not just the exact words.', 'vulocart' ) }
			actions={
				<button type="button" className="vulocart-ai-link" tabIndex={ -1 }>
					<i className="adminfont-refresh" aria-hidden="true" /> { __( 'Update', 'vulocart' ) }
				</button>
			}
		>
			<span className="vulocart-ai-note">{ __( '128 products searchable by meaning.', 'vulocart' ) }</span>
			<div className="vulocart-ai-row">
				<input className="vulocart-ai-input" type="search" readOnly tabIndex={ -1 } value={ __( 'something to keep coffee hot on a hike', 'vulocart' ) } />
				<button type="button" className="vulocart-ai-button is-secondary" tabIndex={ -1 }>
					{ __( 'Try', 'vulocart' ) }
				</button>
			</div>
			<ul className="vulocart-ai-list">
				{ results.map( ( [ title, price, match ] ) => (
					<li key={ title }>
						<div className="vulocart-ai-list-main">
							<a href="#sample" tabIndex={ -1 }>{ title }</a>
							<span>{ price }</span>
						</div>
						<span className="vulocart-ai-note">{ sprintf( /* translators: %d: percent. */ __( '%d%% match', 'vulocart' ), match ) }</span>
					</li>
				) ) }
			</ul>
		</SampleCard>
	);
}

/** The sample card for each AI tool, by the tool's id in AiEngine.tsx. */
export const AI_SAMPLES: Record< string, () => ReactNode > = {
	chat: SampleChat,
	catalog: SampleCatalog,
	checkout: SampleCheckout,
	search: SampleSearch,
};
