import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { Order } from '../../db/types.js';
import { COLORS, CUSTOM_ID, ORDER_STATUS } from '../../utils/constants.js';
import { shortOrderId } from '../../services/order.service.js';
import { formatPrice } from './service-embed.js';

export function buildOrderAdminEmbed(order: Order, serviceName: string): EmbedBuilder {
  const statusColors: Record<string, number> = {
    [ORDER_STATUS.PENDING_PAYMENT]: COLORS.WARNING,
    [ORDER_STATUS.PAID]: COLORS.PAID,
    [ORDER_STATUS.IN_PROGRESS]: COLORS.IN_PROGRESS,
    [ORDER_STATUS.COMPLETED]: COLORS.COMPLETED,
    [ORDER_STATUS.CANCELLED]: COLORS.CANCELLED,
    [ORDER_STATUS.REFUNDED]: COLORS.REFUNDED,
  };

  const embed = new EmbedBuilder()
    .setTitle(`Order #${shortOrderId(order.id)}`)
    .setColor(statusColors[order.status] ?? COLORS.INFO)
    .addFields(
      { name: 'Customer', value: `<@${order.customer_discord_id}>`, inline: true },
      { name: 'Service', value: serviceName, inline: true },
      { name: 'Variant', value: order.selected_variant_name, inline: true },
      { name: 'Price', value: formatPrice(order.total_price, order.currency), inline: true },
      { name: 'Status', value: formatStatus(order.status), inline: true }
    )
    .setTimestamp(new Date(order.created_at));

  if (order.discount_amount > 0) {
    embed.addFields({ name: 'Discount Applied', value: `-${formatPrice(order.discount_amount, order.currency)}`, inline: true });
  }

  // Step responses
  if (order.step_responses.length > 0) {
    const responses = order.step_responses
      .map((r) => `**${r.prompt}**\n${r.answer}`)
      .join('\n\n');
    embed.addFields({ name: 'Customer Responses', value: responses.substring(0, 1024) });
  }

  return embed;
}

export function buildOrderAdminButtons(order: Order): ActionRowBuilder<ButtonBuilder> {
  const row = new ActionRowBuilder<ButtonBuilder>();

  if (order.status === ORDER_STATUS.PAID) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID.ADMIN_ACCEPT}:${order.id}`)
        .setLabel('Accept & Start')
        .setEmoji('▶️')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID.ADMIN_CANCEL}:${order.id}`)
        .setLabel('Cancel & Refund')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    );
  } else if (order.status === ORDER_STATUS.IN_PROGRESS) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID.ADMIN_COMPLETE}:${order.id}`)
        .setLabel('Mark Complete')
        .setEmoji('✅')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID.ADMIN_CANCEL}:${order.id}`)
        .setLabel('Cancel & Refund')
        .setEmoji('❌')
        .setStyle(ButtonStyle.Danger)
    );
  }

  return row;
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    pending_payment: '⏳ Pending Payment',
    paid: '💰 Paid',
    in_progress: '🔧 In Progress',
    completed: '✅ Completed',
    cancelled: '❌ Cancelled',
    refunded: '💸 Refunded',
  };
  return labels[status] || status;
}
