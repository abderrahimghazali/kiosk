import type { Interaction } from 'discord.js';
import { CUSTOM_ID } from '../../utils/constants.js';
import { handleSetupModal } from '../commands/setup.js';
import {
  handleBasicInfoModal,
  handleAddVariantButton,
  handleAddVariantModal,
  handleDoneVariants,
  handleAddTextStepButton,
  handleAddTextStepModal,
  handleAddSelectStepButton,
  handleAddSelectStepModal,
  handleSkipSteps,
  handleAddScreenshotButton,
  handleAddScreenshotModal,
  handleSkipScreenshots,
  handlePublish,
  handleSaveDraft,
  handleEditModal,
} from './service-builder.js';
import {
  handleCategorySelect,
  handleOrderStart,
  handleOrderStartFromSelect,
  handleVariantSelect,
  handleStepTextButton,
  handleStepTextModal,
  handleStepSelect,
  handlePay,
  handleCancel,
} from './order-wizard.js';
import { handleAdminAccept, handleAdminComplete, handleAdminCancel } from './admin-actions.js';
import { logger } from '../../utils/logger.js';

export async function handleInteraction(interaction: Interaction) {
  try {
    // Button interactions
    if (interaction.isButton()) {
      const action = interaction.customId.split(':')[0];

      switch (action) {
        // Order wizard
        case CUSTOM_ID.ORDER_START:
          return handleOrderStart(interaction);
        case CUSTOM_ID.ORDER_STEP_TEXT_BTN:
          return handleStepTextButton(interaction);
        case CUSTOM_ID.ORDER_PAY:
          return handlePay(interaction);
        case CUSTOM_ID.ORDER_CANCEL:
          return handleCancel(interaction);

        // Admin actions
        case CUSTOM_ID.ADMIN_ACCEPT:
          return handleAdminAccept(interaction);
        case CUSTOM_ID.ADMIN_COMPLETE:
          return handleAdminComplete(interaction);
        case CUSTOM_ID.ADMIN_CANCEL:
          return handleAdminCancel(interaction);

        // Service builder
        case CUSTOM_ID.SVC_ADD_VARIANT_BTN:
          return handleAddVariantButton(interaction);
        case CUSTOM_ID.SVC_DONE_VARIANTS:
          return handleDoneVariants(interaction);
        case CUSTOM_ID.SVC_ADD_TEXT_STEP_BTN:
          return handleAddTextStepButton(interaction);
        case CUSTOM_ID.SVC_ADD_SELECT_STEP_BTN:
          return handleAddSelectStepButton(interaction);
        case CUSTOM_ID.SVC_SKIP_STEPS:
        case CUSTOM_ID.SVC_DONE_STEPS:
          return handleSkipSteps(interaction);
        case CUSTOM_ID.SVC_ADD_SCREENSHOT_BTN:
          return handleAddScreenshotButton(interaction);
        case CUSTOM_ID.SVC_SKIP_SCREENSHOTS:
        case CUSTOM_ID.SVC_DONE_SCREENSHOTS:
          return handleSkipScreenshots(interaction);
        case CUSTOM_ID.SVC_PUBLISH:
          return handlePublish(interaction);
        case CUSTOM_ID.SVC_SAVE_DRAFT:
          return handleSaveDraft(interaction);
      }
    }

    // String select menu interactions
    if (interaction.isStringSelectMenu()) {
      const action = interaction.customId.split(':')[0];

      switch (action) {
        case CUSTOM_ID.CATALOG_CATEGORY:
          return handleCategorySelect(interaction);
        case CUSTOM_ID.ORDER_START:
          return handleOrderStartFromSelect(interaction);
        case CUSTOM_ID.ORDER_VARIANT:
          return handleVariantSelect(interaction);
        case CUSTOM_ID.ORDER_STEP_SELECT:
          return handleStepSelect(interaction);
      }
    }

    // Modal submit interactions
    if (interaction.isModalSubmit()) {
      const action = interaction.customId.split(':')[0];

      switch (action) {
        case CUSTOM_ID.SETUP_MODAL:
          return handleSetupModal(interaction);
        case 'svc_create_basic':
          return handleBasicInfoModal(interaction);
        case 'svc_edit_modal':
          return handleEditModal(interaction);
        case CUSTOM_ID.SVC_ADD_VARIANT_MODAL:
          return handleAddVariantModal(interaction);
        case CUSTOM_ID.SVC_ADD_TEXT_STEP_MODAL:
          return handleAddTextStepModal(interaction);
        case CUSTOM_ID.SVC_ADD_SELECT_STEP_MODAL:
          return handleAddSelectStepModal(interaction);
        case CUSTOM_ID.SVC_ADD_SCREENSHOT_MODAL:
          return handleAddScreenshotModal(interaction);
        case CUSTOM_ID.ORDER_STEP_TEXT_MODAL:
          return handleStepTextModal(interaction);
      }
    }
  } catch (err) {
    logger.error('Interaction handler error', { error: String(err), customId: 'customId' in interaction ? String(interaction.customId) : 'N/A' });

    // Always try to respond to avoid "interaction failed"
    try {
      if (interaction.isRepliable()) {
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp({ content: 'Something went wrong. Please try again.', ephemeral: true });
        } else {
          await interaction.reply({ content: 'Something went wrong. Please try again.', ephemeral: true });
        }
      }
    } catch {
      // Can't respond at all
    }
  }
}
