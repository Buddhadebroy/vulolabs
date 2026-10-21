# Shop, Cart and Checkout

## What it does

This is the part your shoppers see: a **shop** that lists your products, a **product page**, a **cart**, a **checkout** and an **order tracking** page. They are built from WordPress blocks, so you place them on your own pages and style them with your theme.

## Why it matters

Nothing is shown to shoppers until you put these blocks on a page. VuloCart does not create pages for you.

## Put the store on your site

1. Go to **Pages → Add New** and create a page called "Shop".
2. In the editor press **+**, open **Patterns**, choose the **VuloCart** category and insert **Shop page**. It adds a heading, filters, the product grid and pagination.
3. Create a page called "Cart" and insert the **Cart page** pattern (it contains the *Cart* block).
4. Create a page called "Checkout" and insert the **Checkout page** pattern (the *VuloCart Checkout* block).
5. Optionally create a "Track my order" page with the **VuloCart Order Tracking** block, and put the **Cart Link** block (a bag icon with the number of items) in your header or menu.

In a block theme you can also use the templates **Shop**, **Cart** and **Checkout** (Appearance → Editor → Templates): they put VuloCart between your theme's header and footer.

Everything is server-rendered and takes its fonts and colours from your theme.

### How shoppers move around

- The shop page lists products. Shoppers can **search**, filter by **category**, **sort** (Newest, Price low to high, Price high to low, Name A to Z) and page through results. Every choice is in the address bar, so a filtered view can be shared.
- Clicking a product opens its page on the same shop page. Product addresses look like `/shop/blue-bottle/`. You can change this under **Settings → Permalinks** (WordPress's own Permalinks screen has a VuloCart section): pretty links on the shop page, a base of your choice such as `/product/blue-bottle/`, or plain `?product=12`. Old plain links keep working and forward to the pretty address.
- **Add to cart** adds the product in one tap, or opens the product page when the shopper has to choose first (for example a booking date or a price option).
- The cart shows items, quantities and an order summary with a **Checkout** button. A guest's cart is remembered in their browser.

## Product page blocks

The product page is made of blocks you can rearrange in the editor: gallery, title, price, purchase options with quantity and buy button, stock, reassurance notes, facts (SKU, brand, collection, type), description, specifications and questions, breadcrumbs. Extensions, such as the Digital Product Passport (Pro), add their own sections.

## The checkout

The checkout is a sequence of steps. By default it shows them one at a time:

| Step | What the shopper does |
|---|---|
| **Customer** | Gives an email (and optionally name and phone). A signed-in shopper is prefilled |
| **Address** | Enters billing and shipping addresses. The checkout warns about missing fields |
| **Shipping** | Chooses a shipping method |
| **Payment** | Chooses how to pay |
| **Review** | Sees the final total with shipping and tax, then presses **Place order** |
| **Confirmation** | A thank-you page with the order number and, for bank transfer, your instructions |

You can change how it works under **Settings → Checkout**.

### Settings explained

The Checkout tab has four sections.

**How checkout opens**

| Setting | What it does | Why you might change it |
|---|---|---|
| **Open checkout as** | Where "Proceed to checkout" and "Buy now" lead: *Checkout page* by default. Pro adds *Popup*, *Side drawer*, *Hosted page* and *One-click* | Keep shoppers on the product page with a popup |
| **Layout** | *One step at a time* or *Everything on one page* | One page is faster for short checkouts |

**What shoppers fill in**

| Setting | What it does | Why you might change it |
|---|---|---|
| **Steps** | Untick the steps you can skip: Address, Shipping, Review. Customer and Payment are always part of checkout | A digital store does not need Address or Shipping |
| **Phone number** | *Do not ask*, *Ask, but optional* or *Required* | Couriers that need to call |
| **Other details to ask for** | Name, Apartment/suite | Ask for less |
| **Extras (Pro)** | Order notes, Address lookup | Let buyers leave a message; suggest addresses while they type |

**Who can buy**

| Setting | What it does | Why you might change it |
|---|---|---|
| **Allow guest checkout** | Shoppers can order with just an email address | Turn off to require an account |
| **Ask shoppers to accept your terms** and **Terms & conditions page** | A checkbox the shopper must tick, linked to your terms page | Legal requirement |

**Carts**

| Setting | What it does | Why you might change it |
|---|---|---|
| **Keep abandoned carts for (days)** | After this many days without activity a cart is deleted (default 14) | Keep carts longer for slow-moving products |

A checkout block can also override the layout, steps and fields for its own page (select the block and turn on *Customize*).

## Checkout on any website

You are not limited to your WordPress pages. The JavaScript SDK puts a Buy button, a cart and a full checkout on **any website**, WordPress or not. See [SELL-ANYWHERE](SELL-ANYWHERE.md).

## Track an order

A guest enters the **order number** and the **access token** they received to see their order's status. Both are needed; the number alone is not enough. Customers get both in their order confirmation email.

## Related

- [PAYMENTS](PAYMENTS.md), [SHIPPING-AND-TAX](SHIPPING-AND-TAX.md), [SETTINGS](SETTINGS.md)
