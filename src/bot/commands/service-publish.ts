import { SlashCommandBuilder, type ChatInputCommandInteraction, type TextChannel } from 'discord.js';
import { requireAdmin } from '../../utils/permissions.js';
import { getServicesByGuild, getVariantsByService } from '../../services/service.service.js';
import { getGuildConfig, upsertGuildConfig } from '../../services/guild.service.js';
import { buildCatalogEmbed } from '../embeds/service-embed.js';
import { logger } from '../../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('service-publish')
  .setDescription('Post or refresh the catalog in the catalog channel');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!(await requireAdmin(interaction))) return;
  if (!interaction.guildId) return;

  await interaction.deferReply({ ephemeral: true });

  const guildConfig = await getGuildConfig(interaction.guildId);
  if (!guildConfig?.catalog_channel_id) {
    await interaction.editReply({ content: 'No catalog channel configured. Run `/setup` first.' });
    return;
  }

  const channel = await interaction.client.channels.fetch(guildConfig.catalog_channel_id);
  if (!channel?.isTextBased()) {
    await interaction.editReply({ content: 'Catalog channel not found or not a text channel.' });
    return;
  }

  const textChannel = channel as TextChannel;
  const allServices = await getServicesByGuild(interaction.guildId);
  const activeServices = allServices.filter((s) => s.is_active);

  if (activeServices.length === 0) {
    await interaction.editReply({ content: 'No active services to publish.' });
    return;
  }

  const servicesWithVariants = await Promise.all(
    activeServices.map(async (service) => ({
      service,
      variants: await getVariantsByService(service.id),
    }))
  );

  const { embed, row } = buildCatalogEmbed(servicesWithVariants, guildConfig.currency);

  try {
    // Fix #10: Use guild_configs.catalog_message_id for reliable tracking
    if (guildConfig.catalog_message_id) {
      try {
        const msg = await textChannel.messages.fetch(guildConfig.catalog_message_id);
        await msg.edit({ embeds: [embed], components: [row] });
        await interaction.editReply({ content: `Catalog updated in <#${guildConfig.catalog_channel_id}> with ${activeServices.length} service(s).` });
        return;
      } catch {
        // Message deleted, post a new one
      }
    }

    const msg = await textChannel.send({ embeds: [embed], components: [row] });
    await upsertGuildConfig(interaction.guildId, { catalog_message_id: msg.id });

    await interaction.editReply({ content: `Catalog published to <#${guildConfig.catalog_channel_id}> with ${activeServices.length} service(s).` });
    logger.info('Catalog published', { guildId: interaction.guildId, services: activeServices.length });
  } catch (err) {
    logger.error('Failed to publish catalog', { error: String(err) });
    await interaction.editReply({ content: 'Failed to publish catalog. Check bot permissions.' });
  }
}
