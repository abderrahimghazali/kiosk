-- Guild configuration (one row per Discord server)
CREATE TABLE guild_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT UNIQUE NOT NULL,
    catalog_channel_id TEXT,
    orders_channel_id TEXT,
    log_channel_id TEXT,
    stripe_secret_key TEXT NOT NULL,
    stripe_webhook_secret TEXT NOT NULL,
    currency TEXT DEFAULT 'eur',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Service/Product catalog
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    screenshots TEXT[] DEFAULT '{}',
    steps JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    catalog_message_id TEXT,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Variants (each service has 1+ variants, each with its own price)
CREATE TABLE variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id TEXT NOT NULL,
    service_id UUID REFERENCES services(id),
    variant_id UUID REFERENCES variants(id),
    customer_discord_id TEXT NOT NULL,
    customer_discord_username TEXT NOT NULL,
    selected_variant_name TEXT NOT NULL,
    step_responses JSONB DEFAULT '[]',
    status TEXT DEFAULT 'pending_payment' CHECK (status IN ('pending_payment','paid','in_progress','completed','cancelled','refunded')),
    total_price INTEGER NOT NULL,
    currency TEXT NOT NULL,
    stripe_checkout_session_id TEXT,
    stripe_payment_intent_id TEXT,
    order_admin_message_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_services_guild ON services(guild_id);
CREATE INDEX idx_orders_guild ON orders(guild_id);
CREATE INDEX idx_orders_status ON orders(guild_id, status);
CREATE INDEX idx_variants_service ON variants(service_id);

-- RLS
ALTER TABLE guild_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON guild_configs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON variants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON orders FOR ALL USING (true) WITH CHECK (true);
