import { GuildMember, PermissionFlagsBits, type Interaction } from 'discord.js';

export function isAdmin(interaction: Interaction): boolean {
  if (!interaction.guild || !interaction.member) return false;
  const member = interaction.member;
  if (member instanceof GuildMember) {
    return member.permissions.has(PermissionFlagsBits.ManageGuild);
  }
  // Fallback for API interactions where member is APIInteractionGuildMember
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
