import { SlashCommandBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { requireAdmin } from '../../utils/permissions.js';
import { getServicesByGuild, deleteService } from '../../services/service.service.js';
import { getGuildConfig } from '../../services/guild.service.js';
import { logger } from '../../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('service-delete')
  .setDescription('Delete a service from the marketplace')
  .addStringOption((opt) =>
    opt.setName('service_id').setDescription('Service ID (first 8 chars)').setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!(await requireAdmin(interaction))) return;
  if (!interaction.guildId) return;

  await interaction.deferReply({ ephemeral: true });

  const partialId = interaction.options.getString('service_id', true);
  const services = await getServicesByGuild(interaction.guildId);
  const service = services.find((s) => s.id.startsWith(partialId));

  if (!service) {
    await interaction.editReply({ content: `Service not found with ID starting with \`${partialId}\`.` });
    return;
  }

  // Try to delete the catalog message if it exists
  if (service.catalog_message_id) {
    try {
      const guildConfig = await getGuildConfig(interaction.guildId);
      if (guildConfig?.catalog_channel_id) {
        const channel = await interaction.client.channels.fetch(guildConfig.catalog_channel_id);
        if (channel?.isTextBased() && 'messages' in channel) {
          await channel.messages.delete(service.catalog_message_id);
        }
      }
    } catch {
      // Message may already be deleted
    }
  }

  await deleteService(service.id);
  logger.info('Service deleted', { serviceId: service.id, guildId: interaction.guildId });

  await interaction.editReply({ content: `Service **${service.name}** deleted.` });
}
