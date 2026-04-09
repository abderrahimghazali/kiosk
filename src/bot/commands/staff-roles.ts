import {
  SlashCommandBuilder,
  EmbedBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import { requireAdmin } from '../../utils/permissions.js';
import { createStaffRole, getStaffRoles, deleteStaffRole } from '../../services/staff.service.js';
import { COLORS } from '../../utils/constants.js';

export const data = new SlashCommandBuilder()
  .setName('staff-roles')
  .setDescription('Manage staff roles')
  .addSubcommand((sub) =>
    sub
      .setName('create')
      .setDescription('Create a staff role')
      .addStringOption((opt) =>
        opt.setName('name').setDescription('Role name (e.g. Booster, Designer)').setRequired(true)
      )
      .addStringOption((opt) =>
        opt.setName('categories').setDescription('Comma-separated categories this role can manage (empty = all)').setRequired(false)
      )
  )
  .addSubcommand((sub) =>
    sub.setName('list').setDescription('List all staff roles')
  )
  .addSubcommand((sub) =>
    sub
      .setName('delete')
      .setDescription('Delete a staff role')
      .addStringOption((opt) =>
        opt.setName('name').setDescription('Role name to delete').setRequired(true)
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!(await requireAdmin(interaction))) return;
  if (!interaction.guildId) return;

  await interaction.deferReply({ ephemeral: true });
  const sub = interaction.options.getSubcommand();

  if (sub === 'create') {
    const name = interaction.options.getString('name', true).trim();
    const categoriesStr = interaction.options.getString('categories') || '';
    const categories = categoriesStr
      ? categoriesStr.split(',').map((c) => c.trim()).filter(Boolean)
      : [];

    try {
      const role = await createStaffRole({ guild_id: interaction.guildId, name, categories });

      const embed = new EmbedBuilder()
        .setTitle('Staff Role Created')
        .setColor(COLORS.SUCCESS)
        .addFields(
          { name: 'Name', value: role.name, inline: true },
          { name: 'Categories', value: categories.length > 0 ? categories.join(', ') : 'All categories', inline: true }
        );

      await interaction.editReply({ embeds: [embed] });
    } catch (err: any) {
      if (err?.code === '23505') {
        await interaction.editReply({ content: `A role named **${name}** already exists.` });
      } else {
        throw err;
      }
    }
    return;
  }

  if (sub === 'list') {
    const roles = await getStaffRoles(interaction.guildId);

    if (roles.length === 0) {
      await interaction.editReply({ content: 'No staff roles. Use `/staff-roles create` to add one.' });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Staff Roles')
      .setColor(COLORS.INFO);

    for (const r of roles.slice(0, 25)) {
      embed.addFields({
        name: r.name,
        value: r.categories.length > 0 ? r.categories.join(', ') : 'All categories',
      });
    }

    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (sub === 'delete') {
    const name = interaction.options.getString('name', true).trim();
    const roles = await getStaffRoles(interaction.guildId);
    const role = roles.find((r) => r.name.toLowerCase() === name.toLowerCase());

    if (!role) {
      await interaction.editReply({ content: `Role **${name}** not found.` });
      return;
    }

    await deleteStaffRole(role.id);
    await interaction.editReply({ content: `Role **${role.name}** deleted. Staff members with this role have been unassigned.` });
  }
}
