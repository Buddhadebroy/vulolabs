# SMS and Alerts

## Classes

| Class | File | What it does |
|---|---|---|
| `Dispatcher` | `classes/Sms/Dispatcher.php` | Normalises the number, tries the primary gateway then the backup, logs, fires outcome actions |
| `PhoneNumber` | `classes/Sms/PhoneNumber.php` | E.164 normalisation |
| `GatewayInterface` | `classes/Sms/GatewayInterface.php` | Contract for a gateway adapter |
| `AbstractGateway` | `classes/Sms/AbstractGateway.php` | Shared plumbing for HTTP gateways |
| `Gateways\Twilio`, `Vonage`, `Plivo`, `Clickatell` | `classes/Sms/Gateways/` | The adapters |
| `Triggers` | `classes/Sms/Triggers.php` | The SMS alerts: definitions, the WordPress and WooCommerce hooks that fire them, templates |

## 1. Sending

`Sms\Dispatcher::send( $to, $body, $source = '' )`:

1. Normalises `$to` with the `sms_country_code` setting.
2. Strips HTML from `$body`, then applies `vulomail_sms_message`.
3. Refuses when SMS is switched off (`sms_disabled`), the number is invalid (`invalid_number`), the body is empty (`empty_message`) or longer than 1530 characters (`message_too_long`).
4. Walks `chain()` (`sms_primary`, then `sms_backup`) and stops at the first success.
5. Logs one row and fires `vulomail_sms_sent` or `vulomail_sms_failed`.

`send_via()` sends through one named connection with no failover and no logging.

### Phone numbers

`PhoneNumber::normalize( $raw, $country_code )` returns `+` and 8 to 15 digits, or `''`. A number starting with `+` or `00` is taken as international. Anything else is national: the default country code is prepended and leading zeros are dropped. With no default country code a national number is invalid.


### Adapters

| Gateway | Endpoint | Success | Notes |
|---|---|---|---|
| Twilio | `api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json` | HTTP 201 | The Account SID is validated before it goes in the URL. A sender starting `MG` is sent as `MessagingServiceSid` |
| Vonage | `rest.nexmo.com/sms/json` | HTTP 200 and message status `0` | Vonage answers 200 for rejected messages. Non-ASCII text sets `type=unicode` |
| Plivo | `api.plivo.com/v1/Account/{auth_id}/Message/` | HTTP 202 | The Auth ID is validated before it goes in the URL |
| Clickatell | `platform.clickatell.com/messages` | HTTP 202 and not `accepted: false` | A 202 can carry a per-message rejection |

## 2. Alerts

`Triggers::definitions()` returns every alert: `label`, `desc`, `recipient` (`admin` or `customer`), `template`, `placeholders`, `available`, `requires`. It is filterable through `vulomail_sms_triggers`.

| Group | Recipient | Requires | Alert ids |
|---|---|---|---|
| Site | Admin phone | - | `user_registered`, `admin_login`, `new_comment`, `email_failed` |
| Store | Admin phone | WooCommerce | `wc_new_order`, `wc_order_failed`, `wc_order_cancelled`, `wc_order_refunded`, `wc_low_stock`, `wc_out_of_stock`, `wc_backorder`, `wc_new_review` |
| Customer | Billing phone | WooCommerce | `wc_customer_processing`, `wc_customer_completed`, `wc_customer_refunded`, `wc_customer_cancelled`, `wc_order_status_changed`, `wc_customer_note` |

Every alert is off until switched on. State is stored in the `sms_triggers` setting as `{ id: { enabled, template } }`; an empty template means "use the default".

### Firing

`fire( $id, $to, array $values )` does nothing unless the alert exists, is enabled and SMS is ready. `$to = ''` means the admin phone (`sms_admin_phone`). Placeholders are `{name}`; `{site_name}` is always available. The log source is `vulomail-alert-{id}`.

Hooks: `user_register`, `wp_login`, `comment_post`, `vulomail_email_failed`, `woocommerce_new_order`, `woocommerce_order_status_changed`, `woocommerce_order_refunded`, `woocommerce_new_customer_note`, `woocommerce_low_stock`, `woocommerce_no_stock`, `woocommerce_product_on_backorder`.

Rules built into the handlers:

- `admin_login` fires only for users who can `manage_options`.
- `new_comment` ignores comments marked spam or trash.
- `email_failed` sends at most one text every 15 minutes (transient `vulomail_email_failed_alert`) and ignores failed test emails.
- **One text per order change.** `CUSTOMER_STATUS_TRIGGERS` maps `processing`, `completed`, `refunded` and `cancelled` to their own customer alerts. A status with no alert of its own, or whose alert is off, falls through to `wc_order_status_changed`.
- A customer alert is skipped when the order has no billing phone.

### Adding an alert

```php
add_filter( 'vulomail_sms_triggers', function ( $triggers ) {
	$triggers['my_form_submitted'] = array(
		'label'        => 'Form submitted',
		'desc'         => 'Text the site admin when the contact form is submitted.',
		'recipient'    => 'admin',
		'template'     => 'New enquiry from {name} on {site_name}.',
		'placeholders' => array( 'site_name', 'name' ),
		'available'    => true,
		'requires'     => '',
	);
	return $triggers;
} );

// When it happens:
VuloMail()->sms_triggers->fire( 'my_form_submitted', '', array( 'name' => $name ) );
```

Set `requires` to `woocommerce` (and `available` to whether WooCommerce is active) to have the admin screen lock the alert with a "Requires WooCommerce" popup when the plugin is missing.
