import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { requireAdmin } from '../../utils/permissions.js';
import { getOrdersByGuild, getOrder, shortOrderId } from '../../services/order.service.js';
import { getService } from '../../services/service.service.js';
import { buildOrderAdminEmbed } from '../embeds/order-embed.js';
import { COLORS } from '../../utils/constants.js';
import { formatPrice } from '../embeds/service-embed.js';

export const data = new SlashCommandBuilder()
  .setName('orders')
  .setDescription('View and manage orders')
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('List orders')
      .addStringOption((opt) =>
        opt
          .setName('status')
          .setDescription('Filter by status')
          .setRequired(false)
          .addChoices(
            { name: 'Pending Payment', value: 'pending_payment' },
            { name: 'Paid', value: 'paid' },
            { name: 'In Progress', value: 'in_progress' },
            { name: 'Completed', value: 'completed' },
            { name: 'Cancelled', value: 'cancelled' },
            { name: 'Refunded', value: 'refunded' }
          )
      )
      .addUserOption((opt) =>
        opt.setName('customer').setDescription('Filter by customer').setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('view')
      .setDescription('View order details')
      .addStringOption((opt) =>
        opt.setName('order_id').setDescription('Order ID (first 8 chars)').setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!(await requireAdmin(interaction))) return;
  if (!interaction.guildId) return;

  await interaction.deferReply({ ephemeral: true });

  const sub = interaction.options.getSubcommand();

  if (sub === 'view') {
    const partialId = interaction.options.getString('order_id', true);
    // Fetch orders and find by partial ID
    const orders = await getOrdersByGuild(interaction.guildId, {}, 100);
    const order = orders.find((o) => o.id.startsWith(partialId) || shortOrderId(o.id) === partialId.toUpperCase());

    if (!order) {
      await interaction.editReply({ content: `Order not found with ID \`${partialId}\`.` });
      return;
    }

    const service = await getService(order.service_id);
    const embed = buildOrderAdminEmbed(order, service?.name || 'Unknown Service');
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // List
  const status = interaction.options.getString('status') || undefined;
  const customer = interaction.options.getUser('customer');
  const orders = await getOrdersByGuild(interaction.guildId, {
    status,
    customer_discord_id: customer?.id,
  });

  if (orders.length === 0) {
    await interaction.editReply({ content: 'No orders found with the given filters.' });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('Orders')
    .setColor(COLORS.INFO)
    .setDescription(`Showing ${orders.length} order(s)`);

  for (const order of orders.slice(0, 25)) {
    const statusEmojis: Record<string, string> = {
      pending_payment: '⏳',
      paid: '💰',
      in_progress: '🔧',
      completed: '✅',
      cancelled: '❌',
      refunded: '💸',
    };
    embed.addFields({
      name: `#${shortOrderId(order.id)} ${statusEmojis[order.status] || ''}`,
      value: `<@${order.customer_discord_id}> — ${order.selected_variant_name} — ${formatPrice(order.total_price, order.currency)}`,
      inline: false,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}
