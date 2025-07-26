export interface StripeSubscriptionData {
  id: string | null;
  priceId?: string | null;
}

// Dummy Stripe IDs since everyone is pro by default - Stripe not used
export const STRIPE_SUBSCRIPTION_DATA: StripeSubscriptionData = {
  "id": "prod_dummy_not_used",
  "priceId": "price_dummy_not_used"
};