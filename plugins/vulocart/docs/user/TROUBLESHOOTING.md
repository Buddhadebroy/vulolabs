# Troubleshooting

## Shoppers cannot see the shop, cart or checkout

VuloCart does not create pages. Create the pages and insert the **Shop page**, **Cart page** and **Checkout page** patterns (category *VuloCart*). See [CHECKOUT](CHECKOUT.md).

## A product does not appear in the shop

A product is shown only when it is **Published**. Check on the product list that its status is Published, not Draft or Archived. A product with **No price** cannot be bought and shows "Cannot be bought yet".

## "Add to cart" opens the product page instead of adding it

That is intended when the shopper has to choose something first, for example a booking date or a price option. Types that can be bought in one tap (physical, digital, subscription and so on) with a single price are added directly.

## Product links give "page not found"

Go to **Settings → Permalinks** (WordPress) and press **Save Changes** once to refresh the link rules, or pick **Plain** product links (`?product=12`) in the VuloCart section. Plain links always work.

## Checkout shows no payment method

Switch on at least one method under **VuloCart → Settings → Payments**. The offline methods are offered as soon as they are switched on. An online gateway (Pro) is offered only once its keys are saved.

## Checkout shows no shipping method

The Shipping step shows only if the **Shipping** module is on and the step is enabled under **Settings → Checkout → Steps shown**. With Shipping on there is always at least one method: the flat rate (0 means free shipping).

## The tax is wrong

Check, in order: that the **Taxes** module is on; that a rate exists for the shopper's country, state or postcode; **Calculate tax based on** (shipping, billing or store address); and whether **Prices already include tax** is set the way you listed your prices. Remember that a preset replaces your Standard-class rates. See [SHIPPING-AND-TAX](SHIPPING-AND-TAX.md).

## An order is stuck on "Pending" payment

Bank transfer and cash on delivery stay Pending until you confirm. Open the order and set the **Payment** status to **Paid**. For online gateways (Pro), check that the gateway's webhook is set up with the gateway, because the final result arrives by webhook.

## A Pro screen says "Module required" or "License required"

The screen needs a VuloCart Pro module. Switch the module on under **Settings → Modules**, or activate your license under **Settings → Licensing**. If Pro is not installed the screen offers an upgrade.

## A module card switches itself off

A module whose files are missing cannot stay on, for example a Pro module after Pro was deactivated. Reinstall or reactivate the plugin that provides it and switch the card on again.

## AI says "Offline - connect AI"

Connect your site under **Settings → Integrations → VuloCloud AI**. See [AI](AI.md). If it says **Awaiting AI key**, your VuloCloud Organization has no AI key yet.

## Product reviews do not appear

Reviews are shown only after you approve them under **VuloCart → Reviews**. The screen exists while the **Product Reviews** module is on.

## Settings did not save

Settings save automatically as you change a field. If a message says it could not be saved, check that you are still logged in and that your host does not block the WordPress REST API (`/wp-json/vulocart/v1/`).

## Finding out what went wrong

Turn on **Settings → Advanced → Enable debug logging**, repeat the problem and read the **Debug log** shown on the same screen (use **Refresh** to see new entries). Turn logging off again afterwards.
