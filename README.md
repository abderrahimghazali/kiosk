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
- **Discount coupons** — percentage or fixed amount, with optional expiry, usage limits, and per-service restrictions
- **Staff system** — application form, role-based access with category assignments, team management
- **Analytics dashboard** — revenue, top services, top customers, status breakdown, and daily revenue trend chart
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

## Commands

### Setup & Services

| Command | Description | Permission |
|---------|-------------|------------|
| `/setup` | Configure catalog channel, orders channel, Stripe keys, and currency | Manage Server |
| `/service-create` | Interactive wizard to create services with variants and steps | Manage Server |
| `/service-publish` | Post/refresh the catalog embed in the catalog channel | Manage Server |
| `/service-list` | List all services with pricing | Manage Server |
| `/service-edit` | Edit a service's name, description, or category | Manage Server |
| `/service-delete` | Remove a service | Manage Server |

### Orders

| Command | Description | Permission |
|---------|-------------|------------|
| `/orders list` | List orders with status/customer filters | Manage Server |
| `/orders view` | View detailed order info | Manage Server |

### Coupons

| Command | Description | Permission |
|---------|-------------|------------|
| `/coupon-create` | Create a discount coupon (% or fixed, optional expiry/max uses/service restriction) | Manage Server |
| `/coupon-list` | List all coupons with usage stats | Manage Server |
| `/coupon-delete` | Delete a coupon by code | Manage Server |

### Staff

| Command | Description | Permission |
|---------|-------------|------------|
| `/staff-setup` | Post an application embed with "Apply Now" button in a channel | Manage Server |
| `/staff-roles create` | Create a staff role with category-based access | Manage Server |
| `/staff-roles list` | View all staff roles | Manage Server |
| `/staff-roles delete` | Delete a staff role | Manage Server |
| `/staff-list show` | View all staff members and their roles | Manage Server |
| `/staff-list remove` | Remove a staff member | Manage Server |
| `/my-assignments` | View your own staff role and assigned categories | Staff |

### Analytics

| Command | Description | Permission |
|---------|-------------|------------|
| `/analytics` | Revenue dashboard with top services, top customers, and daily trend chart | Manage Server |

## Customer Flow

1. Customer selects a **category** from the catalog dropdown
2. Picks a **service** from the category view
3. Selects a **variant** (pricing tier)
4. Answers any **custom questions** the admin configured
5. Reviews the **order summary** — can apply a **coupon code** for a discount
6. Clicks **Pay Now** → redirected to Stripe Checkout (or instant for free orders)
7. Receives a **DM** when payment is confirmed

## Staff System

Kiosk includes a built-in staff recruitment and role-based access system:

1. **Create roles** — `/staff-roles create name:Booster categories:Gaming` maps a role to specific service categories
2. **Post application** — `/staff-setup #apply` drops an embed with an "Apply Now" button
3. **Applicants fill a form** — about themselves, experience, availability, and motivation
4. **Review in orders channel** — applications appear with Accept/Reject buttons
5. **On accept** — admin picks a role to assign, applicant gets a DM and is added to staff
6. **Staff can manage orders** — Accept, Complete, and Refund orders within their assigned categories
7. **Self-service** — staff use `/my-assignments` to see their role and categories

## Order Management

- Orders appear in the admin orders channel with **Accept & Start** and **Cancel & Refund** buttons
- Both admins and staff (with matching category access) can manage orders
- Status transitions: `pending_payment` → `paid` → `in_progress` → `completed`
- Refunds are processed through Stripe automatically

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
│   ├── commands/             # 15 slash commands
│   ├── interactions/         # Button, select menu, modal handlers
│   └── embeds/               # Embed builders
├── server/
│   └── webhooks/stripe.ts    # Fastify + Stripe webhook handler
├── services/                 # Business logic (orders, services, coupons, staff, analytics, Stripe)
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
