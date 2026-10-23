# Shipping and Tax

## What it does

Under **VuloCart → Settings → Shipping & Tax** you decide what shipping costs and how tax is charged. Both are worked out on the server when the order is placed, so a shopper cannot change them.

## Why it matters

Shipping and tax are part of the final price. Wrong settings mean orders that lose money or break the law. The Review step of the checkout shows the real total before the shopper pays.

Shipping and Taxes are optional modules. A store that does not ship, or does not charge tax, can switch them off under **Settings → Modules**.

## Shipping

### Flat rate

Go to **Settings → Shipping & Tax → Shipping rates**.

| Setting | What it does |
|---|---|
| **Flat rate shipping cost** | A single shipping charge added to every order. Leave it at **0** for free shipping. Switch the Shipping module off under Modules to stop offering shipping at all |

At checkout the shopper sees one method with this price. A cost of 0 is shown as free shipping.

### Zones, rates, packaging and labels (Pro)

With VuloCart Pro and the same Shipping card, you also get **Zones** (regions with their own rates), **weight rules**, **Packaging** presets, tracked shipments, label purchase, returns and local pickup. See the Pro guide on [shipping and fulfillment](../../../../../plugins/vulocart-pro/docs/user/SHIPPING-AND-FULFILLMENT.md).

## Tax

Go to **Settings → Shipping & Tax → Tax**.

### Calculation

| Setting | What it does |
|---|---|
| **Calculate tax based on** | Which address decides the tax: *Shipping address* (most places), *Billing address* (EU digital sales follow the buyer's billing country) or *Store address* |
| **Prices already include tax** | On: tax is taken out of the listed price and shown as "includes". Off: tax is added on top at checkout |
| **Charge tax on shipping** | Applies the Standard class's rates that are marked "Applies to shipping". Only once you have entered tax rates |

### Store address

| Setting | What it does |
|---|---|
| **Country** | Where you sell from. Used when tax is based on the store address, and when an order has no address yet |
| **State / region code** | The code your tax rates use, for example CA, NY or KA. Leave empty if you have none |

### Tax rates

The **Tax rates** panel is where you say what you charge in each place.

1. Press **+ Add rate** and enter: **Country** (or *Any country*), optionally **State** and **Postcode**, the **Rate %**, a **Name** (for example "VAT"), a **Priority**, and whether it **Applies to shipping**.
2. Where rates overlap, the most specific one wins (a postcode beats a state, a state beats a country).
3. Rates with **different priorities add together**. Use this for stacked taxes: a federal tax at priority 1 and a regional tax at priority 2 are both charged. India's CGST + SGST and Canada's GST + PST work this way. Each tax shows on its own line in the checkout summary.
4. **Delete rate** removes a rate.

### Start from a preset

Instead of typing rates, choose one under **Start from a preset** and press **Apply**: *EU VAT (27 countries)*, *United Kingdom VAT*, *India GST* (you pick the slab and your state code), *Australia GST*, *New Zealand GST*, *Singapore GST* and *Canada GST (federal only)*. A preset **replaces your Standard-class rates**. Rates change, so check them with your tax adviser.

### Tax classes

Some products are taxed differently, such as food or books.

1. Under **Tax classes** type a name (for example "Digital goods") and press **Add class**.
2. Pick the class and enter its rates.
3. On the product's edit page, choose that class. Products without a class use **Standard**. Deleting a class moves its products back to Standard.

### Flat rate (before you add rates)

If you have not entered any rates, the **Flat rate (%)** applies to every order. As soon as you add a rate, the flat rate stops being used. Leave it at 0 to charge no tax.

### Tax and Pro

VuloCart Pro can calculate tax automatically with **Stripe Tax**, and can remove the VAT for EU business buyers with a valid VAT number (**reverse charge**). See the Pro guide on [tax](../../../../../plugins/vulocart-pro/docs/user/TAX-AND-COMPLIANCE.md).

## Related

- [CHECKOUT](CHECKOUT.md), [ORDERS](ORDERS.md), [PRODUCTS](PRODUCTS.md)
