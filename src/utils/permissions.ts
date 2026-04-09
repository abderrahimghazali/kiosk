import { GuildMember, PermissionFlagsBits, type Interaction } from 'discord.js';
import { getStaffMember, getStaffRole } from '../services/staff.service.js';

export function isAdmin(interaction: Interaction): boolean {
  if (!interaction.guild || !interaction.member) return false;
  const member = interaction.member;
  if (member instanceof GuildMember) {
    return member.permissions.has(PermissionFlagsBits.ManageGuild);
  }
  const permissions = BigInt((member as { permissions: string }).permissions);
  return (permissions & PermissionFlagsBits.ManageGuild) === PermissionFlagsBits.ManageGuild;
}

export async function requireAdmin(interaction: Interaction & { reply: Function }): Promise<boolean> {
  if (!isAdmin(interaction)) {
    await interaction.reply({
      content: "You don't have permission to use this. Requires **Manage Server** permission.",
      ephemeral: true,
    });
    return false;
  }
  return true;
}

/** Check if user is admin OR staff member */
export async function isAdminOrStaff(interaction: Interaction): Promise<boolean> {
  if (isAdmin(interaction)) return true;
  if (!interaction.guildId || !interaction.member) return false;
  const userId = 'id' in interaction.member ? (interaction.member as GuildMember).id : (interaction.member as any).user?.id;
  if (!userId) return false;
  const member = await getStaffMember(interaction.guildId, userId);
  return member !== null;
}

/** Check if user is admin OR staff with access to a specific category */
export async function isAdminOrStaffForCategory(
  interaction: Interaction,
  category: string
): Promise<boolean> {
  if (isAdmin(interaction)) return true;
  if (!interaction.guildId || !interaction.member) return false;
  const userId = 'id' in interaction.member ? (interaction.member as GuildMember).id : (interaction.member as any).user?.id;
  if (!userId) return false;
  const member = await getStaffMember(interaction.guildId, userId);
  if (!member) return false;
  const role = await getStaffRole(member.role_id);
  if (!role) return false;
  if (role.categories.length === 0) return true;
  return role.categories.includes(category);
}
