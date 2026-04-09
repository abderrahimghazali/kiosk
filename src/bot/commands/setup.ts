import {
  SlashCommandBuilder,
  ChannelType,
  type ChatInputCommandInteraction,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  type ModalSubmitInteraction,
} from 'discord.js';
import { requireAdmin } from '../../utils/permissions.js';
import { upsertGuildConfig, getGuildConfig } from '../../services/guild.service.js';
import { clearStripeClient } from '../../services/stripe.service.js';
import { CUSTOM_ID } from '../../utils/constants.js';
import { logger } from '../../utils/logger.js';

export const data = new SlashCommandBuilder()
  .setName('setup')
  .setDescription('Configure the marketplace for this server')
  .addChannelOption((opt) =>
    opt
      .setName('catalog_channel')
      .setDescription('Channel where service embeds will be posted')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  )
  .addChannelOption((opt) =>
    opt
      .setName('orders_channel')
      .setDescription('Private admin channel for order notifications')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  )
  .addChannelOption((opt) =>
    opt
      .setName('log_channel')
      .setDescription('Optional audit log channel')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(false)
  )
  .addStringOption((opt) =>
    opt
      .setName('currency')
      .setDescription('Currency code')
      .setRequired(false)
      .addChoices(
        { name: 'EUR (€)', value: 'eur' },
        { name: 'USD ($)', value: 'usd' },
        { name: 'GBP (£)', value: 'gbp' },
        { name: 'CAD (C$)', value: 'cad' },
        { name: 'AUD (A$)', value: 'aud' },
        { name: 'CHF (CHF)', value: 'chf' },
        { name: 'JPY (¥)', value: 'jpy' },
      )
  );

export async function execute(interaction: ChatInputCommandInteraction) {
  if (!(await requireAdmin(interaction))) return;
  if (!interaction.guildId) return;

  // Show modal for Stripe keys (sensitive data)
  const catalogChannel = interaction.options.getChannel('catalog_channel', true);
  const ordersChannel = interaction.options.getChannel('orders_channel', true);
  const logChannel = interaction.options.getChannel('log_channel');
  const currency = interaction.options.getString('currency') || 'eur';

  const modal = new ModalBuilder()
    .setCustomId(
      `${CUSTOM_ID.SETUP_MODAL}:${catalogChannel.id}:${ordersChannel.id}:${logChannel?.id || 'none'}:${currency}`
    )
    .setTitle('Stripe Configuration');

  const secretKeyInput = new TextInputBuilder()
    .setCustomId('stripe_secret_key')
    .setLabel('Stripe Secret Key')
    .setPlaceholder('sk_live_... or sk_test_...')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const webhookSecretInput = new TextInputBuilder()
    .setCustomId('stripe_webhook_secret')
    .setLabel('Stripe Webhook Signing Secret')
    .setPlaceholder('whsec_...')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(secretKeyInput),
    new ActionRowBuilder<TextInputBuilder>().addComponents(webhookSecretInput)
  );

  await interaction.showModal(modal);
}

export async function handleSetupModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guildId) return;

  const parts = interaction.customId.split(':');
  // setup_modal:catalogId:ordersId:logId:currency
  const catalogChannelId = parts[1];
  const ordersChannelId = parts[2];
  const logChannelId = parts[3] === 'none' ? null : parts[3];
  const currency = parts[4];

  const stripeSecretKey = interaction.fields.getTextInputValue('stripe_secret_key');
  const stripeWebhookSecret = interaction.fields.getTextInputValue('stripe_webhook_secret');

  await interaction.deferReply({ ephemeral: true });

  try {
    clearStripeClient(interaction.guildId);

    await upsertGuildConfig(interaction.guildId, {
      catalog_channel_id: catalogChannelId,
      orders_channel_id: ordersChannelId,
      log_channel_id: logChannelId,
      stripe_secret_key: stripeSecretKey,
      stripe_webhook_secret: stripeWebhookSecret,
      currency,
    });

    await interaction.editReply({
      content: [
        '**Marketplace configured!**',
        `Catalog channel: <#${catalogChannelId}>`,
        `Orders channel: <#${ordersChannelId}>`,
        logChannelId ? `Log channel: <#${logChannelId}>` : 'Log channel: *not set*',
        `Currency: \`${currency.toUpperCase()}\``,
        `Stripe: ✅ Keys saved`,
      ].join('\n'),
    });

    logger.info('Guild configured', { guildId: interaction.guildId });
  } catch (err) {
    logger.error('Setup failed', { error: String(err) });
    await interaction.editReply({ content: 'Failed to save configuration. Please try again.' });
  }
}
