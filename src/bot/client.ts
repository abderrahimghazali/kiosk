import { Client, Events, GatewayIntentBits } from 'discord.js';
import { commands } from './commands/index.js';
import { handleInteraction } from './interactions/index.js';
import { logger } from '../utils/logger.js';

export function createBot(): Client {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds],
  });

  client.once(Events.ClientReady, (c) => {
    logger.info(`Bot ready as ${c.user.tag}`, { guilds: c.guilds.cache.size });
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) return;

      try {
        await command.execute(interaction);
      } catch (err) {
        logger.error('Command execution error', {
          command: interaction.commandName,
          error: String(err),
        });
        const reply = { content: 'Something went wrong executing this command.', ephemeral: true };
        if (interaction.deferred || interaction.replied) {
          await interaction.followUp(reply).catch(() => {});
        } else {
          await interaction.reply(reply).catch(() => {});
        }
      }
      return;
    }

    // Buttons, select menus, modals
    await handleInteraction(interaction);
  });

  return client;
}
