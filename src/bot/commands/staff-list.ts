import { SlashCommandBuilder, EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { requireAdmin } from '../../utils/permissions.js';
import { getStaffMembers, getStaffRoles, removeStaffMember } from '../../services/staff.service.js';
import { COLORS } from '../../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('staff-list')
  .setDescription('List all staff members')
  .addSubcommand((sub) => sub.setName('show').setDescription('View all staff members'))
  .addSubcommand((sub) =>
    sub
      .setName('remove')
      .setDescription('Remove a staff member')
      .addUserOption((opt) =>
        opt.setName('user').setDescription('User to remove').setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!(await requireAdmin(interaction))) return;
  if (!interaction.guildId) return;

  await interaction.deferReply({ ephemeral: true });
  const sub = interaction.options.getSubcommand();

  if (sub === 'remove') {
    const user = interaction.options.getUser('user', true);
    await removeStaffMember(interaction.guildId, user.id);
    await interaction.editReply({ content: `Removed <@${user.id}> from staff.` });
    return;
  }

  // show
  const [members, roles] = await Promise.all([
    getStaffMembers(interaction.guildId),
    getStaffRoles(interaction.guildId),
  ]);

  if (members.length === 0) {
    await interaction.editReply({ content: 'No staff members yet.' });
    return;
  }

  const roleMap = new Map(roles.map((r) => [r.id, r]));

  const embed = new EmbedBuilder()
    .setTitle('Staff Members')
    .setColor(COLORS.INFO)
    .setDescription(`${members.length} member(s)`);

  for (const m of members.slice(0, 25)) {
    const role = roleMap.get(m.role_id);
    embed.addFields({
      name: role?.name || 'Unknown Role',
      value: `<@${m.user_id}> — since <t:${Math.floor(new Date(m.joined_at).getTime() / 1000)}:R>`,
      inline: true,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}
