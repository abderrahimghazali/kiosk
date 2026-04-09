<p align="center">
  <img src="assets/kiosk-logo.png" alt="Kiosk" width="280" />
</p>

<h1 align="center">Kiosk</h1>

<p align="center">
  <strong>Turn any Discord server into a storefront.</strong>
</p>

<p align="center">
  <a href="https://github.com/abderrahimghazali/kiosk/actions/workflows/ci.yml"><img src="https://github.com/abderrahimghazali/kiosk/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="Node 20+" />
  <img src="https://img.shields.io/badge/discord.js-v14-5865F2" alt="discord.js v14" />
  <img src="https://img.shields.io/badge/stripe-checkout-635BFF" alt="Stripe" />
  <img src="https://img.shields.io/badge/supabase-postgres-3FCF8E" alt="Supabase" />
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" />
</p>

---

Kiosk is a **multi-guild Discord marketplace bot** that lets server admins create a full storefront inside Discord. Customers browse a catalog, go through an ephemeral order wizard, and pay via Stripe Checkout — all without leaving Discord.

## Features

- **Multi-guild** — each server gets its own independent marketplace with their own Stripe keys
- **Service catalog** — organized by categories with rich embeds and a select-menu interface
- **Variant pricing** — each service supports multiple tiers (Basic, Pro, Enterprise, etc.)
- **Customer info steps** — collect custom data from buyers (text fields, multiple choice)
- **Ephemeral order wizard** — the entire ordering flow is private to the customer
- **Stripe Checkout** — secure one-time payments with automatic webhook handling
- **Admin order management** — accept, complete, or cancel & refund orders with one click
- **Customer DMs** — automatic status updates on payment, acceptance, completion, and refunds
- **Screenshots** — attach images to services via URL

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm
- A [Supabase](https://supabase.com) project
- A [Discord application](https://discord.com/developers/applications) with a bot
- A [Stripe](https://stripe.com) account (test mode works)

### 1. Clone & install

```bash
git clone https://github.com/abderrahimghazali/kiosk.git
cd kiosk
pnpm install
```

### 2. Set up environment

```bash
cp .env.example .env
```

Fill in your credentials:

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Bot token from Discord Developer Portal |
| `DISCORD_CLIENT_ID` | Application ID |
| `SUPABASE_URL` | Your Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
| `PORT` | Webhook server port (default: 3000) |
| `WEBHOOK_BASE_URL` | Public URL for Stripe webhooks |

### 3. Set up database

Run `src/db/schema.sql` in your Supabase SQL editor.

### 4. Register commands

```bash
# Instant (for a specific server during development)
pnpm deploy-commands <guild_id>

# Global (takes up to 1 hour to propagate)
pnpm deploy-commands
```

### 5. Start

```bash
# Development (with hot reload)
pnpm dev

# Production
pnpm build && pnpm start
```

### 6. Invite the bot

```
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=2147535872&scope=bot%20applications.commands
```

## Usage

### Admin Setup

1. **`/setup`** — Configure catalog channel, orders channel, Stripe keys, and currency
2. **`/service-create`** — Interactive wizard to create services with variants and customer steps
3. **`/service-publish`** — Post the catalog embed in your catalog channel
4. **`/service-list`** — View all services
5. **`/service-edit`** — Edit a service's name, description, or category
6. **`/service-delete`** — Remove a service

### Customer Flow

1. Customer selects a **category** from the catalog dropdown
2. Picks a **service** from the category view
3. Selects a **variant** (pricing tier)
4. Answers any **custom questions** the admin configured
5. Reviews the **order summary**
6. Clicks **Pay Now** → redirected to Stripe Checkout
7. Receives a **DM** when payment is confirmed

### Order Management

- Orders appear in the admin orders channel with **Accept & Start** and **Cancel & Refund** buttons
- Admins use **`/orders list`** and **`/orders view`** for filtered views
- Status transitions: `pending_payment` → `paid` → `in_progress` → `completed`

## Stripe Webhooks

Each guild has its own webhook endpoint:

```
POST {WEBHOOK_BASE_URL}/webhooks/stripe/{guild_id}
```

**Local development** — use the Stripe CLI:

```bash
stripe listen --forward-to localhost:3000/webhooks/stripe/<guild_id>
```

**Production** — add the endpoint in Stripe Dashboard, listening for `checkout.session.completed`.

## Architecture

```
src/
├── index.ts                  # Entry point
├── bot/
│   ├── client.ts             # Discord client + event routing
│   ├── deploy-commands.ts    # Slash command registration
│   ├── commands/             # 7 slash commands
│   ├── interactions/         # Button, select menu, modal handlers
│   └── embeds/               # Embed builders
├── server/
│   └── webhooks/stripe.ts    # Fastify + Stripe webhook handler
├── services/                 # Business logic layer
├── db/                       # Supabase client, schema, types
└── utils/                    # Constants, permissions, logger
```

| Layer | Tech |
|-------|------|
| Runtime | Node.js 20+ / TypeScript (strict) |
| Discord | discord.js v14 |
| Database | Supabase (PostgreSQL) |
| Payments | Stripe Checkout Sessions |
| HTTP | Fastify (webhook server) |

## License

MIT
