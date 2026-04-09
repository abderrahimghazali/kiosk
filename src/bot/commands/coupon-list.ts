import { SlashCommandBuilder, EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { requireAdmin } from '../../utils/permissions.js';
import { getCouponsByGuild } from '../../services/coupon.service.js';
import { getGuildConfig } from '../../services/guild.service.js';
import { COLORS } from '../../utils/constants.js';
import { formatPrice } from '../embeds/service-embed.js';

export const data = new SlashCommandBuilder()
  .setName('coupon-list')
  .setDescription('List all coupons');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!(await requireAdmin(interaction))) return;
  if (!interaction.guildId) return;

  await interaction.deferReply({ ephemeral: true });

  const coupons = await getCouponsByGuild(interaction.guildId);
  const guildConfig = await getGuildConfig(interaction.guildId);
  const currency = guildConfig?.currency || 'eur';

  if (coupons.length === 0) {
    await interaction.editReply({ content: 'No coupons found. Use `/coupon-create` to add one.' });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('Coupons')
    .setColor(COLORS.INFO)
    .setDescription(`${coupons.length} coupon(s)`);

  for (const c of coupons.slice(0, 25)) {
    const valueStr = c.discount_type === 'percentage'
      ? `${c.discount_value}% off`
      : `${formatPrice(c.discount_value, currency)} off`;
    const uses = c.max_uses ? `${c.times_used}/${c.max_uses}` : `${c.times_used}/unlimited`;
    const status = c.is_active ? '🟢' : '🔴';
    const expiry = c.expires_at
      ? new Date(c.expires_at) < new Date() ? '(expired)' : `expires <t:${Math.floor(new Date(c.expires_at).getTime() / 1000)}:R>`
      : '';

    embed.addFields({
      name: `${status} ${c.code}`,
      value: `${valueStr} | Uses: ${uses} ${expiry}${c.service_id ? ` | Service: \`${c.service_id.slice(0, 8)}\`` : ''}`,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}
