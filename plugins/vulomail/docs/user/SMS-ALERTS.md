# SMS and SMS Alerts

## What it does

VuloMail can send text messages through your own SMS provider account. **SMS Alerts** uses that to text you, or your customers, when something happens on your site.

## Why it matters

- A text reaches you when email does not, for example when your site's email itself has stopped working.
- Customers read a text about their order within minutes.
- You pay your SMS provider for each message, so every alert is **off** until you switch it on.

## How to use it

### 1. Connect an SMS provider

Go to **Settings → Connections** and click **Add SMS connection**. See [CONNECTIONS](CONNECTIONS.md).

### 2. Set your phone number

Go to **Settings → SMS** and enter the **Admin phone number**, in international format such as `+14155550123`. Alerts for you are sent there.

### 3. Switch alerts on

1. Go to **VuloMail → SMS Alerts**.
2. Switch on the alerts you want.
3. When an alert is on, its **Message** box appears. Leave it empty to use the default, or write your own.

Changes save by themselves.

## The alerts

### Site alerts

Sent to the admin phone number.

| Alert | When it is sent |
|---|---|
| **New user registered** | Someone creates an account |
| **Administrator logged in** | An administrator account logs in. Useful for noticing a login that was not you |
| **New comment** | A visitor comments on a post. Spam is ignored |
| **An email failed to send** | An email could not be delivered by any connection. At most one text every 15 minutes, however many emails fail |

### Store alerts

Need WooCommerce. Sent to the admin phone number.

| Alert | When it is sent |
|---|---|
| **New order** | A new order is placed |
| **Order payment failed** | An order moves to "Failed", usually a declined payment |
| **Order cancelled** | An order is cancelled |
| **Order refunded** | A full or partial refund is issued |
| **Product low in stock** | A product reaches its low stock threshold |
| **Product out of stock** | A product sells out |
| **Product backordered** | A customer orders a product that is on backorder |
| **New product review** | A customer reviews a product |

### Customer alerts

Need WooCommerce. Sent to the billing phone on the order.

| Alert | When it is sent |
|---|---|
| **Order confirmed (processing)** | Payment is received and the order is being prepared |
| **Order completed** | The order is marked complete |
| **Order refunded** | The order is fully refunded |
| **Order cancelled** | The order is cancelled |
| **Any other order status change** | Any status change that has no alert of its own switched on, including custom statuses |
| **Note added to an order** | You add a "note to customer" on the order, for example a tracking number |

A customer gets **one text per status change**. If "Order completed" is on, completing an order sends that message and not the general one.

**Only switch on customer alerts if your customers have agreed to receive text messages.** The rules on this differ by country, and you are responsible for following them.

### Requires WooCommerce

Without WooCommerce, the store and customer alerts are shown but locked. Clicking one opens a **Requires WooCommerce** popup.

## Writing your own message

Use placeholders in curly brackets. VuloMail replaces them when the message is sent.

| Placeholder | Replaced with | Available in |
|---|---|---|
| `{site_name}` | Your site's name | Every alert |
| `{username}`, `{user_email}` | The user | New user, administrator login |
| `{user_ip}` | Where the login came from | Administrator login |
| `{comment_author}`, `{post_title}` | Who commented, and where | New comment |
| `{subject}`, `{error}` | The failed email and why | Email failed |
| `{order_number}`, `{order_total}`, `{customer_name}` | The order | Order alerts |
| `{order_status}` | The new status | Customer alerts |
| `{note}` | The note you added | Note added to an order |
| `{product_name}`, `{product_sku}`, `{stock_quantity}` | The product | Stock alerts |
| `{rating}` | Stars given | New product review |

Each alert lists its own placeholders under its Message box.

Keep messages short. A text of more than 160 plain characters is charged as two or more messages; emoji and non-Latin scripts lower that to 70.

## Settings explained

**Settings → SMS**

| Setting | What it does | Why you might change it |
|---|---|---|
| **Send SMS through VuloMail** | When off, no text messages are sent at all, including alerts and messages from other plugins | Switch off to stop all texts quickly without losing your settings |
| **Default country code** | Added to phone numbers written without one. Digits only, for example `1` or `44` | Set it if your customers enter their number without a country code. Without it those numbers are rejected |
| **Admin phone number** | Where alerts for you are sent | |

## Related

- [CONNECTIONS](CONNECTIONS.md) - add and back up an SMS provider.
- [TOOLS](TOOLS.md) - send a test text.
- [LOGS](LOGS.md) - see every text and why one failed.
