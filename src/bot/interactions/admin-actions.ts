import { type ButtonInteraction } from 'discord.js';
import { getOrder, updateOrder, shortOrderId } from '../../services/order.service.js';
import { getService } from '../../services/service.service.js';
import { getGuildConfig } from '../../services/guild.service.js';
import { createRefund } from '../../services/stripe.service.js';
import { buildOrderAdminEmbed, buildOrderAdminButtons } from '../embeds/order-embed.js';
import { buildStatusUpdateEmbed } from '../embeds/status-embed.js';
import { isAdminOrStaffForCategory } from '../../utils/permissions.js';
import { ORDER_STATUS } from '../../utils/constants.js';
import { logger } from '../../utils/logger.js';

function validateOrderGuild(order: { guild_id: string }, guildId: string): boolean {
  return order.guild_id === guildId;
}

/** Check permission: admin or staff for the order's service category */
async function checkOrderPermission(interaction: ButtonInteraction, orderId: string) {
  const order = await getOrder(orderId);
  if (!order || !validateOrderGuild(order, interaction.guildId!)) return { order: null, service: null };

  const service = await getService(order.service_id);
  const category = service?.category || 'General';

  const allowed = await isAdminOrStaffForCategory(interaction, category);
  if (!allowed) return { order: null, service: null };

  return { order, service };
}

export async function handleAdminAccept(interaction: ButtonInteraction) {
  const orderId = interaction.customId.split(':')[1];

  // Peek at order to check permission before deferring
  const { order, service } = await checkOrderPermission(interaction, orderId);
  if (!order) {
    await interaction.reply({ content: "You don't have permission or order not found.", ephemeral: true });
    return;
  }
  if (order.status !== ORDER_STATUS.PAID) {
    await interaction.reply({ content: 'Order cannot be accepted in its current state.', ephemeral: true });
    return;
  }

  await interaction.deferUpdate();

  const updated = await updateOrder(orderId, { status: ORDER_STATUS.IN_PROGRESS });

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
  const orderId = interaction.customId.split(':')[1];

  const { order, service } = await checkOrderPermission(interaction, orderId);
  if (!order) {
    await interaction.reply({ content: "You don't have permission or order not found.", ephemeral: true });
    return;
  }
  if (order.status !== ORDER_STATUS.IN_PROGRESS) {
    await interaction.reply({ content: 'Order cannot be completed in its current state.', ephemeral: true });
    return;
  }

  await interaction.deferUpdate();

  const updated = await updateOrder(orderId, { status: ORDER_STATUS.COMPLETED });

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

export async function handleAdminCancel(interaction: ButtonInteraction) {
  const orderId = interaction.customId.split(':')[1];

  const { order, service } = await checkOrderPermission(interaction, orderId);
  if (!order) {
    await interaction.reply({ content: "You don't have permission or order not found.", ephemeral: true });
    return;
  }
  if (order.status !== ORDER_STATUS.PAID && order.status !== ORDER_STATUS.IN_PROGRESS) {
    await interaction.reply({ content: 'Order cannot be cancelled/refunded in its current state.', ephemeral: true });
    return;
  }

  await interaction.deferUpdate();

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
      return;
    }
  }

  const updated = await updateOrder(orderId, { status: ORDER_STATUS.REFUNDED });

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
