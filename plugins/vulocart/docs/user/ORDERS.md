# Orders

## What it does

**Orders** lists every order placed through your checkout, and lets you update, fulfil, refund or delete them. You can also create orders yourself for customers who phone or email.

## Why it matters

An order has two separate statuses, so you always know two things: **has it been paid?** and **has it been sent?**

| Payment status | Meaning |
|---|---|
| Pending | Not paid yet (or waiting for you to confirm a transfer) |
| Paid | The money has arrived |
| Failed | The payment did not go through |
| Refunded | Money was returned |

| Fulfillment status | Meaning |
|---|---|
| Draft | An order you created by hand that has not been placed with the customer yet |
| Pending | Placed, not started |
| Processing | You are working on it |
| Shipped | On its way |
| Completed | Delivered / done |
| Cancelled | Cancelled |

Every order has a number such as **VC-000042**. The buyer also gets a private access token, which together with the number lets a guest look up the order.

## The order list

**Orders → All Orders** shows Order, Customer, Email, Items, Payment status, Fulfillment status, Total, Currency and Created date.

- Use the **status tabs** (All, Draft, Pending, Processing, Shipped, Completed, Cancelled) and the **Payment** and **Fulfillment** filters.
- **Search** by order number, email or name, and filter by created date.
- **Update status** changes the status of one order from the list. Select several orders to change them together, or to delete them.
- **View** opens the full order. **Export** downloads the list.

## Open an order

The order page shows:

| Card | What it shows or lets you do |
|---|---|
| **Items** | The products, cost, quantity and totals: subtotal, discount, shipping, tax, paid, refunded and balance due |
| **Fulfillment / Payment** (top bar) | Change the status with the pencil, then press **Update** |
| **Refund** | Enter a **Refund amount** and press **Issue refund**, then **Confirm refund** |
| **Shipping** | Method and cost, and the **Ship to** address |
| **Customer** | Name, email, phone, whether they are registered or a guest, lifetime spend and customer since |
| **Billing** | The billing address ("Same as shipping" when identical) |
| **Payment** | Method, amount, transaction id and the transaction history |
| **Timeline** | Everything that has happened to the order |
| **Tags** | Your own labels such as "wholesale" or "gift" |
| **Documents** | Invoice, packing slip and credit note as PDF (VuloCart Pro) |

Things to know:

- If an order is Completed or Shipped but unpaid, a notice reminds you ("This order is shipped but payment is still pending") with a **Go to payment** link.
- **Waiting for payment**: press **Ask your customer to pay** (or **Ask again**) to email the customer the amount due and how to pay. The page shows when you last asked.
- A manually settled order shows "Marked as paid manually - no gateway events were recorded".
- An address you left out can be added with **Add address**; **Copy billing address** / **Copy shipping address** saves typing.
- The page tells you when you have **Unsaved changes**. Press **Update** to save.
- A refund through an online gateway goes back through that gateway first and is then recorded. You can refund part of the total; enter a smaller amount.

## Create an order by hand

1. Go to **Orders → Add New**.
2. Search your catalogue and click products to add them. Change quantities with the plus and minus buttons.
3. Pick the customer ("Find an existing customer") or enter an email and name for a one-off. Leave the details blank for an anonymous order.
4. Add tags if you like and press **Save as draft**. Nothing is charged.
5. On the next screen set the payment and fulfillment status, add addresses and, with Pro, create a shipment. Shipping, tax and discounts are worked out once the order is saved.

## Emails

Customers get an order confirmation when they place an order and a status update when you change their order's status. You can turn each on or off and set the From address under **Settings → Integrations → Email**. See [SETTINGS](SETTINGS.md).

## Related

- [CUSTOMERS](CUSTOMERS.md), [PAYMENTS](PAYMENTS.md), [DASHBOARD](DASHBOARD.md)
