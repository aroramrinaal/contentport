/**
 * stripeRouter handles Stripe subscription and billing portal flows.
 *
 * - checkout_session: create/retrieve a Stripe Customer for the current user,
 *   persist the customer.id on the user record in the database, and
 *   return a Checkout Session URL for subscription purchase.
 *
 * - billing_portal: create/retrieve a Stripe Customer for the current user,
 *   persist the customer.id on the user record if needed, and
 *   return a Billing Portal session URL for managing existing subscriptions.
 */

import Stripe from 'stripe'
import { z } from 'zod'

import { db } from '@/db'
import { user } from '@/db/schema'
import { STRIPE_SUBSCRIPTION_DATA } from '@/constants/stripe-subscription'
import { eq } from 'drizzle-orm'
import { j, privateProcedure } from '../jstack'
import { getBaseUrl } from '@/constants/base-url'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
})

/**
 * Stripe Router
 * 
 * NOTE: All Stripe functionality disabled since everyone is pro by default
 * Functions return early with appropriate messages
 */
export const stripeRouter = j.router({
  /**
   * Initiate a Stripe Checkout Session for subscription purchase.
   * Ensures a Customer exists (creates one and updates user.stripeId in DB if missing).
   * @returns JSON with { url: string | null } for redirecting to Stripe Checkout.
   */
  checkout_session: privateProcedure
    .input(
      z.object({
        trial: z.boolean().optional(),
      }),
    )
    .query(async ({ c }) => {
      // Everyone is pro by default - no checkout needed
      return c.json({ 
        url: null,
        message: 'All users have pro access by default - no checkout needed'
      })
    }),

  /**
   * Create a Stripe Billing Portal session to allow the user to manage their subscription.
   * Ensures a Customer exists (creates one and updates user.stripeId in DB if missing).
   * @returns JSON with { url: string | null } for redirecting to Stripe Billing Portal.
   */
  billing_portal: privateProcedure.query(async ({ c }) => {
    // Everyone is pro by default - no billing portal needed
    return c.json({ 
      url: '/studio/settings',
      message: 'All users have pro access by default - no billing management needed'
    })
  }),

  subscription_product: privateProcedure.query(async ({ c }) => {
    // Everyone is pro by default - no subscription products needed
    return c.json({ 
      error: 'Subscription products not available - all users have pro access by default'
    })
  }),

  subscription: privateProcedure.query(async ({ c, ctx }) => {
    const { user } = ctx
    
    // Everyone is pro by default, so always return active
    return c.json({ status: 'active' })
  }),
})
