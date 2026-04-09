import { EmbedBuilder } from 'discord.js';
import { COLORS } from '../../utils/constants.js';
import { shortOrderId } from '../../services/order.service.js';

export function buildStatusUpdateEmbed(
  orderId: string,
  status: string,
  message: string
): EmbedBuilder {
  const statusColors: Record<string, number> = {
    paid: COLORS.PAID,
    in_progress: COLORS.IN_PROGRESS,
    completed: COLORS.COMPLETED,
    cancelled: COLORS.CANCELLED,
    refunded: COLORS.REFUNDED,
  };

  return new EmbedBuilder()
    .setTitle(`Order #${shortOrderId(orderId)} Update`)
    .setDescription(message)
    .setColor(statusColors[status] ?? COLORS.INFO)
    .setTimestamp();
}
