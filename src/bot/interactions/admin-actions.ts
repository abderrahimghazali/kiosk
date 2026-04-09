import { type ButtonInteraction } from 'discord.js';
import { getOrder, updateOrder, shortOrderId } from '../../services/order.service.js';
import { getService } from '../../services/service.service.js';
import { getGuildConfig } from '../../services/guild.service.js';
import { createRefund } from '../../services/stripe.service.js';
import { buildOrderAdminEmbed, buildOrderAdminButtons } from '../embeds/order-embed.js';
import { buildStatusUpdateEmbed } from '../embeds/status-embed.js';
import { isAdmin } from '../../utils/permissions.js';
import { ORDER_STATUS } from '../../utils/constants.js';
import { logger } from '../../utils/logger.js';

// Fix #20: Validate order belongs to the current guild
function validateOrderGuild(order: { guild_id: string }, guildId: string): boolean {
  return order.guild_id === guildId;
}

export async function handleAdminAccept(interaction: ButtonInteraction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: "You don't have permission.", ephemeral: true });
    return;
  }

  const orderId = interaction.customId.split(':')[1];
  await interaction.deferUpdate();

  const order = await getOrder(orderId);
  if (!order || !validateOrderGuild(order, interaction.guildId!) || order.status !== ORDER_STATUS.PAID) {
    await interaction.followUp({ content: 'Order cannot be accepted in its current state.', ephemeral: true });
    return;
  }

  const updated = await updateOrder(orderId, { status: ORDER_STATUS.IN_PROGRESS });
  const service = await getService(updated.service_id);

  const embed = buildOrderAdminEmbed(updated, service?.name || 'Unknown');
  const buttons = buildOrderAdminButtons(updated);
  await interaction.editReply({
    embeds: [embed],
    components: buttons.components.length > 0 ? [buttons] : [],
  });

  try {
    const user = await interaction.client.users.fetch(updated.customer_discord_id);
    const dmEmbed = buildStatusUpdateEmbed(
      orderId,
      ORDER_STATUS.IN_PROGRESS,
      `Your order **#${shortOrderId(orderId)}** has been accepted and is now being worked on!`
    );
    await user.send({ embeds: [dmEmbed] });
  } catch {
    logger.warn('Could not DM customer', { orderId });
  }
}

export async function handleAdminComplete(interaction: ButtonInteraction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: "You don't have permission.", ephemeral: true });
    return;
  }

  const orderId = interaction.customId.split(':')[1];
  await interaction.deferUpdate();

  const order = await getOrder(orderId);
  if (!order || !validateOrderGuild(order, interaction.guildId!) || order.status !== ORDER_STATUS.IN_PROGRESS) {
    await interaction.followUp({ content: 'Order cannot be completed in its current state.', ephemeral: true });
    return;
  }

  const updated = await updateOrder(orderId, { status: ORDER_STATUS.COMPLETED });
  const service = await getService(updated.service_id);

  const embed = buildOrderAdminEmbed(updated, service?.name || 'Unknown');
  await interaction.editReply({ embeds: [embed], components: [] });

  try {
    const user = await interaction.client.users.fetch(updated.customer_discord_id);
    const dmEmbed = buildStatusUpdateEmbed(
      orderId,
      ORDER_STATUS.COMPLETED,
      `Your order **#${shortOrderId(orderId)}** has been completed! Thank you for your purchase.`
    );
    await user.send({ embeds: [dmEmbed] });
  } catch {
    logger.warn('Could not DM customer', { orderId });
  }
}

// Fix #4: Refund failure now stops the status update
export async function handleAdminCancel(interaction: ButtonInteraction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: "You don't have permission.", ephemeral: true });
    return;
  }

  const orderId = interaction.customId.split(':')[1];
  await interaction.deferUpdate();

  const order = await getOrder(orderId);
  if (!order || !validateOrderGuild(order, interaction.guildId!) || (order.status !== ORDER_STATUS.PAID && order.status !== ORDER_STATUS.IN_PROGRESS)) {
    await interaction.followUp({ content: 'Order cannot be cancelled/refunded in its current state.', ephemeral: true });
    return;
  }

  // Process Stripe refund — abort if it fails
  if (order.stripe_payment_intent_id) {
    try {
      const guildConfig = await getGuildConfig(order.guild_id);
      if (guildConfig) {
        await createRefund(guildConfig, order.stripe_payment_intent_id);
      }
    } catch (err) {
      logger.error('Refund failed', { orderId, error: String(err) });
      await interaction.followUp({
        content: 'Stripe refund failed. Order status unchanged. Please process the refund manually in Stripe Dashboard.',
        ephemeral: true,
      });
      return; // Do NOT update status if refund failed
    }
  }

  const updated = await updateOrder(orderId, { status: ORDER_STATUS.REFUNDED });
  const service = await getService(updated.service_id);

  const embed = buildOrderAdminEmbed(updated, service?.name || 'Unknown');
  await interaction.editReply({ embeds: [embed], components: [] });

  try {
    const user = await interaction.client.users.fetch(updated.customer_discord_id);
    const dmEmbed = buildStatusUpdateEmbed(
      orderId,
      ORDER_STATUS.REFUNDED,
      `Your order **#${shortOrderId(orderId)}** has been cancelled and refunded.`
    );
    await user.send({ embeds: [dmEmbed] });
  } catch {
    logger.warn('Could not DM customer', { orderId });
  }
}
