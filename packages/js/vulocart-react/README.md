# @vulocart/react

React components for `@vulocart/sdk`: `<BuyButton>`, `<EmbeddedCart>`, `<EmbeddedCheckout>`.

## React

```tsx
import { VuloCartProvider, BuyButton } from '@vulocart/react';

function App() {
	return (
		<VuloCartProvider storeUrl="https://yourstore.com">
			<BuyButton offeringId={ 123 }>Buy Now</BuyButton>
		</VuloCartProvider>
	);
}
```

## Next.js

This package (like `@vulocart/sdk` underneath it) touches `window`/`document` and has no SSR-safe mode — it has to run in a Client Component:

```tsx
// app/checkout/BuyButtonClient.tsx
'use client';

import { VuloCartProvider, BuyButton } from '@vulocart/react';

export function BuyButtonClient() {
	return (
		<VuloCartProvider storeUrl={ process.env.NEXT_PUBLIC_VULOCART_STORE_URL! }>
			<BuyButton offeringId={ 123 } />
		</VuloCartProvider>
	);
}
```

Then import `BuyButtonClient` from a Server Component as normal. If you'd rather keep `VuloCartProvider` mounted once near the root instead of per-page, that's also fine — it's a plain React context provider, same rules as any other.

## Vue

Not built yet. `@vulocart/sdk`'s vanilla core (imperative `mountBuyButton()`/`mountEmbeddedCart()`/`mountEmbeddedCheckout()` functions, or the `data-vulocart-*` auto-init attributes) works in a Vue app today without a dedicated adapter; a `@vulocart/vue` package wrapping those in Vue's own component/composable idioms is the natural next step, not built in this pass.
