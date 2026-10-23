# Getting Started with VuloCart

## What VuloCart does

VuloCart turns your WordPress site into an online store. You add products, shoppers add them to a cart, check out and pay, and you manage the orders, customers and stock from the WordPress admin. VuloCart keeps its own data, so it does not need WooCommerce.

## Why use it

- One place for products, orders, customers and payments.
- A checkout that you can shorten or lengthen: from one page to a step-by-step flow.
- You can sell more than boxes: downloads, courses, services, memberships, bookings, rentals, bundles, donations and gift cards each get the right fields.
- Features you do not need can be switched off.

## About this page

This page covers what you only need once: requirements, installing, your first sale and a map of the menu. The other guides do not repeat it.

**In this guide**

1. [Requirements](#1-requirements)
2. [Install and activate](#2-install-and-activate)
3. [Your first sale in three steps](#3-your-first-sale-in-three-steps)
4. [Find your way around](#4-find-your-way-around)
5. [Ideas you will see everywhere](#5-ideas-you-will-see-everywhere)
6. [Where to go next](#6-where-to-go-next)

## 1. Requirements

| Requirement | Minimum |
|---|---|
| WordPress | 6.3 |
| PHP | 8.0 |
| Pretty permalinks | Recommended, so product pages get readable addresses |
| WooCommerce | Not needed |

## 2. Install and activate

1. In WordPress, go to **Plugins → Add New → Upload Plugin**, choose the VuloCart zip and press **Install Now**.
2. Press **Activate**.
3. A new **VuloCart** menu appears in the left sidebar, together with **Orders**, **Products**, **Customers** and **Marketing**.

Activating also switches on the basics a store needs: cart, orders, customers, addresses, payments and the checkout steps. You can switch the optional ones off later under **VuloCart → Settings → Modules**.

## 3. Your first sale in three steps

The Dashboard shows a "Get ready for your first order" panel with these steps.

1. **Add products.** Go to **Products → Add New**, choose what you are selling, give it a name and a price, and press **Save**. See [PRODUCTS](PRODUCTS.md).
2. **Set up payments.** Go to **VuloCart → Settings → Payments** and switch on at least one method, for example Manual payment, Bank transfer or Cash on delivery. See [PAYMENTS](PAYMENTS.md).
3. **Place a test order.** Put the shop and checkout on a page (see [CHECKOUT](CHECKOUT.md)), add a product to the cart as a shopper would, and place the order. Then open **Orders** to see it.

Until a product has a price and is **Published**, shoppers cannot buy it.

## 4. Find your way around

| Menu | What is in it |
|---|---|
| **VuloCart → Dashboard** | Sales figures, recent orders, stock health and what needs attention |
| **VuloCart → Reviews** | Product reviews waiting for you (appears while the Product Reviews module is on) |
| **VuloCart → Inventory / Shipment / AI / Workflows** | Screens that need a Pro module; without it they explain what is missing |
| **VuloCart → Settings** | General, Checkout, Payments, Shipping & Tax, Integrations, Advanced and Modules |
| **Products** | All products, Add New, Categories, Collections, Brands, Tags, Attributes, Product Types |
| **Orders** | All orders and Add New (for orders you take by phone or email) |
| **Customers** | Everyone who has bought, with their orders, addresses and notes |
| **Marketing** | Coupons, gift cards and recovery tools (VuloCart Pro) |

## 5. Ideas you will see everywhere

- **Product type.** What you sell. Each type asks only for the fields it needs: a course never asks for a package weight.
- **Status.** A product is *Draft* (hidden), *Published* (for sale) or *Archived*. An order has two statuses: **Payment** (Pending, Paid, Failed, Refunded) and **Fulfillment** (Draft, Pending, Processing, Shipped, Completed, Cancelled).
- **Order number.** Orders are numbered `VC-000001`, `VC-000002` and so on.
- **Modules.** Features you can switch on and off under Settings → Modules.
- **Autosave in Settings.** Settings save as soon as you change a field. There is no Save button.
- **Pro.** Features marked "Pro" need the VuloCart Pro plugin with an active license.

## 6. Where to go next

- [PRODUCTS](PRODUCTS.md) - add what you sell
- [PAYMENTS](PAYMENTS.md) and [SHIPPING-AND-TAX](SHIPPING-AND-TAX.md)
- [CHECKOUT](CHECKOUT.md) - put the store on your site
