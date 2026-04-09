import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Client, TextChannel } from 'discord.js';
import Stripe from 'stripe';
import { getGuildConfig } from '../../services/guild.service.js';
import { getOrder, updateOrder, transitionOrderStatus, shortOrderId } from '../../services/order.service.js';
import { getService } from '../../services/service.service.js';
import { buildOrderAdminEmbed, buildOrderAdminButtons } from '../../bot/embeds/order-embed.js';
import { buildStatusUpdateEmbed } from '../../bot/embeds/status-embed.js';
import { ORDER_STATUS } from '../../utils/constants.js';
import { logger } from '../../utils/logger.js';

export function registerStripeWebhook(server: FastifyInstance, discordClient: Client) {
  // Need raw body for Stripe signature verification
  server.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body);
    }
  );

  server.post<{ Params: { guildId: string } }>(
    '/webhooks/stripe/:guildId',
    async (request: FastifyRequest<{ Params: { guildId: string } }>, reply: FastifyReply) => {
      const { guildId } = request.params;
      const signature = request.headers['stripe-signature'] as string;

      if (!signature) {
        return reply.status(400).send({ error: 'Missing stripe-signature header' });
      }

      const guildConfig = await getGuildConfig(guildId);
      if (!guildConfig) {
        return reply.status(404).send({ error: 'Guild not found' });
      }

      let event: Stripe.Event;
      try {
        const stripe = new Stripe(guildConfig.stripe_secret_key, { apiVersion: '2025-02-24.acacia' });
        event = stripe.webhooks.constructEvent(
          request.body as Buffer,
          signature,
          guildConfig.stripe_webhook_secret
        );
      } catch (err) {
        logger.error('Webhook signature verification failed', { error: String(err), guildId });
        return reply.status(400).send({ error: 'Invalid signature' });
      }

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const orderId = session.metadata?.order_id;

        if (!orderId) {
          logger.warn('Checkout session missing order_id metadata', { sessionId: session.id });
          return reply.status(200).send({ received: true });
        }

        try {
          // Atomic: only updates if order is still pending_payment (prevents duplicates)
          const updated = await transitionOrderStatus(orderId, ORDER_STATUS.PENDING_PAYMENT, {
            status: ORDER_STATUS.PAID,
            stripe_payment_intent_id: session.payment_intent as string,
          });

          if (!updated) {
            logger.info('Order already processed or not found, skipping', { orderId });
            return reply.status(200).send({ received: true });
          }

          // Post order notification in admin orders channel
          if (guildConfig.orders_channel_id) {
            try {
              const channel = await discordClient.channels.fetch(guildConfig.orders_channel_id) as TextChannel;
              const service = await getService(updated.service_id);
              const embed = buildOrderAdminEmbed(updated, service?.name || 'Unknown Service');
              const buttons = buildOrderAdminButtons(updated);

              const msg = await channel.send({
                embeds: [embed],
                components: buttons.components.length > 0 ? [buttons] : [],
              });

              await updateOrder(orderId, { order_admin_message_id: msg.id });
            } catch (err) {
              logger.error('Failed to post order notification', { orderId, error: String(err) });
            }
          }

          // DM the customer
          try {
            const user = await discordClient.users.fetch(updated.customer_discord_id);
            const dmEmbed = buildStatusUpdateEmbed(
              orderId,
              ORDER_STATUS.PAID,
              `Payment received! Your order **#${shortOrderId(orderId)}** is being processed.`
            );
            await user.send({ embeds: [dmEmbed] });
          } catch {
            logger.warn('Could not DM customer about payment', { orderId });
          }

          logger.info('Payment completed', { orderId, guildId });
        } catch (err) {
          logger.error('Error processing checkout.session.completed', { orderId, error: String(err) });
          return reply.status(500).send({ error: 'Processing failed' });
        }
      }

      return reply.status(200).send({ received: true });
    }
  );

  // Payment result pages
  server.get('/payment/success', async (_req, reply) => {
    return reply.status(200).type('text/html').send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Payment Successful</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#1a1a2e;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}.card{text-align:center;background:#16213e;border-radius:16px;padding:48px;max-width:420px;box-shadow:0 8px 32px rgba(0,0,0,.3)}.icon{font-size:64px;margin-bottom:16px}h1{font-size:24px;margin-bottom:12px;color:#57f287}p{color:#a0a0b8;font-size:16px;line-height:1.5}</style>
</head><body><div class="card"><div class="icon">&#10003;</div><h1>Payment Successful</h1><p>Your order has been received.<br>You can close this page and return to Discord.</p></div></body></html>`);
  });

  server.get('/payment/cancelled', async (_req, reply) => {
    return reply.status(200).type('text/html').send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Payment Cancelled</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#1a1a2e;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}.card{text-align:center;background:#16213e;border-radius:16px;padding:48px;max-width:420px;box-shadow:0 8px 32px rgba(0,0,0,.3)}.icon{font-size:64px;margin-bottom:16px}h1{font-size:24px;margin-bottom:12px;color:#ed4245}p{color:#a0a0b8;font-size:16px;line-height:1.5}</style>
</head><body><div class="card"><div class="icon">&#10007;</div><h1>Payment Cancelled</h1><p>Your payment was cancelled.<br>Return to Discord to try again.</p></div></body></html>`);
  });
}
