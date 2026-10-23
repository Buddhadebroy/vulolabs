/**
 * Importing this file (for its side effects only) registers the free plugin's five interactive checkout steps with
 * `registerCheckoutStep()` from registry.ts. Checkout.tsx imports it once before mounting CheckoutEngine.tsx.
 */
import './CustomerStep';
import './AddressStep';
import './ShippingStep';
import './PaymentStep';
import './ReviewStep';
import './ConfirmationStep';
