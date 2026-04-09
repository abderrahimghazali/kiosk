import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type ModalSubmitInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import {
  createApplication,
  getApplication,
  getPendingApplication,
  updateApplication,
  addStaffMember,
  getStaffRoles,
  getStaffRole,
} from '../../services/staff.service.js';
import { getGuildConfig } from '../../services/guild.service.js';
import { isAdmin } from '../../utils/permissions.js';
import { CUSTOM_ID, COLORS } from '../../utils/constants.js';
import { logger } from '../../utils/logger.js';

// Apply button clicked → show modal
export async function handleApplyButton(interaction: ButtonInteraction) {
  if (!interaction.guildId) return;

  // Check if already has a pending application
  const existing = await getPendingApplication(interaction.guildId, interaction.user.id);
  if (existing) {
    await interaction.reply({ content: 'You already have a pending application.', ephemeral: true });
    return;
  }

  const modal = new ModalBuilder()
    .setCustomId(CUSTOM_ID.STAFF_APPLY_MODAL)
    .setTitle('Staff Application');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('about')
        .setLabel('Tell us about yourself')
        .setPlaceholder('Name/IGN, age, timezone...')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('experience')
        .setLabel('Relevant experience')
        .setPlaceholder('What experience do you have?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('availability')
        .setLabel('Availability')
        .setPlaceholder('How many hours/week? What timezone?')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('why')
        .setLabel('Why do you want to join?')
        .setPlaceholder('What motivates you?')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
        .setMaxLength(500)
    )
  );

  await interaction.showModal(modal);
}

// Application modal submitted
export async function handleApplyModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guildId) return;

  await interaction.deferReply({ ephemeral: true });

  const responses = [
    { question: 'About', answer: interaction.fields.getTextInputValue('about') },
    { question: 'Experience', answer: interaction.fields.getTextInputValue('experience') },
    { question: 'Availability', answer: interaction.fields.getTextInputValue('availability') },
    { question: 'Why join?', answer: interaction.fields.getTextInputValue('why') },
  ];

  const app = await createApplication({
    guild_id: interaction.guildId,
    user_id: interaction.user.id,
    username: interaction.user.username,
    responses,
  });

  await interaction.editReply({ content: 'Your application has been submitted! You\'ll receive a DM when it\'s reviewed.' });

  // Post in orders channel for admin review
  const guildConfig = await getGuildConfig(interaction.guildId);
  if (guildConfig?.orders_channel_id) {
    try {
      const channel = await interaction.client.channels.fetch(guildConfig.orders_channel_id);
      if (channel?.isTextBased() && 'send' in channel) {
        const embed = new EmbedBuilder()
          .setTitle('New Staff Application')
          .setColor(COLORS.WARNING)
          .addFields(
            { name: 'Applicant', value: `<@${interaction.user.id}> (${interaction.user.username})`, inline: true }
          )
          .setTimestamp();

        for (const r of responses) {
          embed.addFields({ name: r.question, value: r.answer.substring(0, 1024) });
        }

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder()
            .setCustomId(`${CUSTOM_ID.STAFF_APP_ACCEPT}:${app.id}`)
            .setLabel('Accept')
            .setEmoji('✅')
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId(`${CUSTOM_ID.STAFF_APP_REJECT}:${app.id}`)
            .setLabel('Reject')
            .setEmoji('❌')
            .setStyle(ButtonStyle.Danger)
        );

        await channel.send({ embeds: [embed], components: [row] });
      }
    } catch (err) {
      logger.error('Failed to post application', { error: String(err) });
    }
  }
}

// Admin accepts → show role select
export async function handleAcceptApplication(interaction: ButtonInteraction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: "You don't have permission.", ephemeral: true });
    return;
  }
  if (!interaction.guildId) return;

  const appId = interaction.customId.split(':')[1];
  const app = await getApplication(appId);

  if (!app || app.status !== 'pending') {
    await interaction.reply({ content: 'This application has already been reviewed.', ephemeral: true });
    return;
  }

  // Show role select menu
  const roles = await getStaffRoles(interaction.guildId);
  if (roles.length === 0) {
    await interaction.reply({
      content: 'No staff roles configured. Create one first with `/staff-roles create`.',
      ephemeral: true,
    });
    return;
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${CUSTOM_ID.STAFF_APP_ROLE_SELECT}:${appId}`)
    .setPlaceholder('Assign a role...')
    .addOptions(
      roles.map((r) => ({
        label: r.name,
        description: r.categories.length > 0 ? r.categories.join(', ') : 'All categories',
        value: r.id,
      }))
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  await interaction.reply({
    content: `Choose a role for <@${app.user_id}>:`,
    components: [row],
    ephemeral: true,
  });
}

// Role selected for accepted application
export async function handleRoleSelect(interaction: StringSelectMenuInteraction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: "You don't have permission.", ephemeral: true });
    return;
  }
  if (!interaction.guildId) return;

  const appId = interaction.customId.split(':')[1];
  const roleId = interaction.values[0];

  const app = await getApplication(appId);
  if (!app || app.status !== 'pending') {
    await interaction.reply({ content: 'This application has already been reviewed.', ephemeral: true });
    return;
  }

  const role = await getStaffRole(roleId);
  if (!role) {
    await interaction.reply({ content: 'Role not found.', ephemeral: true });
    return;
  }

  // Accept application
  await updateApplication(appId, {
    status: 'accepted',
    reviewed_by: interaction.user.id,
    assigned_role_id: roleId,
  });

  // Add as staff member
  await addStaffMember({
    guild_id: interaction.guildId,
    user_id: app.user_id,
    role_id: roleId,
  });

  await interaction.update({
    content: `<@${app.user_id}> accepted as **${role.name}**!`,
    components: [],
  });

  // Update the original application embed
  try {
    const originalMsg = interaction.message;
    if (originalMsg.reference?.messageId) {
      // Can't easily get the original, so we edit via the channel
    }
  } catch { /* ignore */ }

  // DM the applicant
  try {
    const user = await interaction.client.users.fetch(app.user_id);
    const embed = new EmbedBuilder()
      .setTitle('Application Accepted!')
      .setDescription(`Your staff application in **${interaction.guild?.name}** has been accepted!\n\nYou've been assigned the **${role.name}** role.`)
      .setColor(COLORS.SUCCESS)
      .setTimestamp();

    if (role.categories.length > 0) {
      embed.addFields({ name: 'Categories', value: role.categories.join(', ') });
    }

    await user.send({ embeds: [embed] });
  } catch {
    logger.warn('Could not DM accepted applicant', { userId: app.user_id });
  }
}

// Admin rejects application
export async function handleRejectApplication(interaction: ButtonInteraction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({ content: "You don't have permission.", ephemeral: true });
    return;
  }

  const appId = interaction.customId.split(':')[1];
  const app = await getApplication(appId);

  if (!app || app.status !== 'pending') {
    await interaction.reply({ content: 'This application has already been reviewed.', ephemeral: true });
    return;
  }

  await updateApplication(appId, {
    status: 'rejected',
    reviewed_by: interaction.user.id,
  });

  // Update embed
  await interaction.deferUpdate();
  const embed = EmbedBuilder.from(interaction.message.embeds[0])
    .setColor(COLORS.DANGER)
    .setTitle('Staff Application — Rejected');

  await interaction.editReply({ embeds: [embed], components: [] });

  // DM applicant
  try {
    const user = await interaction.client.users.fetch(app.user_id);
    const dmEmbed = new EmbedBuilder()
      .setTitle('Application Update')
      .setDescription(`Your staff application in **${interaction.guild?.name}** was not accepted at this time. Thank you for your interest!`)
      .setColor(COLORS.DANGER)
      .setTimestamp();
    await user.send({ embeds: [dmEmbed] });
  } catch {
    logger.warn('Could not DM rejected applicant', { userId: app.user_id });
  }
}
