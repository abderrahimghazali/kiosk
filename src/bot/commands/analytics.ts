import { SlashCommandBuilder, EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { requireAdmin } from '../../utils/permissions.js';
import { getAnalytics } from '../../services/analytics.service.js';
import { getGuildConfig } from '../../services/guild.service.js';
import { COLORS } from '../../utils/constants.js';
import { formatPrice } from '../embeds/service-embed.js';

export const data = new SlashCommandBuilder()
  .setName('analytics')
  .setDescription('View marketplace analytics and revenue stats')
  .addStringOption((opt) =>
    opt
      .setName('period')
      .setDescription('Time period')
      .setRequired(false)
      .addChoices(
        { name: 'Last 7 days', value: '7' },
        { name: 'Last 30 days', value: '30' },
        { name: 'Last 90 days', value: '90' },
        { name: 'All time', value: '3650' }
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!(await requireAdmin(interaction))) return;
  if (!interaction.guildId) return;

  await interaction.deferReply({ ephemeral: true });

  const periodDays = parseInt(interaction.options.getString('period') || '30');
  const guildConfig = await getGuildConfig(interaction.guildId);
  const currency = guildConfig?.currency || 'eur';

  const stats = await getAnalytics(interaction.guildId, periodDays);

  // Main overview embed
  const overview = new EmbedBuilder()
    .setTitle(`Analytics — ${stats.period}`)
    .setColor(COLORS.PRIMARY)
    .setTimestamp();

  // Revenue bar (visual indicator)
  const revenueStr = formatPrice(stats.totalRevenue, currency);
  const avgStr = formatPrice(stats.averageOrderValue, currency);

  overview.addFields(
    { name: 'Revenue', value: `**${revenueStr}**`, inline: true },
    { name: 'Avg Order Value', value: avgStr, inline: true },
    { name: 'Discounts Given', value: stats.totalDiscounts > 0 ? `-${formatPrice(stats.totalDiscounts, currency)}` : 'None', inline: true },
    { name: 'Total Orders', value: String(stats.totalOrders), inline: true },
    { name: 'Completed', value: String(stats.completedOrders), inline: true },
    { name: 'Unique Customers', value: String(stats.uniqueCustomers), inline: true }
  );

  // Status breakdown
  const statusEmojis: Record<string, string> = {
    pending_payment: '⏳',
    paid: '💰',
    in_progress: '🔧',
    completed: '✅',
    cancelled: '❌',
    refunded: '💸',
  };
  const statusLines = Object.entries(stats.statusBreakdown)
    .map(([status, count]) => `${statusEmojis[status] || ''} ${status.replace('_', ' ')}: **${count}**`)
    .join('\n');

  if (statusLines) {
    overview.addFields({ name: 'Order Status Breakdown', value: statusLines });
  }

  const embeds: EmbedBuilder[] = [overview];

  // Top services embed
  if (stats.topServices.length > 0) {
    const servicesEmbed = new EmbedBuilder()
      .setTitle('Top Services')
      .setColor(COLORS.INFO);

    const serviceLines = stats.topServices.map((s, i) => {
      const medal = ['🥇', '🥈', '🥉', '4.', '5.'][i];
      return `${medal} **${s.name}** — ${s.orders} order${s.orders > 1 ? 's' : ''} — ${formatPrice(s.revenue, currency)}`;
    });
    servicesEmbed.setDescription(serviceLines.join('\n'));
    embeds.push(servicesEmbed);
  }

  // Top customers embed
  if (stats.topCustomers.length > 0) {
    const customersEmbed = new EmbedBuilder()
      .setTitle('Top Customers')
      .setColor(COLORS.INFO);

    const customerLines = stats.topCustomers.map((c, i) => {
      const medal = ['🥇', '🥈', '🥉', '4.', '5.'][i];
      return `${medal} <@${c.id}> — ${c.orders} order${c.orders > 1 ? 's' : ''} — ${formatPrice(c.spent, currency)}`;
    });
    customersEmbed.setDescription(customerLines.join('\n'));
    embeds.push(customersEmbed);
  }

  // Revenue trend (last days as a text chart)
  if (stats.revenueByDay.length > 1) {
    const trendEmbed = new EmbedBuilder()
      .setTitle('Revenue Trend')
      .setColor(COLORS.SUCCESS);

    const maxRevenue = Math.max(...stats.revenueByDay.map((d) => d.revenue));
    const barWidth = 12;

    const trendLines = stats.revenueByDay.slice(-14).map((d) => {
      const barLen = maxRevenue > 0 ? Math.round((d.revenue / maxRevenue) * barWidth) : 0;
      const bar = '█'.repeat(barLen) + '░'.repeat(barWidth - barLen);
      const dateShort = d.date.substring(5); // MM-DD
      return `\`${dateShort}\` ${bar} ${formatPrice(d.revenue, currency)} (${d.orders})`;
    });

    trendEmbed.setDescription(trendLines.join('\n'));
    trendEmbed.setFooter({ text: 'Showing last 14 days of the selected period' });
    embeds.push(trendEmbed);
  }

  await interaction.editReply({ embeds });
}
