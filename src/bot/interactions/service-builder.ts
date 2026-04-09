import {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type ModalSubmitInteraction,
  type ButtonInteraction,
} from 'discord.js';
import { createService, createVariant, updateService, getVariantsByService, getService } from '../../services/service.service.js';
import { getGuildConfig } from '../../services/guild.service.js';
import { buildServiceEmbed, formatPrice } from '../embeds/service-embed.js';
import { isAdmin } from '../../utils/permissions.js';
import { CUSTOM_ID, COLORS, LIMITS } from '../../utils/constants.js';
import { logger } from '../../utils/logger.js';
import type { ServiceStep } from '../../db/types.js';

interface BuilderState {
  serviceId: string;
  guildId: string;
  name: string;
  description: string;
  category: string;
  variants: { name: string; description: string; price: number }[];
  steps: ServiceStep[];
  screenshots: string[];
  phase: 'variants' | 'steps' | 'screenshots' | 'confirm';
  createdAt: number;
}

const builders = new Map<string, BuilderState>();

function builderKey(userId: string, guildId: string): string {
  return `${userId}:${guildId}`;
}

// Fix #6: Cleanup stale builders every 5 minutes (same as wizards)
setInterval(() => {
  const now = Date.now();
  for (const [key, state] of builders) {
    if (now - state.createdAt > LIMITS.WIZARD_TTL_MS) {
      builders.delete(key);
    }
  }
}, 5 * 60 * 1000);

// Fix #5: Re-check admin permission on modal submits
export async function handleBasicInfoModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guildId) return;

  if (!isAdmin(interaction)) {
    await interaction.reply({ content: "You don't have permission.", ephemeral: true });
    return;
  }

  const name = interaction.fields.getTextInputValue('name');
  const description = interaction.fields.getTextInputValue('description');
  const category = interaction.fields.getTextInputValue('category') || 'General';

  await interaction.deferReply({ ephemeral: true });

  const service = await createService({
    guild_id: interaction.guildId,
    name,
    description,
    category,
    is_active: false,
  });

  const key = builderKey(interaction.user.id, interaction.guildId);
  builders.set(key, {
    serviceId: service.id,
    guildId: interaction.guildId,
    name,
    description,
    category,
    variants: [],
    steps: [],
    screenshots: [],
    phase: 'variants',
    createdAt: Date.now(),
  });

  await showVariantsPhase(interaction, key);
}

async function showVariantsPhase(interaction: ModalSubmitInteraction | ButtonInteraction, key: string) {
  const state = builders.get(key)!;
  const guildConfig = await getGuildConfig(state.guildId);
  const currency = guildConfig?.currency || 'eur';

  const variantList = state.variants.length > 0
    ? state.variants.map((v, i) => `${i + 1}. **${v.name}** — ${formatPrice(v.price, currency)} ${v.description ? `\n   ${v.description}` : ''}`).join('\n')
    : '*No variants yet*';

  const embed = new EmbedBuilder()
    .setTitle(`Creating: ${state.name}`)
    .setDescription(`**Step 2/4: Variants**\n\nAdd pricing tiers for this service.\n\n${variantList}`)
    .setColor(COLORS.INFO);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID.SVC_ADD_VARIANT_BTN}:${state.serviceId}`)
      .setLabel('Add Variant')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(state.variants.length >= LIMITS.MAX_VARIANTS),
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID.SVC_DONE_VARIANTS}:${state.serviceId}`)
      .setLabel('Done with Variants')
      .setStyle(ButtonStyle.Success)
      .setDisabled(state.variants.length === 0)
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function handleAddVariantButton(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId(`${CUSTOM_ID.SVC_ADD_VARIANT_MODAL}:${interaction.customId.split(':')[1]}`)
    .setTitle('Add Variant');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('name').setLabel('Variant Name').setPlaceholder('e.g. Basic, Pro, Enterprise').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('description').setLabel('Description (optional)').setPlaceholder('What this tier includes').setStyle(TextInputStyle.Short).setRequired(false)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('price').setLabel('Price (e.g. 49.99)').setPlaceholder('49.99').setStyle(TextInputStyle.Short).setRequired(true)
    )
  );

  await interaction.showModal(modal);
}

// Fix #12: Server-side variant count check
export async function handleAddVariantModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guildId) return;

  const serviceId = interaction.customId.split(':')[1];
  const key = builderKey(interaction.user.id, interaction.guildId);
  const state = builders.get(key);

  if (!state || state.serviceId !== serviceId) {
    await interaction.reply({ content: 'Session expired. Please start over with `/service-create`.', ephemeral: true });
    return;
  }

  if (state.variants.length >= LIMITS.MAX_VARIANTS) {
    await interaction.reply({ content: `Maximum ${LIMITS.MAX_VARIANTS} variants allowed.`, ephemeral: true });
    return;
  }

  const name = interaction.fields.getTextInputValue('name');
  const description = interaction.fields.getTextInputValue('description') || '';
  const priceStr = interaction.fields.getTextInputValue('price');
  const price = Math.round(parseFloat(priceStr) * 100);

  if (isNaN(price) || price <= 0) {
    await interaction.reply({ content: 'Invalid price. Please enter a number like 49.99.', ephemeral: true });
    return;
  }

  state.variants.push({ name, description, price });

  await createVariant({
    service_id: serviceId,
    name,
    description: description || undefined,
    price,
    display_order: state.variants.length - 1,
  });

  await interaction.deferUpdate();
  await showVariantsPhase(interaction, key);
}

export async function handleDoneVariants(interaction: ButtonInteraction) {
  if (!interaction.guildId) return;
  const key = builderKey(interaction.user.id, interaction.guildId);
  const state = builders.get(key);
  if (!state) {
    await interaction.reply({ content: 'Session expired.', ephemeral: true });
    return;
  }

  state.phase = 'steps';
  await interaction.deferUpdate();
  await showStepsPhase(interaction, key);
}

async function showStepsPhase(interaction: ButtonInteraction | ModalSubmitInteraction, key: string) {
  const state = builders.get(key)!;

  const stepList = state.steps.length > 0
    ? state.steps.map((s, i) => `${i + 1}. ${s.type === 'select' ? '📋' : '📝'} ${s.prompt}${s.choices ? ` (${s.choices.join(', ')})` : ''}`).join('\n')
    : '*No steps yet*';

  const embed = new EmbedBuilder()
    .setTitle(`Creating: ${state.name}`)
    .setDescription(`**Step 3/4: Customer Info Steps**\n\nAdd questions customers must answer when ordering.\n\n${stepList}`)
    .setColor(COLORS.INFO);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID.SVC_ADD_TEXT_STEP_BTN}:${state.serviceId}`)
      .setLabel('Add Text Question')
      .setEmoji('📝')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(state.steps.length >= LIMITS.MAX_STEPS),
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID.SVC_ADD_SELECT_STEP_BTN}:${state.serviceId}`)
      .setLabel('Add Choice Question')
      .setEmoji('📋')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(state.steps.length >= LIMITS.MAX_STEPS),
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID.SVC_SKIP_STEPS}:${state.serviceId}`)
      .setLabel(state.steps.length > 0 ? 'Done with Steps' : 'Skip')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function handleAddTextStepButton(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId(`${CUSTOM_ID.SVC_ADD_TEXT_STEP_MODAL}:${interaction.customId.split(':')[1]}`)
    .setTitle('Add Text Question');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('prompt').setLabel('Question').setPlaceholder('e.g. What is your website URL?').setStyle(TextInputStyle.Short).setRequired(true)
    )
  );

  await interaction.showModal(modal);
}

// Fix #22: Add deferUpdate before async work
export async function handleAddTextStepModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guildId) return;
  const key = builderKey(interaction.user.id, interaction.guildId);
  const state = builders.get(key);
  if (!state) {
    await interaction.reply({ content: 'Session expired.', ephemeral: true });
    return;
  }

  if (state.steps.length >= LIMITS.MAX_STEPS) {
    await interaction.reply({ content: `Maximum ${LIMITS.MAX_STEPS} steps allowed.`, ephemeral: true });
    return;
  }

  const prompt = interaction.fields.getTextInputValue('prompt');
  state.steps.push({ prompt, type: 'text' });

  await interaction.deferUpdate();
  await showStepsPhase(interaction, key);
}

export async function handleAddSelectStepButton(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId(`${CUSTOM_ID.SVC_ADD_SELECT_STEP_MODAL}:${interaction.customId.split(':')[1]}`)
    .setTitle('Add Choice Question');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('prompt').setLabel('Question').setPlaceholder('e.g. Preferred color scheme?').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('choices').setLabel('Choices (comma-separated)').setPlaceholder('Red, Blue, Green').setStyle(TextInputStyle.Short).setRequired(true)
    )
  );

  await interaction.showModal(modal);
}

// Fix #22: Add deferUpdate before async work
export async function handleAddSelectStepModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guildId) return;
  const key = builderKey(interaction.user.id, interaction.guildId);
  const state = builders.get(key);
  if (!state) {
    await interaction.reply({ content: 'Session expired.', ephemeral: true });
    return;
  }

  const prompt = interaction.fields.getTextInputValue('prompt');
  const choicesStr = interaction.fields.getTextInputValue('choices');
  const choices = choicesStr.split(',').map((c) => c.trim()).filter(Boolean);

  if (choices.length < 2) {
    await interaction.reply({ content: 'Please provide at least 2 choices, separated by commas.', ephemeral: true });
    return;
  }

  state.steps.push({ prompt, type: 'select', choices });

  await interaction.deferUpdate();
  await showStepsPhase(interaction, key);
}

export async function handleSkipSteps(interaction: ButtonInteraction) {
  if (!interaction.guildId) return;
  const key = builderKey(interaction.user.id, interaction.guildId);
  const state = builders.get(key);
  if (!state) {
    await interaction.reply({ content: 'Session expired.', ephemeral: true });
    return;
  }

  state.phase = 'screenshots';
  await interaction.deferUpdate();
  await showScreenshotsPhase(interaction, key);
}

async function showScreenshotsPhase(interaction: ButtonInteraction | ModalSubmitInteraction, key: string) {
  const state = builders.get(key)!;

  const shotList = state.screenshots.length > 0
    ? state.screenshots.map((s, i) => `${i + 1}. ${s}`).join('\n')
    : '*No screenshots yet*';

  const embed = new EmbedBuilder()
    .setTitle(`Creating: ${state.name}`)
    .setDescription(`**Step 4/4: Screenshots**\n\nAdd image URLs for service screenshots.\n\n${shotList}`)
    .setColor(COLORS.INFO);

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID.SVC_ADD_SCREENSHOT_BTN}:${state.serviceId}`)
      .setLabel('Add Screenshot')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(state.screenshots.length >= LIMITS.MAX_SCREENSHOTS),
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID.SVC_SKIP_SCREENSHOTS}:${state.serviceId}`)
      .setLabel(state.screenshots.length > 0 ? 'Done' : 'Skip')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({ embeds: [embed], components: [row] });
}

export async function handleAddScreenshotButton(interaction: ButtonInteraction) {
  const modal = new ModalBuilder()
    .setCustomId(`${CUSTOM_ID.SVC_ADD_SCREENSHOT_MODAL}:${interaction.customId.split(':')[1]}`)
    .setTitle('Add Screenshot');

  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder().setCustomId('url').setLabel('Image URL').setPlaceholder('https://i.imgur.com/example.png').setStyle(TextInputStyle.Short).setRequired(true)
    )
  );

  await interaction.showModal(modal);
}

// Fix #13: Validate screenshot URL format
export async function handleAddScreenshotModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guildId) return;
  const key = builderKey(interaction.user.id, interaction.guildId);
  const state = builders.get(key);
  if (!state) {
    await interaction.reply({ content: 'Session expired.', ephemeral: true });
    return;
  }

  const url = interaction.fields.getTextInputValue('url').trim();

  // Validate URL format
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      await interaction.reply({ content: 'URL must start with http:// or https://', ephemeral: true });
      return;
    }
  } catch {
    await interaction.reply({ content: 'Invalid URL. Please enter a valid image URL.', ephemeral: true });
    return;
  }

  state.screenshots.push(url);

  await interaction.deferUpdate();
  await showScreenshotsPhase(interaction, key);
}

export async function handleSkipScreenshots(interaction: ButtonInteraction) {
  if (!interaction.guildId) return;
  const key = builderKey(interaction.user.id, interaction.guildId);
  const state = builders.get(key);
  if (!state) {
    await interaction.reply({ content: 'Session expired.', ephemeral: true });
    return;
  }

  state.phase = 'confirm';
  await interaction.deferUpdate();
  await showConfirmPhase(interaction, key);
}

// Fix #16: Pass currency to buildServiceEmbed
async function showConfirmPhase(interaction: ButtonInteraction, key: string) {
  const state = builders.get(key)!;

  await updateService(state.serviceId, {
    steps: state.steps,
    screenshots: state.screenshots,
  });

  const variants = await getVariantsByService(state.serviceId);
  const service = (await getService(state.serviceId))!;
  const guildConfig = await getGuildConfig(state.guildId);
  const embeds = buildServiceEmbed(service, variants, guildConfig?.currency || 'eur');

  const confirmEmbed = new EmbedBuilder()
    .setTitle('Preview — How customers will see this')
    .setColor(COLORS.WARNING)
    .setDescription('Choose an action below:');

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID.SVC_PUBLISH}:${state.serviceId}`)
      .setLabel('Publish to Catalog')
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID.SVC_SAVE_DRAFT}:${state.serviceId}`)
      .setLabel('Save as Draft')
      .setStyle(ButtonStyle.Secondary)
  );

  await interaction.editReply({ embeds: [confirmEmbed, ...embeds], components: [row] });
}

export async function handlePublish(interaction: ButtonInteraction) {
  if (!interaction.guildId) return;
  const key = builderKey(interaction.user.id, interaction.guildId);
  const state = builders.get(key);
  const serviceId = interaction.customId.split(':')[1];

  await interaction.deferUpdate();
  await updateService(serviceId, { is_active: true });

  if (state) builders.delete(key);

  await interaction.editReply({
    content: `Service activated! Run \`/service-publish\` to refresh the catalog in your channel.`,
    embeds: [],
    components: [],
  });

  logger.info('Service activated', { serviceId, guildId: interaction.guildId });
}

export async function handleSaveDraft(interaction: ButtonInteraction) {
  if (!interaction.guildId) return;
  const key = builderKey(interaction.user.id, interaction.guildId);
  const serviceId = interaction.customId.split(':')[1];

  builders.delete(key);

  await interaction.deferUpdate();
  await interaction.editReply({
    content: `Service saved as draft. Use \`/service-publish\` to publish it later. ID: \`${serviceId.slice(0, 8)}\``,
    embeds: [],
    components: [],
  });
}

// Fix #7: Verify guild ownership on edit modal
export async function handleEditModal(interaction: ModalSubmitInteraction) {
  if (!interaction.guildId) return;

  if (!isAdmin(interaction)) {
    await interaction.reply({ content: "You don't have permission.", ephemeral: true });
    return;
  }

  const serviceId = interaction.customId.split(':')[1];

  await interaction.deferReply({ ephemeral: true });

  // Verify the service belongs to this guild
  const service = await getService(serviceId);
  if (!service || service.guild_id !== interaction.guildId) {
    await interaction.editReply({ content: 'Service not found.' });
    return;
  }

  const name = interaction.fields.getTextInputValue('name');
  const description = interaction.fields.getTextInputValue('description');
  const category = interaction.fields.getTextInputValue('category') || 'General';

  await updateService(serviceId, { name, description, category });

  await interaction.editReply({ content: `Service **${name}** updated. Use \`/service-publish\` to refresh the catalog embed.` });
}
