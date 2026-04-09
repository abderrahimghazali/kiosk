import {
  SlashCommandBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { requireAdmin } from '../../utils/permissions.js';

export const data = new SlashCommandBuilder()
  .setName('service-create')
  .setDescription('Create a new service/product for the marketplace');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!(await requireAdmin(interaction))) return;

  // Step 1: Show basic info modal
  const modal = new ModalBuilder()
    .setCustomId('svc_create_basic')
    .setTitle('Create Service — Basic Info');

  const nameInput = new TextInputBuilder()
    .setCustomId('name')
    .setLabel('Service Name')
    .setPlaceholder('e.g. Website Design')
    .setMaxLength(100)
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const descInput = new TextInputBuilder()
    .setCustomId('description')
    .setLabel('Description')
    .setPlaceholder('Describe what this service includes...')
    .setMaxLength(2000)
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  const categoryInput = new TextInputBuilder()
    .setCustomId('category')
    .setLabel('Category')
    .setPlaceholder('General')
    .setStyle(TextInputStyle.Short)
    .setRequired(false);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(nameInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(descInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(categoryInput)
  );

  await interaction.showModal(modal);
}
