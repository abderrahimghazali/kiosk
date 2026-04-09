import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
  type ModalSubmitInteraction,
  type RepliableInteraction,
} from 'discord.js';
import { getService, getServicesByGuild, getVariantsByService, getVariant } from '../../services/service.service.js';
import { getGuildConfig } from '../../services/guild.service.js';
import { createOrder, updateOrder } from '../../services/order.service.js';
import { createCheckoutSession } from '../../services/stripe.service.js';
import { CUSTOM_ID, COLORS, LIMITS } from '../../utils/constants.js';
import { buildCategoryEmbed, formatPrice } from '../embeds/service-embed.js';
import { logger } from '../../utils/logger.js';
import type { ServiceStep, StepResponse } from '../../db/types.js';

interface WizardState {
  serviceId: string;
  guildId: string;
  serviceName: string;
  variantId: string | null;
  variantName: string;
  variantPrice: number;
  currency: string;
  steps: ServiceStep[];
  currentStepIndex: number;
  stepResponses: StepResponse[];
  createdAt: number;
  paying: boolean; // Fix #1: guard against double-click
}

const wizards = new Map<string, WizardState>();

function wizardKey(userId: string, serviceId: string): string {
  return `${userId}:${serviceId}`;
}

// Cleanup stale wizards every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of wizards) {
    if (now - state.createdAt > LIMITS.WIZARD_TTL_MS) {
      wizards.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Fix #15: Shared helper to start the order wizard (eliminates duplication)
async function startOrderWizard(
  interaction: ButtonInteraction | StringSelectMenuInteraction,
  serviceId: string
) {
  const service = await getService(serviceId);
  if (!service || !service.is_active) {
    await interaction.reply({ content: 'This service is no longer available.', ephemeral: true });
    return;
  }

  const variants = await getVariantsByService(serviceId);
  if (variants.length === 0) {
    await interaction.reply({ content: 'This service has no available options.', ephemeral: true });
    return;
  }

  const guildConfig = await getGuildConfig(service.guild_id);
  if (!guildConfig) {
    await interaction.reply({ content: 'Marketplace not configured for this server.', ephemeral: true });
    return;
  }

  const key = wizardKey(interaction.user.id, serviceId);
  wizards.set(key, {
    serviceId,
    guildId: service.guild_id,
    serviceName: service.name,
    variantId: null,
    variantName: '',
    variantPrice: 0,
    currency: guildConfig.currency,
    steps: service.steps || [],
    currentStepIndex: 0,
    stepResponses: [],
    createdAt: Date.now(),
    paying: false,
  });

  await interaction.deferReply({ ephemeral: true });

  const embed = new EmbedBuilder()
    .setTitle(`Order: ${service.name}`)
    .setDescription('Select a plan to continue:')
    .setColor(COLORS.PRIMARY);

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`${CUSTOM_ID.ORDER_VARIANT}:${serviceId}`)
    .setPlaceholder('Choose a variant...')
    .addOptions(
      variants.map((v) => ({
        label: `${v.name} — ${formatPrice(v.price, guildConfig.currency)}`,
        description: v.description?.substring(0, 100) || undefined,
        value: v.id,
      }))
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
  await interaction.editReply({ embeds: [embed], components: [row] });
}

// Category selected from catalog — show services in that category (ephemeral)
export async function handleCategorySelect(interaction: StringSelectMenuInteraction) {
  const category = interaction.values[0];
  const guildId = interaction.guildId;
  if (!guildId) return;

  await interaction.deferReply({ ephemeral: true });

  const guildConfig = await getGuildConfig(guildId);
  const currency = guildConfig?.currency || 'eur';

  const allServices = await getServicesByGuild(guildId);
  const filtered = allServices.filter((s) => s.is_active && s.category === category);

  if (filtered.length === 0) {
    await interaction.editReply({ content: 'No services found in this category.' });
    return;
  }

  const servicesWithVariants = await Promise.all(
    filtered.map(async (service) => ({
      service,
      variants: await getVariantsByService(service.id),
    }))
  );

  const { embed, row } = buildCategoryEmbed(category, servicesWithVariants, currency);
  await interaction.editReply({ embeds: [embed], components: [row] });
}

// Order start from button (legacy single-service embeds)
export async function handleOrderStart(interaction: ButtonInteraction) {
  const serviceId = interaction.customId.split(':')[1];
  await startOrderWizard(interaction, serviceId);
}

// Order start from catalog select menu
export async function handleOrderStartFromSelect(interaction: StringSelectMenuInteraction) {
  const serviceId = interaction.values[0];
  await startOrderWizard(interaction, serviceId);
}

// Step 2: Variant selected
export async function handleVariantSelect(interaction: StringSelectMenuInteraction) {
  const serviceId = interaction.customId.split(':')[1];
  const variantId = interaction.values[0];
  const key = wizardKey(interaction.user.id, serviceId);
  const state = wizards.get(key);

  if (!state) {
    await interaction.reply({ content: 'Session expired. Please click "Order" again.', ephemeral: true });
    return;
  }

  const variant = await getVariant(variantId);
  if (!variant) {
    await interaction.reply({ content: 'Variant not found.', ephemeral: true });
    return;
  }

  state.variantId = variantId;
  state.variantName = variant.name;
  state.variantPrice = variant.price;

  await interaction.deferUpdate();

  if (state.steps.length > 0) {
    await showStep(interaction, key);
  } else {
    await showOrderSummary(interaction, key);
  }
}

// Show current step
async function showStep(interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction, key: string) {
  const state = wizards.get(key)!;
  const step = state.steps[state.currentStepIndex];
  const progress = `Step ${state.currentStepIndex + 1}/${state.steps.length}`;

  const embed = new EmbedBuilder()
    .setTitle(`Order: ${state.serviceName}`)
    .setDescription(`**${progress}**\n\n${step.prompt}`)
    .setColor(COLORS.PRIMARY)
    .setFooter({ text: `Variant: ${state.variantName} — ${formatPrice(state.variantPrice, state.currency)}` });

  if (step.type === 'select' && step.choices) {
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`${CUSTOM_ID.ORDER_STEP_SELECT}:${state.serviceId}:${state.currentStepIndex}`)
      .setPlaceholder('Select an option...')
      .addOptions(step.choices.map((c) => ({ label: c, value: c })));

    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    await interaction.editReply({ embeds: [embed], components: [row] });
  } else {
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`${CUSTOM_ID.ORDER_STEP_TEXT_BTN}:${state.serviceId}:${state.currentStepIndex}`)
        .setLabel('Answer')
        .setStyle(ButtonStyle.Primary)
    );
    await interaction.editReply({ embeds: [embed], components: [row] });
  }
}

// Handle text step button → show modal
export async function handleStepTextButton(interaction: ButtonInteraction) {
  const parts = interaction.customId.split(':');
  const serviceId = parts[1];
  const stepIndex = parseInt(parts[2]);
  const key = wizardKey(interaction.user.id, serviceId);
  const state = wizards.get(key);

  if (!state) {
    await interaction.reply({ content: 'Session expired.', ephemeral: true });
    return;
  }

  const step = state.steps[stepIndex];

  const modal = new ModalBuilder()
    .setCustomId(`${CUSTOM_ID.ORDER_STEP_TEXT_MODAL}:${serviceId}:${stepIndex}`)
    .setTitle('Your Answer');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('answer')
        .setLabel(step.prompt.substring(0, 45))
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true)
    )
  );

  await interaction.showModal(modal);
}

// Fix #14: Handle text step modal submit — use stepIndex from customId
export async function handleStepTextModal(interaction: ModalSubmitInteraction) {
  const parts = interaction.customId.split(':');
  const serviceId = parts[1];
  const stepIndex = parseInt(parts[2]);
  const key = wizardKey(interaction.user.id, serviceId);
  const state = wizards.get(key);

  if (!state) {
    await interaction.reply({ content: 'Session expired.', ephemeral: true });
    return;
  }

  const answer = interaction.fields.getTextInputValue('answer');
  const step = state.steps[stepIndex];
  state.stepResponses.push({ prompt: step.prompt, answer });
  state.currentStepIndex = stepIndex + 1;

  await interaction.deferUpdate();

  if (state.currentStepIndex < state.steps.length) {
    await showStep(interaction, key);
  } else {
    await showOrderSummary(interaction, key);
  }
}

// Handle select step choice
export async function handleStepSelect(interaction: StringSelectMenuInteraction) {
  const parts = interaction.customId.split(':');
  const serviceId = parts[1];
  const stepIndex = parseInt(parts[2]);
  const key = wizardKey(interaction.user.id, serviceId);
  const state = wizards.get(key);

  if (!state) {
    await interaction.reply({ content: 'Session expired.', ephemeral: true });
    return;
  }

  const answer = interaction.values[0];
  const step = state.steps[stepIndex];
  state.stepResponses.push({ prompt: step.prompt, answer });
  state.currentStepIndex = stepIndex + 1;

  await interaction.deferUpdate();

  if (state.currentStepIndex < state.steps.length) {
    await showStep(interaction, key);
  } else {
    await showOrderSummary(interaction, key);
  }
}

// Show order summary
async function showOrderSummary(interaction: ButtonInteraction | StringSelectMenuInteraction | ModalSubmitInteraction, key: string) {
  const state = wizards.get(key)!;

  const embed = new EmbedBuilder()
    .setTitle(`Order Summary: ${state.serviceName}`)
    .setColor(COLORS.WARNING)
    .addFields(
      { name: 'Variant', value: state.variantName, inline: true },
      { name: 'Price', value: formatPrice(state.variantPrice, state.currency), inline: true }
    );

  if (state.stepResponses.length > 0) {
    const responses = state.stepResponses
      .map((r) => `**${r.prompt}**\n${r.answer}`)
      .join('\n\n');
    embed.addFields({ name: 'Your Responses', value: responses.substring(0, 1024) });
  }

  embed.setFooter({ text: 'Review your order and click Pay to proceed' });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID.ORDER_PAY}:${state.serviceId}`)
      .setLabel('Pay Now')
      .setEmoji('✅')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID.ORDER_CANCEL}:${state.serviceId}`)
      .setLabel('Cancel')
      .setEmoji('❌')
      .setStyle(ButtonStyle.Danger)
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

// Fix #1: Handle pay button with double-click guard
export async function handlePay(interaction: ButtonInteraction) {
  const serviceId = interaction.customId.split(':')[1];
  const key = wizardKey(interaction.user.id, serviceId);
  const state = wizards.get(key);

  if (!state || !state.variantId) {
    await interaction.reply({ content: 'Session expired. Please start over.', ephemeral: true });
    return;
  }

  // Guard: prevent double-click from creating duplicate orders
  if (state.paying) {
    await interaction.reply({ content: 'Payment is already being processed...', ephemeral: true });
    return;
  }
  state.paying = true;

  await interaction.deferUpdate();

  try {
    const guildConfig = await getGuildConfig(state.guildId);
    if (!guildConfig) throw new Error('Guild not configured');

    const order = await createOrder({
      guild_id: state.guildId,
      service_id: state.serviceId,
      variant_id: state.variantId,
      customer_discord_id: interaction.user.id,
      customer_discord_username: interaction.user.username,
      selected_variant_name: state.variantName,
      step_responses: state.stepResponses,
      total_price: state.variantPrice,
      currency: state.currency,
    });

    const session = await createCheckoutSession(guildConfig, {
      serviceName: state.serviceName,
      variantName: state.variantName,
      description: `Order for ${state.serviceName}`,
      priceInCents: state.variantPrice,
      orderId: order.id,
      customerDiscordId: interaction.user.id,
    });

    await updateOrder(order.id, { stripe_checkout_session_id: session.id });

    // Clean up wizard state
    wizards.delete(key);

    const embed = new EmbedBuilder()
      .setTitle('Complete Your Payment')
      .setDescription('Click the button below to pay securely via Stripe.')
      .setColor(COLORS.SUCCESS);

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel('Pay Now')
        .setStyle(ButtonStyle.Link)
        .setURL(session.url!)
    );

    await interaction.editReply({ embeds: [embed], components: [row] });

    logger.info('Checkout session created', { orderId: order.id, serviceId });
  } catch (err) {
    state.paying = false; // Allow retry on failure
    logger.error('Payment setup failed', { error: String(err) });
    await interaction.editReply({
      content: 'Failed to create payment session. Please try again.',
      embeds: [],
      components: [],
    });
  }
}

// Handle cancel button
export async function handleCancel(interaction: ButtonInteraction) {
  const serviceId = interaction.customId.split(':')[1];
  const key = wizardKey(interaction.user.id, serviceId);
  wizards.delete(key);

  await interaction.deferUpdate();
  await interaction.editReply({
    content: 'Order cancelled.',
    embeds: [],
    components: [],
  });
}
