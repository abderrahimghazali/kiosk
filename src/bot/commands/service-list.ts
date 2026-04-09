import { SlashCommandBuilder, EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { requireAdmin } from '../../utils/permissions.js';
import { getServicesByGuild, getVariantsByService } from '../../services/service.service.js';
import { COLORS } from '../../utils/constants.js';
import { formatPrice } from '../embeds/service-embed.js';
import { getGuildConfig } from '../../services/guild.service.js';

export const data = new SlashCommandBuilder()
  .setName('service-list')
  .setDescription('List all services in this server');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!(await requireAdmin(interaction))) return;
  if (!interaction.guildId) return;

  await interaction.deferReply({ ephemeral: true });

  const [services, guildConfig] = await Promise.all([
    getServicesByGuild(interaction.guildId),
    getGuildConfig(interaction.guildId),
  ]);
  const currency = guildConfig?.currency || 'eur';

  if (services.length === 0) {
    await interaction.editReply({ content: 'No services found. Use `/service-create` to add one.' });
    return;
  }

  // Fix #11: Parallel variant fetches instead of sequential N+1
  const sliced = services.slice(0, 25);
  const variantResults = await Promise.all(sliced.map((svc) => getVariantsByService(svc.id)));

  const embed = new EmbedBuilder()
    .setTitle('Services')
    .setColor(COLORS.INFO)
    .setDescription(`${services.length} service(s) found`);

  for (let i = 0; i < sliced.length; i++) {
    const svc = sliced[i];
    const variants = variantResults[i];
    const priceRange = variants.length > 0
      ? variants.map((v) => formatPrice(v.price, currency)).join(' / ')
      : 'No variants';
    const status = svc.is_active ? '🟢 Active' : '🔴 Draft';
    embed.addFields({
      name: `${svc.name} (${status})`,
      value: `ID: \`${svc.id.slice(0, 8)}\`\nCategory: ${svc.category}\nPrices: ${priceRange}`,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}
