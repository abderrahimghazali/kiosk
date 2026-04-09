import type { Client, TextChannel } from 'discord.js';
import type { GuildConfig, Order } from '../../db/types.js';
import { getService } from '../../services/service.service.js';
import { updateOrder } from '../../services/order.service.js';
import { buildOrderAdminEmbed, buildOrderAdminButtons } from '../embeds/order-embed.js';
import { logger } from '../../utils/logger.js';

export async function notifyAdminOfPaidOrder(
  client: Client,
  guildConfig: GuildConfig,
  order: Order
): Promise<void> {
  if (!guildConfig.orders_channel_id) return;

  try {
    const channel = await client.channels.fetch(guildConfig.orders_channel_id) as TextChannel;
    const service = await getService(order.service_id);
    const embed = buildOrderAdminEmbed(order, service?.name || 'Unknown Service');
    const buttons = buildOrderAdminButtons(order);

    const msg = await channel.send({
      embeds: [embed],
      components: buttons.components.length > 0 ? [buttons] : [],
    });

    await updateOrder(order.id, { order_admin_message_id: msg.id });
  } catch (err) {
    logger.error('Failed to post order notification', { orderId: order.id, error: String(err) });
  }
}
