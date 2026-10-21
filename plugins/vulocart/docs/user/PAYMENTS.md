# Payments

## What it does

**VuloCart → Settings → Payments** controls how your customers can pay. The free plugin includes three offline methods. Online card payments (Stripe, PayPal, Razorpay) come with VuloCart Pro.

## Why it matters

Shoppers can only place an order if at least one payment method is switched on and ready. If none is, the Payment step has nothing to offer.

## The payment methods

The Payments tab is a list of methods. Each has an **Enable** switch and a **Configure** button that opens its settings.

| Method | How it works | Order starts as |
|---|---|---|
| **Manual payment** | You and the buyer arrange payment outside the store (cash, an invoice, a phone call). Switched on by default | The status you choose under *Payment status of new orders* (Pending by default) |
| **Bank transfer** | The buyer sends money directly. You enter **Payment instructions** (account number, bank name, reference format) which are shown on the order confirmation screen | Pending until you mark it paid |
| **Cash on delivery** | The buyer pays in cash when the order arrives | Pending |

### Manual payment settings

| Setting | What it does |
|---|---|
| **Enable manual payment** | Offer the method at checkout |
| **Payment status of new orders** | Payment status a new manual-payment order starts at: Pending, Paid, Failed or Refunded |

### Card charging (online gateways)

| Setting | What it does |
|---|---|
| **Charge the card: At checkout** | The card is charged at checkout |
| **Charge the card: Later, when I capture it** | The card is only authorized. You capture the payment later from the order screen. Offline methods are not affected |

## Confirming a payment you received

For bank transfer and cash on delivery the order stays **Pending** until you confirm. Open the order, change the **Payment** status to **Paid** and press **Update**.

## Refunds

Open the order, enter the **Refund amount** and press **Issue refund**. If the order was paid through an online gateway the money goes back through that gateway first, and the refund is then recorded. You can refund part of the total.

## Online gateways (Pro)

With VuloCart Pro you can switch on Stripe, PayPal and Razorpay. They appear in the same list. See the Pro guide on [payment gateways](../../../../../plugins/vulocart-pro/docs/user/PAYMENT-GATEWAYS.md).

## Related

- [ORDERS](ORDERS.md), [CHECKOUT](CHECKOUT.md)
