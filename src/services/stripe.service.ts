import Stripe from 'stripe';
import type { GuildConfig } from '../db/types.js';

// Cache Stripe clients per guild to avoid re-instantiation
const stripeClients = new Map<string, Stripe>();

export function getStripeClient(guildConfig: GuildConfig): Stripe {
  let client = stripeClients.get(guildConfig.guild_id);
  if (!client) {
    client = new Stripe(guildConfig.stripe_secret_key, { apiVersion: '2025-02-24.acacia' });
    stripeClients.set(guildConfig.guild_id, client);
  }
  return client;
}

export function clearStripeClient(guildId: string): void {
  stripeClients.delete(guildId);
}

export async function createCheckoutSession(
  guildConfig: GuildConfig,
  params: {
    serviceName: string;
    variantName: string;
    description: string;
    priceInCents: number;
    orderId: string;
    customerDiscordId: string;
  }
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient(guildConfig);
  const webhookBaseUrl = process.env.WEBHOOK_BASE_URL || 'http://localhost:3000';

  return stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: guildConfig.currency,
          product_data: {
            name: `${params.serviceName} — ${params.variantName}`,
            description: params.description.substring(0, 500),
          },
          unit_amount: params.priceInCents,
        },
        quantity: 1,
      },
    ],
    metadata: {
      order_id: params.orderId,
      guild_id: guildConfig.guild_id,
      customer_discord_id: params.customerDiscordId,
    },
    success_url: `${webhookBaseUrl}/payment/success?order_id=${params.orderId}`,
    cancel_url: `${webhookBaseUrl}/payment/cancelled?order_id=${params.orderId}`,
  });
}

export async function createRefund(
  guildConfig: GuildConfig,
  paymentIntentId: string
): Promise<Stripe.Refund> {
  const stripe = getStripeClient(guildConfig);
  return stripe.refunds.create({ payment_intent: paymentIntentId });
}

