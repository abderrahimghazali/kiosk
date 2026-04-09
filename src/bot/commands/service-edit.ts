import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { requireAdmin } from '../../utils/permissions.js';
import { getServicesByGuild } from '../../services/service.service.js';

export const data = new SlashCommandBuilder()
  .setName('service-edit')
  .setDescription('Edit an existing service')
  .addStringOption((opt) =>
    opt.setName('service_id').setDescription('Service ID (first 8 chars)').setRequired(true)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!(await requireAdmin(interaction))) return;
  if (!interaction.guildId) return;

  const partialId = interaction.options.getString('service_id', true);

  const services = await getServicesByGuild(interaction.guildId);
  const service = services.find((s) => s.id.startsWith(partialId));

  if (!service) {
    await interaction.reply({ content: `Service not found with ID starting with \`${partialId}\`.`, ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(`svc_edit_modal:${service.id}`)
    .setTitle('Edit Service');

  const nameInput = new TextInputBuilder()
    .setCustomId('name')
    .setLabel('Service Name')
    .setValue(service.name)
    .setMaxLength(100)
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const descInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('Description')
    .setValue(service.description)
    .setMaxLength(2000)
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  const categoryInput = new TextInputBuilder()
    .setCustomId('category')
    .setLabel('Category')
    .setValue(service.category)
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(categoryInput)
  );

  await interaction.showModal(modal);
}
