# Database

The tables the free plugin creates. Core tables are created by `classes/Install.php` on activation and on a version change; module tables are created by the module's own `Install.php` when the module is activated, guarded by a schema version option.

Data that is not in a table: settings (`vulocart_settings`), the list of active modules, product permalink structure, switched-off product types and **tax classes** (a small option, see `Taxes\Application\RateRepository`). See [SETTINGS-SYSTEM](SETTINGS-SYSTEM.md#storage).

All table names below are shown without the WordPress table prefix (`$wpdb->prefix`, usually `wp_`).

| Table | Area | Created by | Purpose |
|---|---|---|---|
| `vulocart_products` | Catalog | Core | One row per product of every type. `type` tells the product types apart; `meta` and `passport` hold type-specific data as JSON. |
| `vulocart_terms` | Catalog | Core | Categories, brands, collections and tags in one table, told apart by `taxonomy`. |
| `vulocart_attributes` | Catalog | Core | Product attributes (for example Color, Size). |
| `vulocart_attribute_values` | Catalog | Core | The values of an attribute (Red, Blue, ...). |
| `vulocart_reviews` | Catalog | Core | Customer product reviews and their moderation status. Kept when the Product Reviews module is switched off. |
| `vulocart_checkout_sessions` | Checkout | Core | One row per started checkout, identified by the cart token. Used to find abandoned checkouts. |
| `vulocart_orders` | Orders | Order module | One row per order, with its payment and fulfillment status, addresses and totals. |
| `vulocart_order_items` | Orders | Order module | The line items of an order. A fixed record once the order is placed. |
| `vulocart_payment_transactions` | Payments | Payment module | Ledger of every payment attempt, capture, void and refund for an order. |
| `vulocart_ai_usage_log` | AI | AI module | Log of every AI request: feature, tokens and whether it succeeded. |
| `vulocart_tax_rates` | Tax | Taxes module | Tax rates by country, state and postcode, per tax class and priority. |
| `vulocart_carts` | Cart | Cart module | One row per cart, identified by an opaque token. |
| `vulocart_cart_items` | Cart | Cart module | The items in a cart, with the price at the time they were added. |
| `vulocart_customers` | Customers | Customer module | Customer records with running order totals. |
| `vulocart_customer_addresses` | Customers | Customer module | A customer's address book. |
| `vulocart_customer_notes` | Customers | Customer module | Private notes the store team keeps on a customer. |

### `vulocart_products`

One row per product of every type. `type` tells the product types apart; `meta` and `passport` hold type-specific data as JSON.

| Column | Definition |
|---|---|
| `id` | `bigint(20) unsigned NOT NULL AUTO_INCREMENT` |
| `type` | `varchar(50) NOT NULL` |
| `sku` | `varchar(100) DEFAULT NULL` |
| `title` | `varchar(255) NOT NULL` |
| `slug` | `varchar(200) NOT NULL` |
| `status` | `varchar(20) NOT NULL DEFAULT 'draft'` |
| `price` | `decimal(19,4) DEFAULT NULL` |
| `currency` | `varchar(10) DEFAULT NULL` |
| `meta` | `longtext DEFAULT NULL` |
| `created_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` |
| `published_at` | `datetime DEFAULT NULL` |

Keys: `PRIMARY KEY (`id`)`; `KEY `idx_type` (`type`)`; `KEY `idx_status` (`status`)`; `KEY `idx_sku` (`sku`)`; `KEY `idx_slug` (`slug`)`

### `vulocart_terms`

Categories, brands, collections and tags in one table, told apart by `taxonomy`.

| Column | Definition |
|---|---|
| `id` | `bigint(20) unsigned NOT NULL AUTO_INCREMENT` |
| `taxonomy` | `varchar(20) NOT NULL` |
| `name` | `varchar(200) NOT NULL` |
| `slug` | `varchar(200) NOT NULL` |
| `parent_id` | `bigint(20) unsigned DEFAULT NULL` |
| `description` | `text DEFAULT NULL` |
| `meta` | `longtext DEFAULT NULL` |
| `created_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` |

Keys: `PRIMARY KEY (`id`)`; `UNIQUE KEY `idx_taxonomy_slug` (`taxonomy`, `slug`)`; `KEY `idx_parent_id` (`parent_id`)`

### `vulocart_attributes`

Product attributes (for example Color, Size).

| Column | Definition |
|---|---|
| `id` | `bigint(20) unsigned NOT NULL AUTO_INCREMENT` |
| `name` | `varchar(200) NOT NULL` |
| `slug` | `varchar(200) NOT NULL` |
| `created_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` |

Keys: `PRIMARY KEY (`id`)`; `UNIQUE KEY `idx_slug` (`slug`)`

### `vulocart_attribute_values`

The values of an attribute (Red, Blue, ...).

| Column | Definition |
|---|---|
| `id` | `bigint(20) unsigned NOT NULL AUTO_INCREMENT` |
| `attribute_id` | `bigint(20) unsigned NOT NULL` |
| `value` | `varchar(200) NOT NULL` |
| `created_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Keys: `PRIMARY KEY (`id`)`; `KEY `idx_attribute_id` (`attribute_id`)`

### `vulocart_reviews`

Customer product reviews and their moderation status. Kept when the Product Reviews module is switched off.

| Column | Definition |
|---|---|
| `id` | `bigint(20) unsigned NOT NULL AUTO_INCREMENT` |
| `product_id` | `bigint(20) unsigned NOT NULL` |
| `customer_name` | `varchar(200) DEFAULT NULL` |
| `customer_email` | `varchar(200) DEFAULT NULL` |
| `rating` | `tinyint(1) unsigned NOT NULL DEFAULT 5` |
| `title` | `varchar(200) DEFAULT NULL` |
| `content` | `text DEFAULT NULL` |
| `status` | `varchar(20) NOT NULL DEFAULT 'pending'` |
| `created_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` |

Keys: `PRIMARY KEY (`id`)`; `KEY `idx_product_id` (`product_id`)`; `KEY `idx_status` (`status`)`

### `vulocart_checkout_sessions`

One row per started checkout, identified by the cart token. Used to find abandoned checkouts.

| Column | Definition |
|---|---|
| `id` | `bigint(20) unsigned NOT NULL AUTO_INCREMENT` |
| `cart_token` | `varchar(191) NOT NULL` |
| `status` | `varchar(20) NOT NULL DEFAULT 'active'` |
| `mode` | `varchar(20) NOT NULL DEFAULT 'multi_step'` |
| `current_step` | `varchar(50) DEFAULT NULL` |
| `customer_email` | `varchar(200) DEFAULT NULL` |
| `meta` | `longtext DEFAULT NULL` |
| `created_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` |

Keys: `PRIMARY KEY (`id`)`; `UNIQUE KEY `idx_cart_token` (`cart_token`)`; `KEY `idx_status_updated` (`status`, `updated_at`)`

### `vulocart_orders`

One row per order, with its payment and fulfillment status, addresses and totals.

| Column | Definition |
|---|---|
| `id` | `bigint(20) unsigned NOT NULL AUTO_INCREMENT` |
| `order_number` | `varchar(32) NOT NULL` |
| `access_token` | `varchar(64) NOT NULL` |
| `cart_token` | `varchar(64) DEFAULT NULL` |
| `customer_email` | `varchar(200) DEFAULT NULL` |
| `customer_name` | `varchar(200) DEFAULT NULL` |
| `customer_phone` | `varchar(30) DEFAULT NULL` |
| `customer_user_id` | `bigint(20) unsigned DEFAULT NULL` |
| `status` | `varchar(20) NOT NULL DEFAULT 'pending'` |
| `payment_status` | `varchar(20) NOT NULL DEFAULT 'pending'` |
| `fulfillment_status` | `varchar(20) NOT NULL DEFAULT 'pending'` |
| `refunded_amount` | `decimal(19,4) DEFAULT NULL` |
| `currency` | `varchar(10) DEFAULT NULL` |
| `subtotal` | `decimal(19,4) NOT NULL DEFAULT 0.0000` |
| `shipping_method` | `varchar(50) DEFAULT NULL` |
| `shipping_cost` | `decimal(19,4) NOT NULL DEFAULT 0.0000` |
| `tax_amount` | `decimal(19,4) NOT NULL DEFAULT 0.0000` |
| `payment_method` | `varchar(50) DEFAULT NULL` |
| `gateway_transaction_id` | `varchar(191) DEFAULT NULL` |
| `authorized_amount` | `decimal(19,4) NOT NULL DEFAULT 0.0000` |
| `captured_amount` | `decimal(19,4) NOT NULL DEFAULT 0.0000` |
| `total` | `decimal(19,4) NOT NULL DEFAULT 0.0000` |
| `billing_address` | `longtext DEFAULT NULL` |
| `shipping_address` | `longtext DEFAULT NULL` |
| `meta` | `longtext DEFAULT NULL` |
| `created_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` |

Keys: `PRIMARY KEY (`id`)`; `UNIQUE KEY `idx_order_number` (`order_number`)`; `KEY `idx_status` (`status`)`; `KEY `idx_payment_status` (`payment_status`)`; `KEY `idx_fulfillment_status` (`fulfillment_status`)`; `KEY `idx_customer_email` (`customer_email`)`; `KEY `idx_customer_user_id` (`customer_user_id`)`; `KEY `idx_gateway_transaction_id` (`gateway_transaction_id`)`

### `vulocart_order_items`

The line items of an order. A fixed record once the order is placed.

| Column | Definition |
|---|---|
| `id` | `bigint(20) unsigned NOT NULL AUTO_INCREMENT` |
| `order_id` | `bigint(20) unsigned NOT NULL` |
| `product_id` | `bigint(20) unsigned NOT NULL` |
| `title` | `varchar(255) NOT NULL` |
| `quantity` | `int(10) unsigned NOT NULL DEFAULT 1` |
| `unit_price` | `decimal(19,4) DEFAULT NULL` |
| `currency` | `varchar(10) DEFAULT NULL` |
| `meta` | `longtext DEFAULT NULL` |
| `created_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Keys: `PRIMARY KEY (`id`)`; `KEY `idx_order_id` (`order_id`)`; `KEY `idx_product_id` (`product_id`)`

### `vulocart_payment_transactions`

Ledger of every payment attempt, capture, void and refund for an order.

| Column | Definition |
|---|---|
| `id` | `bigint(20) unsigned NOT NULL AUTO_INCREMENT` |
| `order_id` | `bigint(20) unsigned DEFAULT NULL` |
| `cart_token` | `varchar(64) DEFAULT NULL` |
| `gateway` | `varchar(50) NOT NULL` |
| `type` | `varchar(20) NOT NULL` |
| `gateway_transaction_id` | `varchar(191) DEFAULT NULL` |
| `status` | `varchar(20) NOT NULL` |
| `amount` | `decimal(19,4) NOT NULL DEFAULT 0.0000` |
| `currency` | `varchar(10) DEFAULT NULL` |
| `raw_response` | `longtext DEFAULT NULL` |
| `created_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` |

Keys: `PRIMARY KEY (`id`)`; `KEY `idx_order_id` (`order_id`)`; `KEY `idx_gateway_transaction_id` (`gateway_transaction_id`)`; `KEY `idx_cart_token` (`cart_token`)`

### `vulocart_ai_usage_log`

Log of every AI request: feature, tokens and whether it succeeded.

| Column | Definition |
|---|---|
| `id` | `bigint(20) unsigned NOT NULL AUTO_INCREMENT` |
| `provider` | `varchar(50) NOT NULL` |
| `model` | `varchar(100) NOT NULL DEFAULT ''` |
| `feature` | `varchar(100) NOT NULL` |
| `prompt_tokens` | `int(11) NOT NULL DEFAULT 0` |
| `completion_tokens` | `int(11) NOT NULL DEFAULT 0` |
| `success` | `tinyint(1) NOT NULL DEFAULT 1` |
| `error_message` | `text DEFAULT NULL` |
| `created_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Keys: `PRIMARY KEY (`id`)`; `KEY `idx_feature` (`feature`)`

### `vulocart_tax_rates`

Tax rates by country, state and postcode, per tax class and priority.

| Column | Definition |
|---|---|
| `id` | `bigint(20) unsigned NOT NULL AUTO_INCREMENT` |
| `tax_class` | `varchar(64) NOT NULL DEFAULT 'standard'` |
| `country` | `varchar(2) NOT NULL DEFAULT ''` |
| `state` | `varchar(64) NOT NULL DEFAULT ''` |
| `postcode` | `varchar(255) NOT NULL DEFAULT ''` |
| `rate` | `decimal(8,4) NOT NULL DEFAULT 0.0000` |
| `name` | `varchar(100) NOT NULL DEFAULT ''` |
| `priority` | `int(11) NOT NULL DEFAULT 1` |
| `shipping` | `tinyint(1) NOT NULL DEFAULT 1` |
| `created_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Keys: `PRIMARY KEY (`id`)`; `KEY `idx_tax_class` (`tax_class`)`; `KEY `idx_country` (`country`)`

### `vulocart_carts`

One row per cart, identified by an opaque token.

| Column | Definition |
|---|---|
| `id` | `bigint(20) unsigned NOT NULL AUTO_INCREMENT` |
| `token` | `varchar(64) NOT NULL` |
| `currency` | `varchar(10) DEFAULT NULL` |
| `meta` | `longtext DEFAULT NULL` |
| `created_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` |

Keys: `PRIMARY KEY (`id`)`; `UNIQUE KEY `idx_token` (`token`)`

### `vulocart_cart_items`

The items in a cart, with the price at the time they were added.

| Column | Definition |
|---|---|
| `id` | `bigint(20) unsigned NOT NULL AUTO_INCREMENT` |
| `cart_id` | `bigint(20) unsigned NOT NULL` |
| `product_id` | `bigint(20) unsigned NOT NULL` |
| `quantity` | `int(10) unsigned NOT NULL DEFAULT 1` |
| `unit_price` | `decimal(19,4) DEFAULT NULL` |
| `currency` | `varchar(10) DEFAULT NULL` |
| `meta` | `longtext DEFAULT NULL` |
| `created_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` |

Keys: `PRIMARY KEY (`id`)`; `KEY `idx_cart_id` (`cart_id`)`; `KEY `idx_product_id` (`product_id`)`

### `vulocart_customers`

Customer records with running order totals.

| Column | Definition |
|---|---|
| `id` | `bigint(20) unsigned NOT NULL AUTO_INCREMENT` |
| `email` | `varchar(200) NOT NULL` |
| `wp_user_id` | `bigint(20) unsigned DEFAULT NULL` |
| `name` | `varchar(200) DEFAULT NULL` |
| `phone` | `varchar(30) DEFAULT NULL` |
| `total_orders` | `int(10) unsigned NOT NULL DEFAULT 0` |
| `total_spent` | `decimal(19,4) NOT NULL DEFAULT 0.0000` |
| `last_order_at` | `datetime DEFAULT NULL` |
| `created_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` |

Keys: `PRIMARY KEY (`id`)`; `UNIQUE KEY `idx_email` (`email`)`; `KEY `idx_wp_user_id` (`wp_user_id`)`

### `vulocart_customer_addresses`

A customer's address book.

| Column | Definition |
|---|---|
| `id` | `bigint(20) unsigned NOT NULL AUTO_INCREMENT` |
| `customer_id` | `bigint(20) unsigned NOT NULL` |
| `label` | `varchar(100) DEFAULT NULL` |
| `is_default_billing` | `tinyint(1) NOT NULL DEFAULT 0` |
| `is_default_shipping` | `tinyint(1) NOT NULL DEFAULT 0` |
| `full_name` | `varchar(200) DEFAULT NULL` |
| `phone` | `varchar(30) DEFAULT NULL` |
| `address_1` | `varchar(255) DEFAULT NULL` |
| `address_2` | `varchar(255) DEFAULT NULL` |
| `city` | `varchar(100) DEFAULT NULL` |
| `state` | `varchar(100) DEFAULT NULL` |
| `postcode` | `varchar(30) DEFAULT NULL` |
| `country` | `varchar(100) DEFAULT NULL` |
| `created_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP` |
| `updated_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` |

Keys: `PRIMARY KEY (`id`)`; `KEY `idx_customer_id` (`customer_id`)`

### `vulocart_customer_notes`

Private notes the store team keeps on a customer.

| Column | Definition |
|---|---|
| `id` | `bigint(20) unsigned NOT NULL AUTO_INCREMENT` |
| `customer_id` | `bigint(20) unsigned NOT NULL` |
| `author_user_id` | `bigint(20) unsigned DEFAULT NULL` |
| `note` | `longtext NOT NULL` |
| `created_at` | `timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP` |

Keys: `PRIMARY KEY (`id`)`; `KEY `idx_customer_id` (`customer_id`)`

