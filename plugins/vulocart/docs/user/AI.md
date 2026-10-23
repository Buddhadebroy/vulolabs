# AI

## What it does

VuloCart's AI features run on **VuloCloud**. You connect your site to your VuloCloud account once, and every AI request is sent to VuloCloud, where it uses your Organization's AI key and credits. There is no API key to paste into your store and no AI provider to choose.

With the free plugin you get the connection and a usage log. The features themselves (the VuloCart AI chat, product drafting, fraud scoring, support assistants and smart search) come with **VuloCart Pro**.

## Why it matters

AI can draft product copy, spot risky orders and answer questions about your store in plain words. Because credits belong to your VuloCloud Organization, you see and control what is spent in one place.

## Connect your site

1. Go to **VuloCart → Settings → Modules** and make sure the **AI** card is switched on.
2. Go to **VuloCart → Settings → Integrations** and find the **VuloCloud AI** section. The status is one of:
   - **Not Connected** - nothing is connected yet.
   - **Connected** - AI requests run on your Organization's AI key and use your AI credits. Your remaining credits are shown ("AI credits remaining"), with a **Buy credits** link.
   - **Awaiting AI key** - the site is connected, but your Organization has not added an AI key yet. Ask your Organization to add one.
3. Press **Connect to VuloCloud**. You are sent to VuloCloud to approve the connection (no password is typed on your site) and then returned to the same screen with a message: "Connected to VuloCloud." or "Could not connect to VuloCloud. Please try again."
4. To stop, press **Disconnect**, then **Disconnect VuloCloud** to confirm. AI features stop working until you connect again.

If you see "VuloCloud isn't configured for this build yet", the site has no VuloCloud address configured; contact whoever supplied the plugin.

## The AI screen

**VuloCart → AI** (also called AI Copilot) is the home of the AI tools: **Chat with VuloCart AI**, **Create a product with AI**, **Checkout protection** and **Smart search**. The header shows **Online** when AI is connected and **Offline - connect AI** when it is not. Without the matching Pro modules the screen explains which module is missing.

## What the free plugin records

Every AI request is logged with the feature that made it, the number of tokens and whether it worked. Administrators can read the totals through the plugin's REST API (`GET /ai/usage`). Nothing from the log is sent anywhere.

## What is not available yet

The VuloCloud AI gateway does not offer **image generation** or **embeddings** yet. Features that depend on them report that the capability is not available:

- AI-generated product images (Catalog AI)
- Semantic search (Vector Search), which needs embeddings

Text features (descriptions, SEO, specifications, FAQs, translations, price suggestions, fraud second opinions, chat) are not affected.

## Related

- [SETTINGS](SETTINGS.md), [MODULES](MODULES.md)
- Pro: [AI features](../../../../../plugins/vulocart-pro/docs/user/AI.md)
