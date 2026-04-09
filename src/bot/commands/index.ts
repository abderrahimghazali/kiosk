import type { ChatInputCommandInteraction, SharedSlashCommand } from 'discord.js';

import * as setup from './setup.js';
import * as serviceCreate from './service-create.js';
import * as serviceList from './service-list.js';
import * as serviceEdit from './service-edit.js';
import * as serviceDelete from './service-delete.js';
import * as servicePublish from './service-publish.js';
import * as orders from './orders.js';
import * as analytics from './analytics.js';
import * as couponCreate from './coupon-create.js';
import * as couponList from './coupon-list.js';
import * as couponDelete from './coupon-delete.js';
import * as staffSetup from './staff-setup.js';
import * as staffRoles from './staff-roles.js';
import * as staffList from './staff-list.js';
import * as myAssignments from './my-assignments.js';

export interface Command {
  data: SharedSlashCommand;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

export const commands = new Map<string, Command>();

const allCommands: Command[] = [
  setup,
  serviceCreate,
  serviceList,
  serviceEdit,
  serviceDelete,
  servicePublish,
  orders,
  analytics,
  couponCreate,
  couponList,
  couponDelete,
  staffSetup,
  staffRoles,
  staffList,
  myAssignments,
];

for (const cmd of allCommands) {
  commands.set(cmd.data.name, cmd);
}
