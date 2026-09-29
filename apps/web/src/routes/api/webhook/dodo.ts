import { createFileRoute } from '@tanstack/react-router'
import { db, subscription } from '#/db'
import { dodo } from '#/lib/payments/dodo'
import { eq } from 'drizzle-orm'
import type { UnwrapWebhookEvent } from 'dodopayments/resources/webhooks'

async function handle({ request }: { request: Request }) {
  try {
    const body = await request.text()

    // Convert Headers to plain object for dodopayments SDK
    const headersObj: Record<string, string> = {}
    request.headers.forEach((value, key) => {
      headersObj[key] = value
    })

    // Verify + parse webhook
    let event: UnwrapWebhookEvent
    try {
      event = dodo.webhooks.unwrap(body, { headers: headersObj })
    } catch (err) {
      console.error('[webhook] signature verification failed:', err)
      return new Response('Invalid signature', { status: 401 })
    }

    console.log('[webhook] received event:', event.type)

    switch (event.type) {
      case 'subscription.active': {
        const sub = event.data
        const userId = String(sub.metadata?.userId ?? '')
        if (!userId) {
          console.warn(
            '[webhook] subscription.active missing userId in metadata',
          )
          break
        }

        const planId = String(sub.metadata?.planId ?? 'starter')
        const interval = String(sub.metadata?.interval ?? 'monthly')

        // Upsert subscription
        const existingRows = await db
          .select()
          .from(subscription)
          .where(eq(subscription.dodoSubscriptionId, sub.subscription_id))
          .limit(1)
        const existing = existingRows[0]

        if (existing) {
          await db
            .update(subscription)
            .set({
              status: 'active',
              planId,
              billingInterval: interval,
              productId: sub.product_id,
              currentPeriodEnd: sub.next_billing_date ? new Date(sub.next_billing_date) : null,
              cancelAtNextBilling: sub.cancel_at_next_billing_date ?? false,
            })
            .where(eq(subscription.id, existing.id))
        } else {
          await db.insert(subscription).values({
            userId,
            dodoSubscriptionId: sub.subscription_id,
            dodoCustomerId: sub.customer?.customer_id ?? null,
            productId: sub.product_id,
            status: 'active',
            planId,
            billingInterval: interval,
            currentPeriodEnd: sub.next_billing_date ? new Date(sub.next_billing_date) : null,
            cancelAtNextBilling: sub.cancel_at_next_billing_date ?? false,
          })
        }
        break
      }

      case 'subscription.renewed': {
        const sub = event.data
        await db
          .update(subscription)
          .set({
            status: 'active',
            currentPeriodEnd: sub.next_billing_date ? new Date(sub.next_billing_date) : null,
            cancelAtNextBilling: sub.cancel_at_next_billing_date ?? false,
          })
          .where(eq(subscription.dodoSubscriptionId, sub.subscription_id))
        break
      }

      case 'subscription.plan_changed': {
        const sub = event.data
        const planId = String(sub.metadata?.planId ?? 'starter')
        const interval = String(sub.metadata?.interval ?? 'monthly')
        await db
          .update(subscription)
          .set({
            status: 'active',
            planId,
            billingInterval: interval,
            productId: sub.product_id,
            currentPeriodEnd: sub.next_billing_date ? new Date(sub.next_billing_date) : null,
          })
          .where(eq(subscription.dodoSubscriptionId, sub.subscription_id))
        break
      }

      case 'subscription.cancelled': {
        const sub = event.data
        await db
          .update(subscription)
          .set({ status: 'cancelled', cancelAtNextBilling: true })
          .where(eq(subscription.dodoSubscriptionId, sub.subscription_id))
        break
      }

      case 'subscription.expired': {
        const sub = event.data
        await db.update(subscription).set({ status: 'expired' }).where(eq(subscription.dodoSubscriptionId, sub.subscription_id))
        break
      }

      case 'subscription.on_hold': {
        const sub = event.data
        await db.update(subscription).set({ status: 'on_hold' }).where(eq(subscription.dodoSubscriptionId, sub.subscription_id))
        break
      }

      case 'subscription.failed': {
        const sub = event.data
        await db.update(subscription).set({ status: 'on_hold' }).where(eq(subscription.dodoSubscriptionId, sub.subscription_id))
        break
      }

      default:
        console.log('[webhook] unhandled event type:', (event as any).type)
    }

    return new Response('ok', { status: 200 })
  } catch (err) {
    console.error('[webhook] error:', err)
    return new Response('Internal error', { status: 500 })
  }
}

export const Route = createFileRoute('/api/webhook/dodo')({
  server: {
    handlers: {
      POST: handle,
    },
  },
})
