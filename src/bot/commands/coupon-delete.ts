import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { requireAdmin } from '../../utils/permissions.js';
import { getCouponsByGuild, deleteCoupon } from '../../services/coupon.service.js';

export const data = new SlashCommandBuilder()
  .setName('coupon-delete')
  .setDescription('Delete a coupon')
  .addStringOption((opt) =>
    opt.setName('code').setDescription('Coupon code to delete').setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!(await requireAdmin(interaction))) return;
  if (!interaction.guildId) return;

  await interaction.deferReply({ ephemeral: true });

  const code = interaction.options.getString('code', true).trim().toUpperCase();
  const coupons = await getCouponsByGuild(interaction.guildId);
  const coupon = coupons.find((c) => c.code.toUpperCase() === code);

  if (!coupon) {
    await interaction.editReply({ content: `Coupon \`${code}\` not found.` });
    return;
  }

  await deleteCoupon(coupon.id);
  await interaction.editReply({ content: `Coupon \`${code}\` deleted. It was used ${coupon.times_used} time(s).` });
}
