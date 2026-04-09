import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  type ChatInputCommandInteraction,
  type TextChannel,
} from 'discord.js';
import { requireAdmin } from '../../utils/permissions.js';
import { CUSTOM_ID, COLORS } from '../../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('staff-setup')
  .setDescription('Post a staff application embed in a channel')
  .addChannelOption((opt) =>
    opt
      .setName('channel')
      .setDescription('Channel to post the application embed')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName('title').setDescription('Application embed title').setRequired(false)
  )
  .addStringOption((opt) =>
    opt.setName('description').setDescription('Application embed description').setRequired(false)
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!(await requireAdmin(interaction))) return;
  if (!interaction.guildId) return;

  await interaction.deferReply({ ephemeral: true });

  const channel = interaction.options.getChannel('channel', true) as TextChannel;
  const title = interaction.options.getString('title') || 'Join Our Team';
  const description = interaction.options.getString('description') ||
    'Interested in joining the team? Click the button below to submit your application.\n\nWe\'ll review it and get back to you!';

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(COLORS.PRIMARY)
    .setFooter({ text: 'Applications are reviewed by staff admins' })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(CUSTOM_ID.STAFF_APPLY_BTN)
      .setLabel('Apply Now')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Primary)
  );

  await channel.send({ embeds: [embed], components: [row] });

  await interaction.editReply({ content: `Application embed posted in <#${channel.id}>!` });
}
