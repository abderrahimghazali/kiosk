import 'dotenv/config';
import { REST, Routes } from 'discord.js';
import { commands } from './commands/index.js';

const token = process.env.DISCORD_TOKEN!;
const clientId = process.env.DISCORD_CLIENT_ID!;
const guildId = process.argv[2]; // optional: pass guild ID for instant updates

const rest = new REST().setToken(token);

const commandData = [...commands.values()].map((c) => c.data.toJSON());

console.log(`Registering ${commandData.length} commands...`);

if (guildId) {
  // Guild commands: instant update
  rest
    .put(Routes.applicationGuildCommands(clientId, guildId), { body: commandData })
    .then(() => console.log(`Commands registered for guild ${guildId} (instant).`))
    .catch(console.error);
} else {
  // Global commands: can take up to 1 hour
  rest
    .put(Routes.applicationCommands(clientId), { body: commandData })
    .then(() => console.log('Commands registered globally (may take up to 1 hour).'))
    .catch(console.error);
}
