import { SlashCommandBuilder, EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { getStaffMember, getStaffRole } from '../../services/staff.service.js';
import { COLORS } from '../../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('my-assignments')
  .setDescription('View your staff role and assigned categories');

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return;

  await interaction.deferReply({ ephemeral: true });

  const member = await getStaffMember(interaction.guildId, interaction.user.id);
  if (!member) {
    await interaction.editReply({ content: "You're not a staff member in this server." });
    return;
  }

  const role = await getStaffRole(member.role_id);
  if (!role) {
    await interaction.editReply({ content: 'Your staff role no longer exists. Contact an admin.' });
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('Your Staff Assignment')
    .setColor(COLORS.PRIMARY)
    .addFields(
      { name: 'Role', value: role.name, inline: true },
      { name: 'Categories', value: role.categories.length > 0 ? role.categories.join(', ') : 'All categories', inline: true },
      { name: 'Since', value: `<t:${Math.floor(new Date(member.joined_at).getTime() / 1000)}:R>`, inline: true }
    );

  await interaction.editReply({ embeds: [embed] });
}
