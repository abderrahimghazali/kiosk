import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
} from 'discord.js';
import type { Service, Variant } from '../../db/types.js';
import { COLORS, CUSTOM_ID } from '../../utils/constants.js';

/** Build a single embed for one service (used in previews / service-create confirm) */
export function buildServiceEmbed(service: Service, variants: Variant[], currency = 'eur'): EmbedBuilder[] {
  const embeds: EmbedBuilder[] = [];

  const mainEmbed = new EmbedBuilder()
    .setTitle(service.name)
    .setDescription(service.description)
    .setColor(COLORS.PRIMARY)
    .setTimestamp();

  if (service.category && service.category !== 'General') {
    mainEmbed.addFields({ name: 'Category', value: service.category, inline: true });
  }

  if (variants.length > 0) {
    const variantLines = variants.map((v) => {
      const price = formatPrice(v.price, currency);
      const desc = v.description ? `\n${v.description}` : '';
      return `**${v.name}** — ${price}${desc}`;
    });
    mainEmbed.addFields({ name: 'Plans', value: variantLines.join('\n\n') });
  }

  if (service.screenshots.length > 0) {
    mainEmbed.setImage(service.screenshots[0]);
  }

  embeds.push(mainEmbed);

  for (let i = 1; i < service.screenshots.length; i++) {
    embeds.push(new EmbedBuilder().setImage(service.screenshots[i]));
  }

  return embeds;
}

/** Build the catalog landing embed with category selector */
export function buildCatalogEmbed(
  services: { service: Service; variants: Variant[] }[],
  _currency: string
): { embed: EmbedBuilder; row: ActionRowBuilder<StringSelectMenuBuilder> } {
  // Group by category
  const categoryMap = new Map<string, number>();
  for (const { service } of services) {
    categoryMap.set(service.category, (categoryMap.get(service.category) || 0) + 1);
  }

  const embed = new EmbedBuilder()
    .setTitle('🛒 Marketplace')
    .setDescription(`Browse **${services.length}** services across **${categoryMap.size}** categories.\n\nSelect a category below to see available services.`)
    .setColor(COLORS.PRIMARY)
    .setTimestamp();

  // Show category summary as fields
  for (const [cat, count] of categoryMap) {
    embed.addFields({ name: cat, value: `${count} service${count > 1 ? 's' : ''}`, inline: true });
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(CUSTOM_ID.CATALOG_CATEGORY)
    .setPlaceholder('Choose a category...')
    .addOptions(
      [...categoryMap.entries()].slice(0, 25).map(([cat, count]) => ({
        label: cat,
        description: `${count} service${count > 1 ? 's' : ''}`,
        value: cat,
      }))
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  return { embed, row };
}

/** Build the category view with services in that category */
export function buildCategoryEmbed(
  category: string,
  services: { service: Service; variants: Variant[] }[],
  currency: string
): { embed: EmbedBuilder; row: ActionRowBuilder<StringSelectMenuBuilder> } {
  const embed = new EmbedBuilder()
    .setTitle(`🛒 ${category}`)
    .setColor(COLORS.PRIMARY)
    .setFooter({ text: 'Select a service below to start an order' });

  const description: string[] = [];
  for (const { service, variants } of services) {
    const priceRange = variants.length > 0
      ? `${formatPrice(Math.min(...variants.map(v => v.price)), currency)} — ${formatPrice(Math.max(...variants.map(v => v.price)), currency)}`
      : 'No pricing';
    description.push(`**${service.name}**\n${service.description.substring(0, 120)}${service.description.length > 120 ? '...' : ''}\n${priceRange}`);
  }

  embed.setDescription(description.join('\n\n').substring(0, 4096));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(CUSTOM_ID.ORDER_START)
    .setPlaceholder('Choose a service to order...')
    .addOptions(
      services.slice(0, 25).map(({ service, variants }) => {
        const minPrice = variants.length > 0
          ? `From ${formatPrice(Math.min(...variants.map(v => v.price)), currency)}`
          : service.category;
        return {
          label: service.name.substring(0, 100),
          description: minPrice.substring(0, 100),
          value: service.id,
        };
      })
    );

  const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

  return { embed, row };
}

/** Legacy single-service action row (kept for preview in service-create) */
export function buildServiceActionRow(serviceId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`${CUSTOM_ID.ORDER_START}:${serviceId}`)
      .setLabel('Order')
      .setEmoji('🛒')
      .setStyle(ButtonStyle.Primary)
  );
}

export function formatPrice(cents: number, currency: string): string {
  const amount = cents / 100;
  const symbols: Record<string, string> = { eur: '€', usd: '$', gbp: '£' };
  const symbol = symbols[currency.toLowerCase()] || currency.toUpperCase() + ' ';
  return `${symbol}${amount.toFixed(2)}`;
}
