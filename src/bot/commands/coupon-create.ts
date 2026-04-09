import { SlashCommandBuilder, EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { requireAdmin } from '../../utils/permissions.js';
import { createCoupon } from '../../services/coupon.service.js';
import { getServicesByGuild } from '../../services/service.service.js';
import { getGuildConfig } from '../../services/guild.service.js';
import { COLORS } from '../../utils/constants.js';
import { formatPrice } from '../embeds/service-embed.js';

export const data = new SlashCommandBuilder()
  .setName('coupon-create')
  .setDescription('Create a discount coupon')
  .addStringOption((opt) =>
    opt.setName('code').setDescription('Coupon code (e.g. SAVE20)').setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName('type')
      .setDescription('Discount type')
      .setRequired(true)
      .addChoices(
        { name: 'Percentage (%)', value: 'percentage' },
        { name: 'Fixed amount', value: 'fixed' }
      )
  )
  .addNumberOption((opt) =>
    opt.setName('value').setDescription('Discount value (e.g. 20 for 20% or 5.00 for fixed)').setRequired(true)
  )
  .addIntegerOption((opt) =>
    opt.setName('max_uses').setDescription('Maximum number of uses (leave empty for unlimited)').setRequired(false)
  )
  .addIntegerOption((opt) =>
    opt.setName('expires_in_days').setDescription('Days until expiry (leave empty for no expiry)').setRequired(false)
  )
  .addStringOption((opt) =>
    opt.setName('service_id').setDescription('Restrict to a service (first 8 chars of ID)').setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!(await requireAdmin(interaction))) return;
  if (!interaction.guildId) return;

  await interaction.deferReply({ ephemeral: true });

  const code = interaction.options.getString('code', true).trim().toUpperCase();
  const discountType = interaction.options.getString('type', true) as 'percentage' | 'fixed';
  const rawValue = interaction.options.getNumber('value', true);
  const maxUses = interaction.options.getInteger('max_uses') ?? undefined;
  const expiresInDays = interaction.options.getInteger('expires_in_days');
  const servicePartialId = interaction.options.getString('service_id');

  // Validate code
  if (!/^[A-Z0-9]{2,20}$/.test(code)) {
    await interaction.editReply({ content: 'Coupon code must be 2-20 alphanumeric characters.' });
    return;
  }

  // Validate value
  if (discountType === 'percentage' && (rawValue <= 0 || rawValue > 100)) {
    await interaction.editReply({ content: 'Percentage must be between 1 and 100.' });
    return;
  }
  if (discountType === 'fixed' && rawValue <= 0) {
    await interaction.editReply({ content: 'Fixed amount must be greater than 0.' });
    return;
  }

  const discountValue = discountType === 'fixed' ? Math.round(rawValue * 100) : Math.round(rawValue);

  // Resolve service restriction
  let serviceId: string | undefined;
  if (servicePartialId) {
    const services = await getServicesByGuild(interaction.guildId);
    const match = services.find((s) => s.id.startsWith(servicePartialId));
    if (!match) {
      await interaction.editReply({ content: `Service not found with ID starting with \`${servicePartialId}\`.` });
      return;
    }
    serviceId = match.id;
  }

  // Compute expiry
  let expiresAt: string | undefined;
  if (expiresInDays && expiresInDays > 0) {
    const d = new Date();
    d.setDate(d.getDate() + expiresInDays);
    expiresAt = d.toISOString();
  }

  try {
    const coupon = await createCoupon({
      guild_id: interaction.guildId,
      code,
      discount_type: discountType,
      discount_value: discountValue,
      max_uses: maxUses,
      service_id: serviceId,
      expires_at: expiresAt,
    });

    const guildConfig = await getGuildConfig(interaction.guildId);
    const currency = guildConfig?.currency || 'eur';

    const valueDisplay = discountType === 'percentage'
      ? `${discountValue}%`
      : formatPrice(discountValue, currency);

    const embed = new EmbedBuilder()
      .setTitle('Coupon Created')
      .setColor(COLORS.SUCCESS)
      .addFields(
        { name: 'Code', value: `\`${code}\``, inline: true },
        { name: 'Discount', value: valueDisplay, inline: true },
        { name: 'Max Uses', value: maxUses ? String(maxUses) : 'Unlimited', inline: true }
      );

    if (expiresAt) embed.addFields({ name: 'Expires', value: `<t:${Math.floor(new Date(expiresAt).getTime() / 1000)}:R>`, inline: true });
    if (serviceId) embed.addFields({ name: 'Service', value: `\`${serviceId.slice(0, 8)}\``, inline: true });

    await interaction.editReply({ embeds: [embed] });
  } catch (err: any) {
    if (err?.code === '23505') {
      await interaction.editReply({ content: `A coupon with code \`${code}\` already exists.` });
    } else {
      throw err;
    }
  }
}
