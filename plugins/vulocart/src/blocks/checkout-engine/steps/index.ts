/**
 * Importing this file (side-effect only, no exports used) registers
 * Free's own five interactive checkout steps into registry.ts's
 * `registerCheckoutStep()` — Checkout.tsx imports this once before
 * mounting CheckoutEngine.tsx. See registry.ts's own docblock for why
 * this is one barrel file today rather than each step being its own
 * separately-loaded bundle.
 */
import './CustomerStep';
import './AddressStep';
import './ShippingStep';
import './PaymentStep';
import './ReviewStep';
import './ConfirmationStep';
